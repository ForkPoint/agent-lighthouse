import { afterEach, describe, expect, it, vi } from "vitest";
import { createFetcherWith, type Transport } from "./fetcher";
import {
  createRequestScheduler,
  HostStoppedError,
  type DefaultRequestScheduler,
} from "./request-scheduler";

afterEach(() => vi.useRealTimers());

const owner = {};

async function healthy(
  scheduler: DefaultRequestScheduler,
  url: string,
  status = 200,
): Promise<void> {
  const release = await scheduler.acquireRequest(url, { owner });
  scheduler.observe(url, status, undefined);
  release();
}

/** Whether a request to `url` is admitted before the microtask queue drains. */
async function admittedNow(
  scheduler: DefaultRequestScheduler,
  url: string,
): Promise<{ admitted: boolean; settle: () => Promise<void> }> {
  let release: (() => void) | undefined;
  const pending = scheduler.acquireRequest(url, { owner }).then((done) => {
    release = done;
    return done;
  });
  await Promise.resolve();
  await Promise.resolve();
  return {
    admitted: release !== undefined,
    settle: async () => {
      await pending;
      release?.();
    },
  };
}

function limitOf(scheduler: DefaultRequestScheduler): number | undefined {
  return scheduler.snapshot()[0]?.hostLimit;
}

describe("auto-throttle", () => {
  it("keeps one request per host when auto-throttle is off", async () => {
    const scheduler = createRequestScheduler();
    for (let i = 0; i < 20; i += 1)
      await healthy(scheduler, `https://site.test/${i}`);
    expect(limitOf(scheduler)).toBe(1);
    const held = await scheduler.acquireRequest("https://site.test/a", {
      owner,
    });
    const second = await admittedNow(scheduler, "https://site.test/b");
    expect(second.admitted).toBe(false);
    held();
    await second.settle();
  });

  it("raises the host limit by one per full window of healthy answers", async () => {
    const scheduler = createRequestScheduler({
      autoThrottle: { maxPerHost: 3 },
    });
    // A release without a status is strain; at 1 the limit cannot drop.
    (await scheduler.acquireRequest("https://site.test/0", { owner }))();
    expect(limitOf(scheduler)).toBe(1);
    await healthy(scheduler, "https://site.test/1");
    expect(limitOf(scheduler)).toBe(2);
    await healthy(scheduler, "https://site.test/2");
    expect(limitOf(scheduler)).toBe(2);
    await healthy(scheduler, "https://site.test/3");
    expect(limitOf(scheduler)).toBe(3);
    for (let i = 4; i < 20; i += 1)
      await healthy(scheduler, `https://site.test/${i}`);
    expect(limitOf(scheduler)).toBe(3);
  });

  it("admits up to the host limit at once, apex and www together", async () => {
    const scheduler = createRequestScheduler({
      autoThrottle: { maxPerHost: 2 },
    });
    await healthy(scheduler, "https://site.test/warm");
    expect(limitOf(scheduler)).toBe(2);
    const first = await scheduler.acquireRequest("https://site.test/a", {
      owner,
    });
    const second = await scheduler.acquireRequest("https://www.site.test/b", {
      owner,
    });
    expect(scheduler.snapshot()[0]).toMatchObject({
      activeRequests: 2,
      activeUrl: "https://site.test/a",
    });
    const third = await admittedNow(scheduler, "https://site.test/c");
    expect(third.admitted).toBe(false);
    first();
    second();
    await third.settle();
  });

  it("halves the limit on a 5xx, a request without an answer, and a slow request", async () => {
    vi.useFakeTimers();
    const scheduler = createRequestScheduler({
      autoThrottle: { maxPerHost: 8, slowMs: 1000 },
    });
    for (let i = 0; i < 1 + 2 + 3; i += 1)
      await healthy(scheduler, `https://site.test/${i}`);
    expect(limitOf(scheduler)).toBe(4);

    await healthy(scheduler, "https://site.test/error", 502);
    expect(limitOf(scheduler)).toBe(2);

    // A timeout or reset releases the lease without an observed status.
    (await scheduler.acquireRequest("https://site.test/timeout", { owner }))();
    expect(limitOf(scheduler)).toBe(1);

    await healthy(scheduler, "https://site.test/up");
    expect(limitOf(scheduler)).toBe(2);
    const slow = await scheduler.acquireRequest("https://site.test/slow", {
      owner,
    });
    scheduler.observe("https://site.test/slow", 200, undefined);
    vi.advanceTimersByTime(1001);
    slow();
    expect(limitOf(scheduler)).toBe(1);
  });

  it("counts a 404 as a healthy answer", async () => {
    const scheduler = createRequestScheduler({
      autoThrottle: { maxPerHost: 4 },
    });
    await healthy(scheduler, "https://site.test/missing", 404);
    expect(limitOf(scheduler)).toBe(2);
  });

  it("keeps the gap after each release", async () => {
    vi.useFakeTimers();
    const scheduler = createRequestScheduler({
      gapMs: 1000,
      autoThrottle: { maxPerHost: 4 },
    });
    await healthy(scheduler, "https://site.test/warm");
    const next = await admittedNow(scheduler, "https://site.test/next");
    expect(next.admitted).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    await next.settle();
  });

  it("still stops every queued request on HTTP 429", async () => {
    const scheduler = createRequestScheduler({
      autoThrottle: { maxPerHost: 2 },
    });
    await healthy(scheduler, "https://site.test/warm");
    const first = await scheduler.acquireRequest("https://site.test/a", {
      owner,
    });
    const second = await scheduler.acquireRequest("https://site.test/b", {
      owner,
    });
    const queued = scheduler.acquireRequest("https://site.test/c", { owner });
    scheduler.observe("https://site.test/a", 429, undefined);
    await expect(queued).rejects.toBeInstanceOf(HostStoppedError);
    first();
    second();
  });

  it("refuses a host limit that is not a positive whole number", () => {
    expect(() =>
      createRequestScheduler({ autoThrottle: { maxPerHost: 0 } }),
    ).toThrow(RangeError);
    expect(() =>
      createRequestScheduler({ autoThrottle: { maxPerHost: 1.5 } }),
    ).toThrow(RangeError);
    expect(() =>
      createRequestScheduler({ autoThrottle: { maxPerHost: 2, slowMs: -1 } }),
    ).toThrow(RangeError);
  });
});

