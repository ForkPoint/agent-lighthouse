import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createRequestScheduler,
  HostStoppedError,
  HostStopReason,
  type HostState,
} from "./request-scheduler";

// Use real timers: node:timers/promises is deliberately abortable.
afterEach(() => vi.useRealTimers());

describe("shared request pacing", () => {
  it("reports actual active requests, queued work, and the last HTTP status", async () => {
    const scheduler = createRequestScheduler({ gapMs: 0 });
    const release = await scheduler.acquire("https://example.com/a");
    const controller = new AbortController();
    const queued = scheduler.acquire(
      "https://www.example.com/b",
      controller.signal,
    );
    scheduler.observe("https://example.com/a", 429, undefined);
    expect(scheduler.snapshot()).toMatchObject([
      {
        host: "example.com",
        activeUrl: "https://example.com/a",
        waiting: 1,
        lastStatus: 429,
        stopped: true,
      },
    ]);
    const copy = scheduler.snapshot();
    copy[0]!.waiting = 999;
    expect(scheduler.snapshot()[0]!.waiting).toBe(1);
    controller.abort();
    await expect(queued).rejects.toThrow();
    release();
    expect(scheduler.snapshot()).toMatchObject([
      { activeUrl: null, waiting: 0 },
    ]);
  });
  it("holds a hostname until release and spaces its next request", async () => {
    const scheduler = createRequestScheduler({ gapMs: 30 });
    const release = await scheduler.acquire("https://example.com/a");
    let admitted = false;
    const next = scheduler.acquire("http://www.example.com/b").then((done) => {
      admitted = true;
      return done;
    });
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(admitted).toBe(false);
    const finished = Date.now();
    release();
    const done = await next;
    expect(Date.now() - finished).toBeGreaterThanOrEqual(25);
    done();
  });

  it("lets another host proceed while one host is busy", async () => {
    const scheduler = createRequestScheduler({ gapMs: 1000 });
    const first = await scheduler.acquire("https://one.example/a");
    const other = await scheduler.acquire("https://two.example/b");
    other();
    first();
  });

  it.each([403, 429])("stops queued requests after HTTP %s", async (status) => {
    const scheduler = createRequestScheduler({ gapMs: 0 });
    const release = await scheduler.acquire("https://example.com");
    const queued = scheduler.acquire("https://www.example.com/a");
    scheduler.observe("https://example.com", status, "120");
    release();
    await expect(queued).rejects.toThrow("Site paused");
  });

  it("honors Retry-After on HTTP 503", async () => {
    const scheduler = createRequestScheduler({ gapMs: 0 });
    scheduler.observe("https://example.com", 503, "0.05");
    const started = Date.now();
    const release = await scheduler.acquire("https://example.com");
    expect(Date.now() - started).toBeGreaterThanOrEqual(40);
    release();
  });

  it("keeps a waiting request back when its cooldown grows", async () => {
    const scheduler = createRequestScheduler({ gapMs: 0 });
    scheduler.observe("https://example.com", 503, "0.05");
    const started = Date.now();
    const admitted = scheduler.acquire("https://example.com/a");
    setTimeout(() => {
      // A 200 resets the 503 count, so the next 503 sets a longer cooldown.
      scheduler.observe("https://example.com", 200, undefined);
      scheduler.observe("https://example.com", 503, "0.3");
    }, 10);
    const release = await admitted;
    expect(Date.now() - started).toBeGreaterThanOrEqual(290);
    release();
  });

  it("cancels a cooldown without sending a request", async () => {
    const scheduler = createRequestScheduler({ gapMs: 1000 });
    const release = await scheduler.acquire("https://example.com");
    release();
    const controller = new AbortController();
    const queued = scheduler.acquire(
      "https://example.com/a",
      controller.signal,
    );
    setTimeout(() => controller.abort(), 10);
    await expect(queued).rejects.toThrow();
    scheduler.observe("https://example.com", 403, undefined);
    await expect(scheduler.acquire("https://example.com/b")).rejects.toThrow(
      "Site paused",
    );
  });

  it("cancels a queued request without unlocking its active predecessor", async () => {
    const scheduler = createRequestScheduler({ gapMs: 0 });
    const release = await scheduler.acquire("https://example.com");
    const controller = new AbortController();
    const cancelled = scheduler.acquire(
      "https://example.com/a",
      controller.signal,
    );
    controller.abort(new Error("cancelled"));
    await expect(cancelled).rejects.toThrow("cancelled");
    let admitted = false;
    const next = scheduler.acquire("https://example.com/b").then((done) => {
      admitted = true;
      return done;
    });
    await Promise.resolve();
    expect(admitted).toBe(false);
    release();
    (await next)();
  });

  it("remembers that a host answered, for apex and www alike", () => {
    const scheduler = createRequestScheduler({ gapMs: 0 });
    expect(scheduler.answered("https://example.com")).toBe(false);
    scheduler.observe("https://www.example.com/a", 503, "1");
    expect(scheduler.answered("http://example.com")).toBe(true);
    expect(scheduler.answered("https://other.example")).toBe(false);
  });

  it("stops a host after a second HTTP 503 in a row", async () => {
    const scheduler = createRequestScheduler({ gapMs: 0 });
    scheduler.observe("https://example.com", 503, "0");
    scheduler.observe("https://example.com/a", 200, undefined);
    scheduler.observe("https://example.com/b", 503, "0");
    (await scheduler.acquire("https://example.com/c"))();
    scheduler.observe("https://example.com/c", 503, "0");
    await expect(scheduler.acquire("https://example.com/d")).rejects.toThrow(
      "Site paused",
    );
  });

  it("does not stop a host on a 403 to a borrowed User-Agent, but does on 429", async () => {
    const scheduler = createRequestScheduler({ gapMs: 0 });
    scheduler.observe("https://example.com", 403, undefined, {
      ownAgent: false,
    });
    (await scheduler.acquire("https://example.com/a"))();
    scheduler.observe("https://example.com/a", 429, undefined, {
      ownAgent: false,
    });
    await expect(scheduler.acquire("https://example.com/b")).rejects.toThrow(
      "Site paused",
    );
  });

  it("stops a 403 to the browser baseline like one to the scanner", async () => {
    const scheduler = createRequestScheduler();
    scheduler.observe("https://example.com", 403, undefined, {
      ownAgent: true,
    });
    await expect(scheduler.acquire("https://example.com/a")).rejects.toThrow(
      HostStoppedError,
    );
  });

  it("names the reason a host stopped", async () => {
    const scheduler = createRequestScheduler();
    scheduler.observe("https://example.com", 429, undefined);
    const error = await scheduler
      .acquire("https://example.com/a")
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HostStoppedError);
    expect(error).toMatchObject({
      host: "example.com",
      reason: HostStopReason.TooManyRequests,
    });
    expect(scheduler.exportState()).toMatchObject([
      { stopped: true, stopReason: HostStopReason.TooManyRequests },
    ]);
  });

  it("stops a host whose Retry-After outlasts the cap instead of waiting", async () => {
    const scheduler = createRequestScheduler({ maxRetryAfterMs: 1_000 });
    scheduler.observe("https://example.com", 503, "120");
    await expect(scheduler.acquire("https://example.com/a")).rejects.toThrow(
      "Site paused",
    );
    expect(scheduler.exportState()[0]!.stopReason).toBe(
      HostStopReason.RetryAfterTooLong,
    );
  });

  it("waits out a Retry-After within the cap", () => {
    const scheduler = createRequestScheduler({ maxRetryAfterMs: 1_000 });
    const before = Date.now();
    scheduler.observe("https://example.com", 503, "0.5");
    const state = scheduler.exportState()[0]!;
    expect(state.stopped).toBe(false);
    expect(state.readyAt).toBeGreaterThanOrEqual(before + 500);
  });

  it("reads an HTTP-date Retry-After", () => {
    const scheduler = createRequestScheduler();
    const at = new Date(Date.now() + 5_000);
    at.setMilliseconds(0);
    scheduler.observe("https://example.com", 503, at.toUTCString());
    expect(scheduler.exportState()[0]!.readyAt).toBe(at.getTime());
  });

  it("reports each change of a host's state", () => {
    const changes: HostState[] = [];
    const scheduler = createRequestScheduler({
      onChange: (state) => changes.push(state),
    });
    scheduler.observe("https://www.example.com/a", 503, "1");
    scheduler.observe("https://example.com/b", 403, undefined);
    expect(changes).toMatchObject([
      { host: "example.com", unavailable: 1, stopped: false, lastStatus: 503 },
      {
        host: "example.com",
        unavailable: 0,
        stopped: true,
        stopReason: HostStopReason.Forbidden,
        lastStatus: 403,
      },
    ]);
  });

  it("keeps a stopped host stopped and a cooldown's wait across export and import", async () => {
    const first = createRequestScheduler();
    first.observe("https://stopped.example", 429, undefined);
    first.observe("https://cool.example", 503, "60");
    const saved = JSON.parse(
      JSON.stringify(first.exportState()),
    ) as HostState[];

    const second = createRequestScheduler({ state: saved });

    await expect(second.acquire("https://stopped.example/a")).rejects.toThrow(
      HostStoppedError,
    );
    const cool = second
      .exportState()
      .find((state) => state.host === "cool.example")!;
    expect(cool.readyAt - Date.now()).toBeGreaterThan(55_000);
    expect(cool.unavailable).toBe(1);
    // The next 503 in a row is the second, so it stops the host.
    second.observe("https://cool.example/b", 503, "1");
    await expect(second.acquire("https://cool.example/c")).rejects.toThrow(
      HostStoppedError,
    );
  });

  it("imports state into a live scheduler without unstopping a host", async () => {
    const scheduler = createRequestScheduler();
    scheduler.observe("https://example.com", 429, undefined);
    scheduler.importState([
      {
        host: "example.com",
        readyAt: 0,
        stopped: false,
        stopReason: null,
        unavailable: 0,
        lastStatus: 200,
      },
    ]);
    await expect(scheduler.acquire("https://example.com/a")).rejects.toThrow(
      HostStoppedError,
    );
  });

  it("refuses a gap or cap that is not a non-negative number", () => {
    expect(() => createRequestScheduler({ gapMs: -1 })).toThrow(RangeError);
    expect(() =>
      createRequestScheduler({ maxRetryAfterMs: Number.NaN }),
    ).toThrow(RangeError);
  });
});
