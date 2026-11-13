import { describe, expect, it } from "vitest";
import { createRequestScheduler } from "./request-scheduler";

const origin = "https://example.test";
async function warm(scheduler: ReturnType<typeof createRequestScheduler>) {
  for (let i = 0; i < 6; i++) {
    const release = await scheduler.acquire(origin);
    scheduler.observe(origin, 200, undefined);
    release();
  }
}

describe("origin transport admission", () => {
  it.each([0, 1, 2, 4, 10])(
    "bounds ready grants at capacity %s",
    async (capacity) => {
      const scheduler = createRequestScheduler({
        originCapacity: true,
        maxConcurrent: 32,
        autoThrottle: { maxPerHost: 4 },
      });
      await warm(scheduler);
      scheduler.updateOriginCapacity(origin, capacity);
      const abort = new AbortController();
      const releases: Array<() => void> = [];
      const work = Array.from({ length: 6 }, (_, i) =>
        scheduler
          .acquireRequest(
            `${origin}/${i}`,
            { owner: {}, maxConcurrent: 4 },
            abort.signal,
          )
          .then(
            (release) => releases.push(release),
            () => undefined,
          ),
      );
      await Promise.resolve();
      expect(releases).toHaveLength(Math.min(capacity, 4));
      expect(scheduler.snapshot()[0]?.origins).toEqual([
        { origin, capacity, activeRequests: Math.min(capacity, 4) },
      ]);
      abort.abort();
      releases.forEach((release) => release());
      await Promise.all(work);
      expect(scheduler.snapshot()[0]?.activeRequests).toBe(0);
    },
  );

  it("defaults unknown to one and resets capacity without cancelling old leases", async () => {
    const scheduler = createRequestScheduler({
      originCapacity: true,
      autoThrottle: { maxPerHost: 4 },
    });
    await warm(scheduler);
    const owner = {};
    const first = await scheduler.acquireRequest(origin, { owner });
    let admitted = false;
    const second = scheduler
      .acquireRequest(origin, { owner })
      .then((release) => {
        admitted = true;
        return release;
      });
    await Promise.resolve();
    expect(admitted).toBe(false);
    scheduler.updateOriginCapacity(origin, 4);
    const releaseSecond = await second;
    scheduler.updateOriginCapacity(origin, null);
    let thirdStarted = false;
    const third = scheduler
      .acquireRequest(origin, { owner })
      .then((release) => {
        thirdStarted = true;
        return release;
      });
    first();
    await Promise.resolve();
    expect(thirdStarted).toBe(false);
    releaseSecond();
    (await third)();
  });

  it("holds origin waiting outside global and owner permits, with independent apex/www origins", async () => {
    const scheduler = createRequestScheduler({
      originCapacity: true,
      maxConcurrent: 1,
      autoThrottle: { maxPerHost: 4 },
    });
    await warm(scheduler);
    scheduler.updateOriginCapacity(origin, 0);
    const abort = new AbortController();
    const owner = {};
    const blocked = scheduler.acquireRequest(
      origin,
      { owner, maxConcurrent: 1 },
      abort.signal,
    );
    const rejection = expect(blocked).rejects.toThrow();
    const www = await scheduler.acquireRequest("https://www.example.test", {
      owner: {},
      maxConcurrent: 1,
    });
    expect(scheduler.snapshot()[0]?.activeRequests).toBe(1);
    www();
    const other = await scheduler.acquireRequest("https://other.test", {
      owner,
      maxConcurrent: 1,
    });
    other();
    abort.abort();
    await rejection;
    expect(scheduler.exportState()[0]).not.toHaveProperty("origins");
  });

  it("respects owner limits and capacity changes 4 to 1 to 4", async () => {
    const scheduler = createRequestScheduler({
      originCapacity: true,
      autoThrottle: { maxPerHost: 4 },
    });
    await warm(scheduler);
    scheduler.updateOriginCapacity(origin, 4);
    const owner = {};
    const first = await scheduler.acquireRequest(origin, {
      owner,
      maxConcurrent: 2,
    });
    const second = await scheduler.acquireRequest(origin, {
      owner,
      maxConcurrent: 2,
    });
    let granted = false;
    const third = scheduler
      .acquireRequest(origin, { owner, maxConcurrent: 2 })
      .then((release) => {
        granted = true;
        return release;
      });
    scheduler.updateOriginCapacity(origin, 1);
    first();
    await Promise.resolve();
    expect(granted).toBe(false);
    scheduler.updateOriginCapacity(origin, 4);
    (await third)();
    second();
  });

  it("rejects unsupported and invalid updates", () => {
    expect(() =>
      createRequestScheduler().updateOriginCapacity(origin, 2),
    ).toThrow("not enabled");
    const scheduler = createRequestScheduler({ originCapacity: true });
    for (const value of [-1, NaN, Infinity, 1.5])
      expect(() => scheduler.updateOriginCapacity(origin, value)).toThrow(
        RangeError,
      );
  });

  it("forgets an idle origin at the default capacity and keeps a set one", async () => {
    const scheduler = createRequestScheduler({ originCapacity: true });
    const origins = () => scheduler.snapshot()[0]?.origins;
    const release = await scheduler.acquireRequest(`${origin}/a`, {
      owner: {},
    });
    expect(origins()).toEqual([{ origin, capacity: 1, activeRequests: 1 }]);
    release();
    expect(origins()).toEqual([]);
    scheduler.updateOriginCapacity(origin, 3);
    (await scheduler.acquireRequest(`${origin}/b`, { owner: {} }))();
    expect(origins()).toEqual([{ origin, capacity: 3, activeRequests: 0 }]);
  });

  it("forgets an idle origin reset to the default capacity", async () => {
    const scheduler = createRequestScheduler({ originCapacity: true });
    const origins = () => scheduler.snapshot()[0]?.origins;
    (await scheduler.acquireRequest(`${origin}/a`, { owner: {} }))();
    scheduler.updateOriginCapacity(origin, null);
    scheduler.updateOriginCapacity(`${origin}:8443`, 1);
    expect(origins()).toEqual([]);
    scheduler.updateOriginCapacity(origin, 2);
    expect(origins()).toEqual([{ origin, capacity: 2, activeRequests: 0 }]);
    scheduler.updateOriginCapacity(origin, null);
    expect(origins()).toEqual([]);
  });

  it("lets an owner reach a free origin past its request to a full one", async () => {
    const scheduler = createRequestScheduler({ originCapacity: true });
    const owner = {};
    scheduler.updateOriginCapacity("https://www.example.test", 0);
    let www = false;
    void scheduler
      .acquireRequest("https://www.example.test/a", { owner })
      .then(() => (www = true));
    const apex = await scheduler.acquireRequest("https://example.test/b", {
      owner,
    });
    expect(www).toBe(false);
    apex();
  });
});