describe("auto-throttle through the fetcher", () => {
  it("raises the limit from fetcher answers and sends two requests at once", async () => {
    const scheduler = createRequestScheduler({
      autoThrottle: { maxPerHost: 2 },
    });
    let inFlight = 0;
    let peak = 0;
    const transport: Transport = async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return {
        statusCode: 200,
        headers: {},
        body: {
          async *[Symbol.asyncIterator]() {
            yield new TextEncoder().encode("ok");
          },
          async dump() {},
        },
      };
    };
    const fetcher = createFetcherWith(
      {
        requestScheduler: scheduler,
        readyRequestScheduling: true,
        maxConcurrent: 4,
      },
      transport,
    );
    await fetcher.fetch({ url: "https://site.test/warm" });
    expect(limitOf(scheduler)).toBe(2);
    await Promise.all([
      fetcher.fetch({ url: "https://site.test/a" }),
      fetcher.fetch({ url: "https://site.test/b" }),
      fetcher.fetch({ url: "https://site.test/c" }),
    ]);
    expect(peak).toBe(2);
  });
});

function hostOf(
  scheduler: DefaultRequestScheduler,
  host: string,
): ReturnType<DefaultRequestScheduler["snapshot"]>[number] | undefined {
  return scheduler.snapshot().find((site) => site.host === host);
}

