import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createFetcherWith,
  type HttpExchange,
  type Transport,
} from "./fetcher";
import { LogField } from "./logger";
import {
  createRequestScheduler,
  HOST_STOPPED_MESSAGE,
  type RequestAdmission,
  type RequestOutcome,
  type RequestScheduler,
} from "./request-scheduler";
import { captureLogs } from "./tests/capture-logs";

afterEach(() => vi.useRealTimers());

function body(text = "ok") {
  return {
    async *[Symbol.asyncIterator]() {
      yield new TextEncoder().encode(text);
    },
    async dump() {},
  };
}

const ok: Transport = async () => ({
  statusCode: 200,
  headers: {},
  body: body(),
});

/** A scheduler that admits at once and records every admission. */
function recordingScheduler(): RequestScheduler & {
  admissions: { url: string; admission: RequestAdmission }[];
  legacy: string[];
} {
  const admissions: { url: string; admission: RequestAdmission }[] = [];
  const legacy: string[] = [];
  return {
    admissions,
    legacy,
    async acquireRequest(url, admission) {
      admissions.push({ url, admission });
      return () => {};
    },
    async acquire(url) {
      legacy.push(url);
      return () => {};
    },
    observe() {},
  };
}

describe("fetcher ready admission: configuration", () => {
  it.each([1.5, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects maxConcurrent %s when ready admission is on",
    (maxConcurrent) => {
      expect(() =>
        createFetcherWith(
          {
            requestScheduler: createRequestScheduler(),
            readyRequestScheduling: true,
            maxConcurrent,
          },
          ok,
        ),
      ).toThrow(RangeError);
    },
  );

  it.each([0, -1, 1.5])(
    "keeps accepting maxConcurrent %s without ready admission",
    (maxConcurrent) => {
      expect(() =>
        createFetcherWith(
          { requestScheduler: createRequestScheduler(), maxConcurrent },
          ok,
        ),
      ).not.toThrow();
    },
  );

  it("passes one stable owner per fetcher and omits an unset limit", async () => {
    const scheduler = recordingScheduler();
    const first = createFetcherWith(
      { requestScheduler: scheduler, readyRequestScheduling: true },
      ok,
    );
    const second = createFetcherWith(
      {
        requestScheduler: scheduler,
        readyRequestScheduling: true,
        maxConcurrent: 3,
      },
      ok,
    );
    await first.fetch({ url: "https://site.test/a" });
    await first.fetch({ url: "https://site.test/b" });
    await second.fetch({ url: "https://site.test/c" });
    const [a, b, c] = scheduler.admissions;
    expect(a!.admission.owner).toBe(b!.admission.owner);
    expect(a!.admission.owner).not.toBe(c!.admission.owner);
    expect(a!.admission).not.toHaveProperty("maxConcurrent");
    expect(c!.admission.maxConcurrent).toBe(3);
    expect(scheduler.legacy).toEqual([]);
  });

  it("uses acquire, not acquireRequest, when ready admission is off", async () => {
    const scheduler = recordingScheduler();
    const fetcher = createFetcherWith({ requestScheduler: scheduler }, ok);
    await fetcher.fetch({ url: "https://site.test/a" });
    expect(scheduler.legacy).toEqual(["https://site.test/a"]);
    expect(scheduler.admissions).toEqual([]);
  });
});

describe("fetcher ready admission: limits", () => {
  it("hands every pending fetch to the scheduler instead of its own gate", async () => {
    const releases: (() => void)[] = [];
    const requested: string[] = [];
    const scheduler: RequestScheduler = {
      acquireRequest: (url) =>
        new Promise((resolve) => {
          requested.push(url);
          releases.push(() => resolve(() => {}));
        }),
      acquire: async () => () => {},
      observe() {},
    };
    const fetcher = createFetcherWith(
      {
        requestScheduler: scheduler,
        readyRequestScheduling: true,
        maxConcurrent: 1,
      },
      ok,
    );
    const pending = ["a", "b", "c"].map((path) =>
      fetcher.fetch({ url: `https://site.test/${path}` }),
    );
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
    // All three reach the scheduler; it alone enforces the limit of one.
    expect(requested).toHaveLength(3);
    for (const release of releases) release();
    await Promise.all(pending);
  });

  it("enforces the fetcher limit through the default scheduler", async () => {
    const scheduler = createRequestScheduler({
      autoThrottle: { maxPerHost: 4 },
    });
    let inFlight = 0;
    let peak = 0;
    const transport: Transport = async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 2));
      inFlight -= 1;
      return { statusCode: 200, headers: {}, body: body() };
    };
    const fetcher = createFetcherWith(
      {
        requestScheduler: scheduler,
        readyRequestScheduling: true,
        maxConcurrent: 2,
      },
      transport,
    );
    // Warm the host to four slots, then send six at once across two hosts.
    for (let i = 0; i < 6; i += 1)
      await fetcher.fetch({ url: `https://one.test/warm-${i}` });
    await Promise.all(
      ["a", "b", "c", "d", "e", "f"].map((path, i) =>
        fetcher.fetch({
          url: `https://${i % 2 ? "one" : "two"}.test/${path}`,
        }),
      ),
    );
    expect(peak).toBe(2);
  });
});

