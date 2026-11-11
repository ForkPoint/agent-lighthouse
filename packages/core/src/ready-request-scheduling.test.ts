import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createFetcherWith,
  type HttpExchange,
  type Transport,
} from "./fetcher";
import { createRequestScheduler } from "./request-scheduler";
import { createReplay } from "./replay";
import { LogField } from "./logger";
import { captureLogs } from "./tests/capture-logs";
import type { RequestScheduler } from "./request-scheduler";

const response: Transport = async () => ({
  statusCode: 200,
  headers: {},
  body: {
    async *[Symbol.asyncIterator]() {
      yield new TextEncoder().encode("ok");
    },
    async dump() {},
  },
  timing: { ttfbMs: 7, totalMs: 11 },
});

afterEach(() => vi.useRealTimers());

describe("ready-request opt-in", () => {
  it("excludes queued time from deadlines and records queued aborts without HTTP evidence", async () => {
    vi.useFakeTimers();
    const logs = captureLogs();
    const scheduler = createRequestScheduler();
    const release = await scheduler.acquire("https://shared.test/held");
    const exchanges: HttpExchange[] = [];
    const fetcher = createFetcherWith(
      {
        requestScheduler: scheduler,
        readyRequestScheduling: true,
        maxConcurrent: 1,
        onExchange: (exchange) => exchanges.push(exchange),
      },
      response,
    );
    const pending = fetcher.fetch({
      url: "https://shared.test/queued",
      timeout: 10,
    });
    await vi.advanceTimersByTimeAsync(1000);
    release();
    expect((await pending).status).toBe(200);
    expect(exchanges[0]?.queueWaitMs).toBe(1000);
    expect(fetcher.summary().queueWaitMs).toBe(1000);
    expect(
      logs.lines.find((line) => line["msg"] === "Request finished")?.[
        LogField.QueueWaitMs
      ],
    ).toBe(1000);
    logs.restore();
    const blocker = await scheduler.acquire("https://abort.test/held");
    const controller = new AbortController();
    const aborted = fetcher.fetch({
      url: "https://abort.test/queued",
      signal: controller.signal,
    });
    controller.abort(new Error("site deadline"));
    const result = await aborted;
    expect(result.status).toBe(0);
    expect(exchanges.at(-1)?.response).toBeUndefined();
    expect(exchanges.at(-1)?.error).toContain("site deadline");
    expect(
      scheduler.snapshot().find((site) => site.host === "abort.test")
        ?.activeUrl,
    ).toBe("https://abort.test/held");
    blocker();
  });
  it.each([false, true])(
    "compares blocked-host ordering deterministically: ready=%s",
    async (readyRequestScheduling) => {
      const scheduler = createRequestScheduler();
      const blocker = await scheduler.acquire("https://shared.test/held");
      const exchanges: HttpExchange[] = [];
      const fetcher = createFetcherWith(
        {
          requestScheduler: scheduler,
          readyRequestScheduling,
          maxConcurrent: 1,
          onExchange: (exchange) => exchanges.push(exchange),
        },
        response,
      );
      const order: string[] = [];
      const shared = fetcher
        .fetch({ url: "https://shared.test/queued" })
        .then((result) => {
          order.push("shared");
          return result;
        });
      const other = fetcher
        .fetch({ url: "https://ready.test/queued" })
        .then((result) => {
          order.push("ready");
          return result;
        });
      // Drain promises without timers or live requests.
      for (let i = 0; i < 30; i++) await Promise.resolve();
      expect(order).toEqual(readyRequestScheduling ? ["ready"] : []);
      blocker();
      const results = await Promise.all([shared, other]);
      expect(order).toEqual(
        readyRequestScheduling ? ["ready", "shared"] : ["shared", "ready"],
      );
      expect(
        results.map(({ ttfbMs, totalMs }) => ({ ttfbMs, totalMs })),
      ).toEqual([
        { ttfbMs: 7, totalMs: 11 },
        { ttfbMs: 7, totalMs: 11 },
      ]);
      expect(
        exchanges.every((exchange) => typeof exchange.queueWaitMs === "number"),
      ).toBe(true);
      expect(fetcher.summary().queueWaitMs).toBeGreaterThanOrEqual(0);
      const replay = createReplay(exchanges);
      const replayed = await replay.fetcher.fetch({
        url: "https://ready.test/queued",
      });
      expect(replayed.ttfbMs).toBe(7);
      expect(replayed.totalMs).toBe(11);
      expect(replay.misses()).toEqual([]);
      expect(
        scheduler.snapshot().every((site) => site.activeUrl === null),
      ).toBe(true);
    },
  );

  it("rejects opt-in without combined admission and rejects invalid owner limits", () => {
    expect(() =>
      createFetcherWith({ readyRequestScheduling: true }, response),
    ).toThrow("acquireRequest");
    const invalid = {
      acquire: async () => () => {},
      observe() {},
      acquireRequest: true,
    } as unknown as RequestScheduler;
    expect(() =>
      createFetcherWith(
        { readyRequestScheduling: true, requestScheduler: invalid },
        response,
      ),
    ).toThrow("acquireRequest");
    expect(() =>
      createFetcherWith(
        {
          requestScheduler: createRequestScheduler(),
          readyRequestScheduling: true,
          maxConcurrent: 0,
        },
        response,
      ),
    ).toThrow(RangeError);
  });
});

it("preserves the legacy gate and acquire-only custom scheduler", async () => {
  let releaseTransport!: () => void;
  const held = new Promise<void>((resolve) => {
    releaseTransport = resolve;
  });
  const acquire = vi.fn(async () => () => {});
  const scheduler: RequestScheduler = { acquire, observe() {} };
  let sends = 0;
  const transport: Transport = async (...args) => {
    sends += 1;
    if (sends === 1) await held;
    return response(...args);
  };
  const fetcher = createFetcherWith(
    {
      requestScheduler: scheduler,
      readyRequestScheduling: false,
      maxConcurrent: 1,
    },
    transport,
  );
  const first = fetcher.fetch({ url: "https://one.test/" });
  const second = fetcher.fetch({ url: "https://two.test/" });
  for (let i = 0; i < 10; i++) await Promise.resolve();
  expect(sends).toBe(1);
  expect(acquire).toHaveBeenCalledTimes(1);
  releaseTransport();
  await Promise.all([first, second]);
  expect(sends).toBe(2);
  expect(acquire).toHaveBeenCalledTimes(2);
});