/** Raise a host from one slot to `slots` with healthy answers. */
async function warm(
  scheduler: DefaultRequestScheduler,
  origin: string,
  slots: number,
): Promise<void> {
  for (let i = 0; i < (slots * (slots - 1)) / 2; i += 1)
    await healthy(scheduler, `${origin}/warm-${i}`);
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe("auto-throttle edge cases", () => {
  it("admits nothing new after a drop until the host falls below its new limit", async () => {
    const scheduler = createRequestScheduler({
      autoThrottle: { maxPerHost: 4 },
    });
    await warm(scheduler, "https://site.test", 4);
    expect(limitOf(scheduler)).toBe(4);
    const held = await Promise.all(
      ["a", "b", "c", "d"].map((path) =>
        scheduler.acquireRequest(`https://site.test/${path}`, { owner }),
      ),
    );
    const queued = await admittedNow(scheduler, "https://site.test/e");
    expect(queued.admitted).toBe(false);

    scheduler.observe("https://site.test/a", 502, undefined);
    held[0]!();
    expect(limitOf(scheduler)).toBe(2);
    await flush();
    expect(hostOf(scheduler, "site.test")?.activeRequests).toBe(3);
    expect(hostOf(scheduler, "site.test")?.waiting).toBe(1);

    // The next release is healthy and the limit stays 2, so 2 in flight
    // still leaves no room.
    scheduler.observe("https://site.test/b", 200, undefined);
    held[1]!();
    await flush();
    expect(hostOf(scheduler, "site.test")?.activeRequests).toBe(2);
    expect(hostOf(scheduler, "site.test")?.waiting).toBe(1);

    scheduler.observe("https://site.test/c", 200, undefined);
    held[2]!();
    await queued.settle();
    held[3]!();
  });

  it("drops partial progress toward the next slot after strain", async () => {
    const scheduler = createRequestScheduler({
      autoThrottle: { maxPerHost: 8 },
    });
    await warm(scheduler, "https://site.test", 4);
    // Three of the four healthy answers needed to reach five.
    for (let i = 0; i < 3; i += 1)
      await healthy(scheduler, `https://site.test/${i}`);
    expect(limitOf(scheduler)).toBe(4);
    await healthy(scheduler, "https://site.test/fail", 500);
    expect(limitOf(scheduler)).toBe(2);
    // Carried-over progress would reach a full window of two here.
    await healthy(scheduler, "https://site.test/3");
    expect(limitOf(scheduler)).toBe(2);
    await healthy(scheduler, "https://site.test/4");
    expect(limitOf(scheduler)).toBe(3);
  });

  it("keeps each host's limit separate", async () => {
    const scheduler = createRequestScheduler({
      autoThrottle: { maxPerHost: 4 },
    });
    await warm(scheduler, "https://calm.test", 3);
    await warm(scheduler, "https://busy.test", 3);
    await healthy(scheduler, "https://busy.test/down", 503);
    expect(hostOf(scheduler, "calm.test")?.hostLimit).toBe(3);
    expect(hostOf(scheduler, "busy.test")?.hostLimit).toBe(1);
  });

  it("lets the global cap and the owner cap bind below the host limit", async () => {
    const scheduler = createRequestScheduler({
      maxConcurrent: 2,
      autoThrottle: { maxPerHost: 4 },
    });
    await warm(scheduler, "https://site.test", 4);
    const first = await scheduler.acquireRequest("https://site.test/a", {
      owner,
    });
    const second = await scheduler.acquireRequest("https://site.test/b", {
      owner,
    });
    const third = await admittedNow(scheduler, "https://site.test/c");
    expect(third.admitted).toBe(false);
    first();
    await third.settle();
    second();

    const solo = {};
    const held = await scheduler.acquireRequest("https://site.test/d", {
      owner: solo,
      maxConcurrent: 1,
    });
    let entered = false;
    const next = scheduler
      .acquireRequest("https://site.test/e", { owner: solo, maxConcurrent: 1 })
      .then((release) => {
        entered = true;
        return release;
      });
    await flush();
    expect(entered).toBe(false);
    held();
    (await next)();
  });

  it("gives the legacy acquire path the same host slots", async () => {
    const scheduler = createRequestScheduler({
      autoThrottle: { maxPerHost: 2 },
    });
    const warmUp = await scheduler.acquire("https://site.test/warm");
    scheduler.observe("https://site.test/warm", 200, undefined);
    warmUp();
    const first = await scheduler.acquire("https://site.test/a");
    const second = await scheduler.acquire("https://site.test/b");
    expect(hostOf(scheduler, "site.test")?.activeRequests).toBe(2);
    first();
    second();
  });

  it("matches a status to the oldest unanswered request for the same URL", async () => {
    const scheduler = createRequestScheduler({
      autoThrottle: { maxPerHost: 4 },
    });
    await warm(scheduler, "https://site.test", 3);
    const first = await scheduler.acquireRequest("https://site.test/same", {
      owner,
    });
    const second = await scheduler.acquireRequest("https://site.test/same", {
      owner,
    });
    scheduler.observe("https://site.test/same", 200, undefined);
    first();
    expect(limitOf(scheduler)).toBe(3);
    // The second request never got a status of its own.
    second();
    expect(limitOf(scheduler)).toBe(1);
    // A second status for the same URL goes to the second request.
    await healthy(scheduler, "https://site.test/again");
    expect(limitOf(scheduler)).toBe(2);
    const third = await scheduler.acquireRequest("https://site.test/same", {
      owner,
    });
    const fourth = await scheduler.acquireRequest("https://site.test/same", {
      owner,
    });
    scheduler.observe("https://site.test/same", 200, undefined);
    scheduler.observe("https://site.test/same", 200, undefined);
    third();
    expect(limitOf(scheduler)).toBe(2);
    fourth();
    expect(limitOf(scheduler)).toBe(3);
    // A status for a URL with no lease updates host state only.
    scheduler.observe("https://site.test/gone", 200, undefined);
    expect(hostOf(scheduler, "site.test")).toMatchObject({
      lastStatus: 200,
      activeRequests: 0,
    });
  });

  it("reports the oldest request in flight as the active URL", async () => {
    const scheduler = createRequestScheduler({
      autoThrottle: { maxPerHost: 2 },
    });
    await warm(scheduler, "https://site.test", 2);
    const first = await scheduler.acquireRequest("https://site.test/a", {
      owner,
    });
    const second = await scheduler.acquireRequest("https://site.test/b", {
      owner,
    });
    expect(hostOf(scheduler, "site.test")?.activeUrl).toBe(
      "https://site.test/a",
    );
    first();
    expect(hostOf(scheduler, "site.test")).toMatchObject({
      activeUrl: "https://site.test/b",
      activeRequests: 1,
    });
    second();
    expect(hostOf(scheduler, "site.test")).toMatchObject({
      activeUrl: null,
      activeSince: null,
      activeRequests: 0,
    });
  });

  it("counts a request held exactly slowMs as healthy and one past it as strain", async () => {
    vi.useFakeTimers();
    const scheduler = createRequestScheduler({
      autoThrottle: { maxPerHost: 4, slowMs: 500 },
    });
    const edge = await scheduler.acquireRequest("https://site.test/edge", {
      owner,
    });
    scheduler.observe("https://site.test/edge", 200, undefined);
    vi.advanceTimersByTime(500);
    edge();
    expect(limitOf(scheduler)).toBe(2);
    const past = await scheduler.acquireRequest("https://site.test/past", {
      owner,
    });
    scheduler.observe("https://site.test/past", 200, undefined);
    vi.advanceTimersByTime(501);
    past();
    expect(limitOf(scheduler)).toBe(1);
  });

  it("treats a 403 to a borrowed User-Agent as a healthy answer", async () => {
    const scheduler = createRequestScheduler({
      autoThrottle: { maxPerHost: 2 },
    });
    const release = await scheduler.acquireRequest("https://site.test/bot", {
      owner,
    });
    scheduler.observe("https://site.test/bot", 403, undefined, {
      ownAgent: false,
    });
    release();
    expect(hostOf(scheduler, "site.test")).toMatchObject({
      stopped: false,
      hostLimit: 2,
    });
  });

  it("does not change the limit when a queued request is cancelled", async () => {
    const scheduler = createRequestScheduler({
      autoThrottle: { maxPerHost: 4 },
    });
    await warm(scheduler, "https://site.test", 2);
    const held = await Promise.all([
      scheduler.acquireRequest("https://site.test/a", { owner }),
      scheduler.acquireRequest("https://site.test/b", { owner }),
    ]);
    const controller = new AbortController();
    const queued = scheduler.acquireRequest(
      "https://site.test/c",
      { owner },
      controller.signal,
    );
    controller.abort();
    await expect(queued).rejects.toThrow();
    expect(limitOf(scheduler)).toBe(2);
    for (const release of held) release();
  });

  it("halves the limit when an admitted request is cancelled", async () => {
    const scheduler = createRequestScheduler({
      autoThrottle: { maxPerHost: 4 },
    });
    await warm(scheduler, "https://site.test", 2);
    const release = await scheduler.acquireRequest("https://site.test/a", {
      owner,
    });
    release();
    release();
    expect(limitOf(scheduler)).toBe(1);
  });

  it("keeps the limit out of exported state, so a new scheduler starts at one", async () => {
    const scheduler = createRequestScheduler({
      autoThrottle: { maxPerHost: 4 },
    });
    await warm(scheduler, "https://site.test", 3);
    const state = scheduler.exportState();
    expect(state[0]).not.toHaveProperty("hostLimit");
    const next = createRequestScheduler({
      state,
      autoThrottle: { maxPerHost: 4 },
    });
    expect(hostOf(next, "site.test")?.hostLimit).toBe(1);
  });

  it("accepts maxPerHost 1 as a scheduler that never adapts", async () => {
    const scheduler = createRequestScheduler({
      autoThrottle: { maxPerHost: 1 },
    });
    await warm(scheduler, "https://site.test", 4);
    expect(limitOf(scheduler)).toBe(1);
  });
});

describe("auto-throttle under random load", () => {
  it("never exceeds any limit and leaves nothing stuck", async () => {
    // A fixed-seed generator keeps the run deterministic.
    let seed = 0x5eed;
    const random = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
      return seed / 2 ** 31;
    };
    const maxPerHost = 3;
    const globalLimit = 5;
    const scheduler = createRequestScheduler({
      maxConcurrent: globalLimit,
      autoThrottle: { maxPerHost },
    });
    const hosts = ["one.test", "two.test", "three.test"];
    const owners = [{}, {}, {}, {}];
    const held: { url: string; release: () => void }[] = [];
    const settled: Promise<unknown>[] = [];
    let sent = 0;
    const check = () => {
      const sites = scheduler.snapshot();
      for (const site of sites) {
        expect(site.activeRequests).toBeLessThanOrEqual(maxPerHost);
        expect(site.hostLimit).toBeGreaterThanOrEqual(1);
        expect(site.hostLimit).toBeLessThanOrEqual(maxPerHost);
      }
      expect(
        sites.reduce((sum, site) => sum + site.activeRequests, 0),
      ).toBeLessThanOrEqual(globalLimit);
    };
    for (let step = 0; step < 600; step += 1) {
      if (random() < 0.55 || held.length === 0) {
        const host = hosts[Math.floor(random() * hosts.length)]!;
        const url = `https://${host}/${(sent += 1)}`;
        const owner = owners[Math.floor(random() * owners.length)]!;
        settled.push(
          scheduler.acquireRequest(url, { owner }).then((release) => {
            held.push({ url, release });
            return release;
          }),
        );
      } else {
        const [lease] = held.splice(Math.floor(random() * held.length), 1);
        const outcome = random();
        if (outcome < 0.6) scheduler.observe(lease!.url, 200, undefined);
        else if (outcome < 0.75) scheduler.observe(lease!.url, 404, undefined);
        else if (outcome < 0.9) scheduler.observe(lease!.url, 502, undefined);
        lease!.release();
      }
      await flush();
      check();
    }
    while (held.length > 0 || scheduler.snapshot().some((s) => s.waiting)) {
      for (const lease of held.splice(0)) {
        scheduler.observe(lease.url, 200, undefined);
        lease.release();
      }
      await flush();
      check();
    }
    await Promise.all(settled);
    expect(
      scheduler.snapshot().every((s) => s.activeRequests === 0 && !s.waiting),
    ).toBe(true);
  });
});