describe("fetcher ready admission: leases and evidence", () => {
  it("acquires each redirect hop on its own and records its wait", async () => {
    const scheduler = recordingScheduler();
    const exchanges: HttpExchange[] = [];
    const transport: Transport = async (url) =>
      url.endsWith("/start")
        ? { statusCode: 302, headers: { location: "/end" }, body: body("") }
        : { statusCode: 200, headers: {}, body: body() };
    const fetcher = createFetcherWith(
      {
        requestScheduler: scheduler,
        readyRequestScheduling: true,
        onExchange: (exchange) => exchanges.push(exchange),
      },
      transport,
    );
    const result = await fetcher.fetch({ url: "https://site.test/start" });
    expect(result.status).toBe(200);
    expect(scheduler.admissions.map(({ url }) => url)).toEqual([
      "https://site.test/start",
      "https://site.test/end",
    ]);
    expect(exchanges.map((exchange) => exchange.hop)).toEqual([0, 1]);
    expect(
      exchanges.every((exchange) => typeof exchange.queueWaitMs === "number"),
    ).toBe(true);
  });

  it("frees the host after a transport error", async () => {
    const scheduler = createRequestScheduler();
    const transport: Transport = async () => {
      throw Object.assign(new Error("reset"), { code: "ECONNRESET" });
    };
    const fetcher = createFetcherWith(
      { requestScheduler: scheduler, readyRequestScheduling: true },
      transport,
    );
    const result = await fetcher.fetch({ url: "https://site.test/a" });
    expect(result.status).toBe(0);
    expect(scheduler.snapshot()[0]).toMatchObject({
      activeRequests: 0,
      activeUrl: null,
    });
  });

  it("frees the host after a body that fails mid-read", async () => {
    const scheduler = createRequestScheduler();
    const transport: Transport = async () => ({
      statusCode: 200,
      headers: {},
      body: {
        // oxlint-disable-next-line require-yield
        async *[Symbol.asyncIterator]() {
          throw new Error("body broke");
        },
        async dump() {},
      },
    });
    const fetcher = createFetcherWith(
      { requestScheduler: scheduler, readyRequestScheduling: true },
      transport,
    );
    await fetcher.fetch({ url: "https://site.test/a" });
    expect(scheduler.snapshot()[0]?.activeRequests).toBe(0);
  });

  it("sends nothing to a stopped host and names the stop", async () => {
    const scheduler = createRequestScheduler();
    scheduler.observe("https://site.test/", 429, undefined);
    const transport = vi.fn(ok);
    const fetcher = createFetcherWith(
      { requestScheduler: scheduler, readyRequestScheduling: true },
      transport,
    );
    const result = await fetcher.fetch({ url: "https://site.test/a" });
    expect(transport).not.toHaveBeenCalled();
    expect(result.status).toBe(0);
    expect(result.error).toContain(HOST_STOPPED_MESSAGE);
  });

  it("logs the queue wait on a failed request and sums it in the summary", async () => {
    vi.useFakeTimers();
    const logs = captureLogs();
    try {
      const scheduler = createRequestScheduler();
      const blocker = await scheduler.acquire("https://site.test/held");
      const transport: Transport = async () => {
        throw Object.assign(new Error("refused"), { code: "ECONNREFUSED" });
      };
      const fetcher = createFetcherWith(
        { requestScheduler: scheduler, readyRequestScheduling: true },
        transport,
      );
      const pending = fetcher.fetch({ url: "https://site.test/a" });
      await vi.advanceTimersByTimeAsync(400);
      blocker();
      await pending;
      const failed = logs.lines.find(
        (line) => line["msg"] === "Request failed",
      );
      expect(failed?.[LogField.QueueWaitMs]).toBe(400);
      await fetcher.fetch({ url: "https://other.test/b" });
      expect(fetcher.summary().queueWaitMs).toBe(400);
    } finally {
      logs.restore();
    }
  });

  it("writes no queue wait for a fetcher without a scheduler", async () => {
    const exchanges: HttpExchange[] = [];
    const fetcher = createFetcherWith(
      { onExchange: (exchange) => exchanges.push(exchange) },
      ok,
    );
    await fetcher.fetch({ url: "https://site.test/a" });
    expect(fetcher.summary()).not.toHaveProperty("queueWaitMs");
    expect(exchanges[0]).not.toHaveProperty("queueWaitMs");
  });

  it("releases each hop with its own status, or as aborted", async () => {
    const outcomes: (RequestOutcome | undefined)[] = [];
    const scheduler: RequestScheduler = {
      async acquire() {
        return (outcome) => outcomes.push(outcome);
      },
      observe() {},
    };
    const hops: Transport = async (url) =>
      url.endsWith("/from")
        ? { statusCode: 301, headers: { location: "/to" }, body: body() }
        : { statusCode: 503, headers: {}, body: body() };
    const fetcher = createFetcherWith({ requestScheduler: scheduler }, hops);
    await fetcher.fetch({ url: "https://site.test/from" });
    expect(outcomes).toEqual([
      { status: 301, answeredAt: expect.any(Number), aborted: false },
      { status: 503, answeredAt: expect.any(Number), aborted: false },
    ]);

    outcomes.length = 0;
    const controller = new AbortController();
    const hang: Transport = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () =>
          reject(new Error("aborted", { cause: init.signal.reason })),
        );
        controller.abort(new Error("caller left"));
      });
    await createFetcherWith({ requestScheduler: scheduler }, hang).fetch({
      url: "https://site.test/slow",
      signal: controller.signal,
    });
    expect(outcomes).toEqual([{ status: null, aborted: true }]);
  });

  it("releases an answered hop as answered when its caller aborts the body", async () => {
    const outcomes: (RequestOutcome | undefined)[] = [];
    const scheduler: RequestScheduler = {
      async acquire() {
        return (outcome) => outcomes.push(outcome);
      },
      observe() {},
    };
    const controller = new AbortController();
    const cut: Transport = async () => ({
      statusCode: 500,
      headers: {},
      body: {
        async *[Symbol.asyncIterator]() {
          yield new TextEncoder().encode("partial");
          controller.abort(new Error("site budget"));
          throw new Error("aborted");
        },
        async dump() {},
      },
    });
    await createFetcherWith({ requestScheduler: scheduler }, cut).fetch({
      url: "https://site.test/busy",
      signal: controller.signal,
    });
    expect(outcomes).toEqual([
      { status: 500, answeredAt: expect.any(Number), aborted: false },
    ]);
  });
});