describe("auto-throttle through the fetcher, on failure", () => {
  it("halves the limit when the transport fails without an answer", async () => {
    const scheduler = createRequestScheduler({
      autoThrottle: { maxPerHost: 4 },
    });
    let fail = false;
    const transport: Transport = async () => {
      if (fail) throw Object.assign(new Error("reset"), { code: "ECONNRESET" });
      return {
        statusCode: 200,
        headers: {},
        body: {
          async *[Symbol.asyncIterator]() {
            yield new TextEncoder().encode("ok");
          },
          async dump() {},
        },
      };
    };
    const fetcher = createFetcherWith(
      {
        requestScheduler: scheduler,
        readyRequestScheduling: true,
        maxConcurrent: 4,
      },
      transport,
    );
    for (let i = 0; i < 3; i += 1)
      await fetcher.fetch({ url: `https://site.test/${i}` });
    expect(limitOf(scheduler)).toBe(3);
    fail = true;
    const result = await fetcher.fetch({ url: "https://site.test/reset" });
    expect(result.status).toBe(0);
    expect(limitOf(scheduler)).toBe(1);
  });

  it("matches each redirect hop's status to its own slot", async () => {
    const scheduler = createRequestScheduler({
      autoThrottle: { maxPerHost: 4 },
    });
    const transport: Transport = async (url) => ({
      statusCode: url.endsWith("/start") ? 301 : 200,
      headers: url.endsWith("/start") ? { location: "/end" } : {},
      body: {
        async *[Symbol.asyncIterator]() {
          yield new TextEncoder().encode("ok");
        },
        async dump() {},
      },
    });
    const fetcher = createFetcherWith(
      {
        requestScheduler: scheduler,
        readyRequestScheduling: true,
        maxConcurrent: 4,
      },
      transport,
    );
    const result = await fetcher.fetch({ url: "https://site.test/start" });
    expect(result.status).toBe(200);
    // Two healthy hops: 1 -> 2 after the first, then one of two toward 3.
    expect(limitOf(scheduler)).toBe(2);
    expect(hostOf(scheduler, "site.test")?.activeRequests).toBe(0);
  });
});

describe("auto-throttle after a gap", () => {
  /** Raise a host to `slots` while letting each gap pass, with fake time. */
  async function warmWithGap(
    scheduler: DefaultRequestScheduler,
    origin: string,
    slots: number,
    gapMs: number,
  ): Promise<void> {
    for (let i = 0; i < (slots * (slots - 1)) / 2; i += 1) {
      await vi.advanceTimersByTimeAsync(gapMs);
      await healthy(scheduler, `${origin}/warm-${i}`);
    }
  }

  function queue(
    scheduler: DefaultRequestScheduler,
    urls: string[],
    admission: { owner: object; maxConcurrent?: number } = { owner },
  ): (() => void)[] {
    const held: (() => void)[] = [];
    for (const url of urls)
      void scheduler.acquireRequest(url, admission).then((release) => {
        held.push(release);
        return release;
      });
    return held;
  }

  it("fills every free slot when the gap ends, without another event", async () => {
    vi.useFakeTimers();
    const scheduler = createRequestScheduler({
      gapMs: 1000,
      autoThrottle: { maxPerHost: 4 },
    });
    await warmWithGap(scheduler, "https://site.test", 4, 1000);
    expect(limitOf(scheduler)).toBe(4);
    // The last warm-up release started a gap; queue four inside it.
    const held = queue(
      scheduler,
      ["a", "b", "c", "d", "e"].map((path) => `https://site.test/${path}`),
    );
    await vi.advanceTimersByTimeAsync(999);
    expect(hostOf(scheduler, "site.test")).toMatchObject({
      activeRequests: 0,
      waiting: 5,
    });
    await vi.advanceTimersByTimeAsync(1);
    expect(hostOf(scheduler, "site.test")).toMatchObject({
      activeRequests: 4,
      waiting: 1,
    });
    expect(held).toHaveLength(4);
    for (const release of held.splice(0)) release();
  });

  it("starts only one request after a gap without auto-throttle", async () => {
    vi.useFakeTimers();
    const scheduler = createRequestScheduler({ gapMs: 1000 });
    await healthy(scheduler, "https://site.test/warm");
    const held = queue(scheduler, [
      "https://site.test/a",
      "https://site.test/b",
    ]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(hostOf(scheduler, "site.test")).toMatchObject({
      activeRequests: 1,
      waiting: 1,
    });
    held[0]!();
    await vi.advanceTimersByTimeAsync(1000);
    expect(held).toHaveLength(2);
    held[1]!();
  });

  it("alternates hosts while the global cap binds", async () => {
    vi.useFakeTimers();
    const scheduler = createRequestScheduler({
      gapMs: 1000,
      maxConcurrent: 3,
      autoThrottle: { maxPerHost: 4 },
    });
    await warmWithGap(scheduler, "https://one.test", 4, 1000);
    await warmWithGap(scheduler, "https://two.test", 4, 1000);
    // Start both gaps at the same moment.
    await vi.advanceTimersByTimeAsync(1000);
    await healthy(scheduler, "https://one.test/sync");
    await healthy(scheduler, "https://two.test/sync");
    const held = queue(scheduler, [
      ...["a", "b", "c"].map((path) => `https://one.test/${path}`),
      ...["a", "b", "c"].map((path) => `https://two.test/${path}`),
    ]);
    await vi.advanceTimersByTimeAsync(1000);
    const one = hostOf(scheduler, "one.test")!.activeRequests;
    const two = hostOf(scheduler, "two.test")!.activeRequests;
    expect(one + two).toBe(3);
    expect(Math.abs(one - two)).toBe(1);
    for (const release of held.splice(0)) release();
  });

  it("stops at the owner cap when the host has more room", async () => {
    vi.useFakeTimers();
    const scheduler = createRequestScheduler({
      gapMs: 1000,
      autoThrottle: { maxPerHost: 4 },
    });
    await warmWithGap(scheduler, "https://site.test", 4, 1000);
    const scan = { owner: {}, maxConcurrent: 2 };
    const held = queue(
      scheduler,
      ["a", "b", "c", "d"].map((path) => `https://site.test/${path}`),
      scan,
    );
    await vi.advanceTimersByTimeAsync(1000);
    expect(hostOf(scheduler, "site.test")).toMatchObject({
      activeRequests: 2,
      waiting: 2,
    });
    for (const release of held.splice(0)) release();
  });
});

describe("auto-throttle wake and cooldown", () => {
  async function warmAt(
    scheduler: DefaultRequestScheduler,
    origin: string,
    slots: number,
  ): Promise<void> {
    for (let i = 0; i < (slots * (slots - 1)) / 2; i += 1) {
      await vi.advanceTimersByTimeAsync(60_000);
      await healthy(scheduler, `${origin}/warm-${i}`);
    }
  }

  function hold(
    scheduler: DefaultRequestScheduler,
    urls: string[],
  ): { held: (() => void)[]; failed: unknown[] } {
    const held: (() => void)[] = [];
    const failed: unknown[] = [];
    for (const url of urls)
      scheduler.acquireRequest(url, { owner }).then(
        (release) => held.push(release),
        (error: unknown) => failed.push(error),
      );
    return { held, failed };
  }

  it("fills two hosts whose gaps end at different times with one timer", async () => {
    vi.useFakeTimers();
    const scheduler = createRequestScheduler({
      gapMs: 1000,
      autoThrottle: { maxPerHost: 3 },
    });
    await warmAt(scheduler, "https://early.test", 3);
    await warmAt(scheduler, "https://late.test", 3);
    await vi.advanceTimersByTimeAsync(60_000);
    await healthy(scheduler, "https://early.test/sync");
    await vi.advanceTimersByTimeAsync(400);
    await healthy(scheduler, "https://late.test/sync");
    const { held } = hold(scheduler, [
      ...["a", "b", "c"].map((path) => `https://early.test/${path}`),
      ...["a", "b", "c"].map((path) => `https://late.test/${path}`),
    ]);
    await vi.advanceTimersByTimeAsync(600);
    expect(hostOf(scheduler, "early.test")?.activeRequests).toBe(3);
    expect(hostOf(scheduler, "late.test")?.activeRequests).toBe(0);
    await vi.advanceTimersByTimeAsync(400);
    expect(hostOf(scheduler, "late.test")?.activeRequests).toBe(3);
    expect(vi.getTimerCount()).toBe(0);
    for (const release of held.splice(0)) release();
  });

  it("fills every slot when a 503 cooldown ends", async () => {
    vi.useFakeTimers();
    const scheduler = createRequestScheduler({
      autoThrottle: { maxPerHost: 4 },
    });
    await warmAt(scheduler, "https://site.test", 4);
    // One 503 halves the limit to 2 and starts the default 60 s cooldown.
    await healthy(scheduler, "https://site.test/busy", 503);
    expect(limitOf(scheduler)).toBe(2);
    const { held } = hold(
      scheduler,
      ["a", "b", "c"].map((path) => `https://site.test/${path}`),
    );
    expect(hostOf(scheduler, "site.test")?.activeRequests).toBe(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(hostOf(scheduler, "site.test")).toMatchObject({
      activeRequests: 2,
      waiting: 1,
    });
    for (const release of held.splice(0)) release();
  });

  it("fills every slot when an imported cooldown ends", async () => {
    vi.useFakeTimers();
    const scheduler = createRequestScheduler({
      autoThrottle: { maxPerHost: 4 },
    });
    await warmAt(scheduler, "https://site.test", 3);
    scheduler.importState([
      {
        host: "site.test",
        readyAt: Date.now() + 2000,
        stopped: false,
        stopReason: null,
        unavailable: 0,
        lastStatus: 200,
      },
    ]);
    const { held } = hold(
      scheduler,
      ["a", "b", "c", "d"].map((path) => `https://site.test/${path}`),
    );
    await vi.advanceTimersByTimeAsync(1999);
    expect(hostOf(scheduler, "site.test")?.activeRequests).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(hostOf(scheduler, "site.test")).toMatchObject({
      activeRequests: 3,
      waiting: 1,
    });
    for (const release of held.splice(0)) release();
  });

  it("rejects every waiter when a host stops during its gap", async () => {
    vi.useFakeTimers();
    const scheduler = createRequestScheduler({
      gapMs: 1000,
      autoThrottle: { maxPerHost: 4 },
    });
    await warmAt(scheduler, "https://site.test", 4);
    const { held, failed } = hold(
      scheduler,
      ["a", "b", "c"].map((path) => `https://site.test/${path}`),
    );
    scheduler.observe("https://site.test/late", 429, undefined);
    await vi.advanceTimersByTimeAsync(1000);
    expect(held).toHaveLength(0);
    expect(failed).toHaveLength(3);
    expect(failed.every((error) => error instanceof HostStoppedError)).toBe(
      true,
    );
    expect(vi.getTimerCount()).toBe(0);
  });

  it("fills the remaining slots when one waiter is cancelled during the gap", async () => {
    vi.useFakeTimers();
    const scheduler = createRequestScheduler({
      gapMs: 1000,
      autoThrottle: { maxPerHost: 4 },
    });
    await warmAt(scheduler, "https://site.test", 4);
    const controller = new AbortController();
    const cancelled = scheduler.acquireRequest(
      "https://site.test/cancelled",
      { owner },
      controller.signal,
    );
    const { held } = hold(
      scheduler,
      ["a", "b", "c", "d"].map((path) => `https://site.test/${path}`),
    );
    controller.abort("not an error");
    await expect(cancelled).rejects.toThrow("Request cancelled");
    await vi.advanceTimersByTimeAsync(1000);
    expect(hostOf(scheduler, "site.test")).toMatchObject({
      activeRequests: 4,
      waiting: 0,
    });
    for (const release of held.splice(0)) release();
  });

  it("ignores an abort after the request was admitted", async () => {
    const scheduler = createRequestScheduler({
      autoThrottle: { maxPerHost: 2 },
    });
    const controller = new AbortController();
    const release = await scheduler.acquireRequest(
      "https://site.test/a",
      { owner },
      controller.signal,
    );
    controller.abort();
    expect(hostOf(scheduler, "site.test")?.activeRequests).toBe(1);
    scheduler.observe("https://site.test/a", 200, undefined);
    release();
    expect(limitOf(scheduler)).toBe(2);
  });
});

describe("auto-throttle work conservation under random load", () => {
  it("never leaves a ready host below its limit while work waits", async () => {
    vi.useFakeTimers();
    let seed = 0xc0ffee;
    const random = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
      return seed / 2 ** 31;
    };
    const globalLimit = 6;
    const scheduler = createRequestScheduler({
      gapMs: 250,
      maxConcurrent: globalLimit,
      autoThrottle: { maxPerHost: 4, slowMs: 2000 },
    });
    const hosts = ["one.test", "two.test", "three.test"];
    const held: { url: string; release: () => void }[] = [];
    let sent = 0;
    const check = () => {
      const sites = scheduler.snapshot();
      const total = sites.reduce((sum, site) => sum + site.activeRequests, 0);
      expect(total).toBeLessThanOrEqual(globalLimit);
      for (const site of sites) {
        expect(site.activeRequests).toBeLessThanOrEqual(4);
        if (site.waiting > 0 && site.readyAt <= Date.now() && !site.stopped)
          expect(
            site.activeRequests >= site.hostLimit || total >= globalLimit,
          ).toBe(true);
      }
    };
    for (let step = 0; step < 800; step += 1) {
      const roll = random();
      if (roll < 0.45 || held.length === 0) {
        const url = `https://${hosts[Math.floor(random() * 3)]}/${(sent += 1)}`;
        void scheduler.acquireRequest(url, { owner }).then((release) => {
          held.push({ url, release });
          return release;
        });
      } else if (roll < 0.8) {
        const [lease] = held.splice(Math.floor(random() * held.length), 1);
        const outcome = random();
        if (outcome < 0.7) scheduler.observe(lease!.url, 200, undefined);
        else if (outcome < 0.85) scheduler.observe(lease!.url, 500, undefined);
        lease!.release();
      }
      await vi.advanceTimersByTimeAsync(Math.floor(random() * 400));
      check();
    }
    while (held.length > 0 || scheduler.snapshot().some((s) => s.waiting)) {
      for (const lease of held.splice(0)) {
        scheduler.observe(lease.url, 200, undefined);
        lease.release();
      }
      await vi.advanceTimersByTimeAsync(300);
      check();
    }
    expect(scheduler.snapshot().every((s) => s.activeRequests === 0)).toBe(
      true,
    );
  });
});
