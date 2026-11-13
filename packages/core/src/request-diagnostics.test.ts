import { channel } from "node:diagnostics_channel";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createFetcherWith,
  type HttpExchange,
  type Transport,
} from "./fetcher";
import { MAX_RESPONSE_BODY_BYTES } from "./constants";
import { RequestAbortSource } from "./request-diagnostics";
import { createRequestScheduler } from "./request-scheduler";

const emit = (name: string, request: object, extra = {}) =>
  channel(`undici:${name}`).publish({ request, ...extra });
const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
afterEach(() => vi.useRealTimers());

function response(request: object, delay = 20) {
  return {
    statusCode: 200,
    headers: {},
    body: {
      async *[Symbol.asyncIterator]() {
        await sleep(delay);
        yield new TextEncoder().encode("ok");
        emit("request:trailers", request);
      },
      async dump() {},
    },
  };
}

describe("per-hop request diagnostics", () => {
  it("separates scheduler, transport, response and body waits without changing old clocks", async () => {
    vi.useFakeTimers();
    const scheduler = createRequestScheduler();
    const blocker = await scheduler.acquire("https://site.test/");
    const exchanges: HttpExchange[] = [];
    const transport: Transport = async () => {
      const request = {};
      emit("request:create", request);
      await sleep(30);
      emit("client:sendHeaders", request, { socket: { alpnProtocol: "h2" } });
      await sleep(40);
      emit("request:headers", request);
      return response(request);
    };
    const fetcher = createFetcherWith(
      {
        requestScheduler: scheduler,
        readyRequestScheduling: true,
        requestDiagnostics: true,
        onExchange: (exchange) => exchanges.push(exchange),
      },
      transport,
    );
    const pending = fetcher.fetch({ url: "https://site.test/" });
    await vi.advanceTimersByTimeAsync(100);
    blocker();
    await vi.advanceTimersByTimeAsync(90);
    const result = await pending;
    expect(result.totalMs).toBe(90);
    expect(exchanges[0]).toMatchObject({
      queueWaitMs: 100,
      totalMs: 90,
      diagnostics: {
        transportWaitMs: 30,
        responseWaitMs: 40,
        bodyMs: 20,
        connectionSetupMs: null,
        headersSent: true,
        protocol: "h2",
        bodyEnded: true,
        responseHeaders: true,
        abortSource: null,
      },
    });
  });

  it("correlates concurrent identical URLs by request identity", async () => {
    vi.useFakeTimers();
    let index = 0;
    const exchanges: HttpExchange[] = [];
    const transport: Transport = async () => {
      const delay = ++index === 1 ? 50 : 10;
      const request = {};
      emit("request:create", request);
      await sleep(delay);
      emit("client:sendHeaders", request, { socket: { alpnProtocol: false } });
      emit("request:headers", request);
      return response(request, 5);
    };
    const fetcher = createFetcherWith(
      {
        requestDiagnostics: true,
        onExchange: (exchange) => exchanges.push(exchange),
      },
      transport,
    );
    const pending = Promise.all([
      fetcher.fetch({ url: "https://site.test" }),
      fetcher.fetch({ url: "https://site.test" }),
    ]);
    await vi.advanceTimersByTimeAsync(60);
    await pending;
    expect(
      exchanges.map((entry) => [
        entry.fetchId,
        entry.diagnostics?.transportWaitMs,
      ]),
    ).toEqual([
      [2, 10],
      [1, 50],
    ]);
  });

  it.each([
    RequestAbortSource.Caller,
    RequestAbortSource.SiteBudget,
    RequestAbortSource.RequestTimeout,
  ])(
    "keeps the first abort source %s and leaves missing send evidence unknown",
    async (source) => {
      vi.useFakeTimers();
      const caller = new AbortController();
      const budget = new AbortController();
      const exchanges: HttpExchange[] = [];
      const transport: Transport = (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => {
              const reason: unknown = signal.reason;
              reject(
                reason instanceof Error ? reason : new Error("fixture abort"),
              );
            },
            {
              once: true,
            },
          );
        });
      const fetcher = createFetcherWith(
        {
          requestDiagnostics: true,
          budgetSignal: budget.signal,
          onExchange: (exchange) => exchanges.push(exchange),
        },
        transport,
      );
      const pending = fetcher.fetch({
        url: "https://site.test",
        timeout: 100,
        signal: AbortSignal.any([caller.signal, budget.signal]),
      });
      if (source === RequestAbortSource.RequestTimeout)
        await vi.advanceTimersByTimeAsync(101);
      else {
        await vi.advanceTimersByTimeAsync(10);
        (source === RequestAbortSource.Caller ? caller : budget).abort(
          new Error("same text"),
        );
        await vi.advanceTimersByTimeAsync(200);
      }
      await pending;
      caller.abort(new Error("later"));
      budget.abort(new Error("later"));
      expect(exchanges[0]?.diagnostics).toMatchObject({
        abortSource: source,
        headersSent: null,
        responseHeaders: false,
        responseWaitMs: null,
        protocol: null,
      });
    },
  );

  it("retains response evidence on body reset and labels transport failure", async () => {
    const exchanges: HttpExchange[] = [];
    const transport: Transport = async () => {
      const request = {};
      emit("request:create", request);
      emit("client:sendHeaders", request, { socket: { alpnProtocol: "h2" } });
      emit("request:headers", request);
      return {
        statusCode: 200,
        headers: {},
        body: {
          async *[Symbol.asyncIterator]() {
            yield new TextEncoder().encode("partial");
            emit("request:error", request);
            throw new Error("reset");
          },
          async dump() {},
        },
      };
    };
    const fetcher = createFetcherWith(
      {
        requestDiagnostics: true,
        onExchange: (exchange) => exchanges.push(exchange),
      },
      transport,
    );
    await fetcher.fetch({ url: "https://site.test" });
    expect(exchanges[0]?.diagnostics).toMatchObject({
      responseHeaders: true,
      bodyEnded: false,
      bodyMs: null,
      transportError: true,
      abortSource: RequestAbortSource.Transport,
    });
    expect(new TextDecoder().decode(exchanges[0]?.response?.body)).toBe(
      "partial",
    );
  });

  it("keeps diagnostics optional on custom and replay transports", async () => {
    const exchanges: HttpExchange[] = [];
    const fetcher = createFetcherWith(
      { onExchange: (exchange) => exchanges.push(exchange) },
      async () => response({}),
    );
    await fetcher.fetch({ url: "https://site.test" });
    expect(exchanges[0]).not.toHaveProperty("diagnostics");
  });
});

it("labels scheduler refusal without creating transport or response evidence", async () => {
  const scheduler = createRequestScheduler();
  scheduler.observe("https://site.test", 403, undefined);
  const exchanges: HttpExchange[] = [];
  const transport = vi.fn<Transport>();
  const fetcher = createFetcherWith(
    {
      requestScheduler: scheduler,
      readyRequestScheduling: true,
      requestDiagnostics: true,
      onExchange: (exchange) => exchanges.push(exchange),
    },
    transport,
  );
  await fetcher.fetch({ url: "https://site.test" });
  expect(transport).not.toHaveBeenCalled();
  expect(exchanges[0]?.diagnostics).toMatchObject({
    abortSource: RequestAbortSource.Scheduler,
    created: false,
    headersSent: null,
    responseHeaders: false,
  });
  expect(exchanges[0]).not.toHaveProperty("response");
});

it("keeps caller-first attribution while queued even if budget aborts with the same reason", async () => {
  const caller = new AbortController(),
    budget = new AbortController();
  const scheduler = createRequestScheduler();
  const release = await scheduler.acquire("https://site.test");
  const exchanges: HttpExchange[] = [];
  const transport = vi.fn<Transport>();
  const fetcher = createFetcherWith(
    {
      requestScheduler: scheduler,
      readyRequestScheduling: true,
      budgetSignal: budget.signal,
      requestDiagnostics: true,
      onExchange: (e) => exchanges.push(e),
    },
    transport,
  );
  const pending = fetcher.fetch({
    url: "https://site.test",
    signal: AbortSignal.any([caller.signal, budget.signal]),
  });
  const reason = new Error("shared reason");
  caller.abort(reason);
  budget.abort(reason);
  await pending;
  release();
  expect(exchanges[0]?.diagnostics?.abortSource).toBe(
    RequestAbortSource.Caller,
  );
  expect(transport).not.toHaveBeenCalled();
});

it("gives redirect hops separate diagnostics while preserving fetch identity", async () => {
  vi.useFakeTimers();
  const exchanges: HttpExchange[] = [];
  let index = 0;
  const transport: Transport = async () => {
    const request = {};
    const hop = index++;
    emit("request:create", request);
    await sleep((hop + 1) * 10);
    emit("client:sendHeaders", request, { socket: { alpnProtocol: false } });
    emit("request:headers", request);
    if (hop === 0)
      return {
        statusCode: 302,
        headers: { location: "/final" },
        body: {
          async *[Symbol.asyncIterator]() {},
          async dump() {
            emit("request:trailers", request);
          },
        },
      };
    return response(request, 5);
  };
  const fetcher = createFetcherWith(
    { requestDiagnostics: true, onExchange: (e) => exchanges.push(e) },
    transport,
  );
  const pending = fetcher.fetch({ url: "http://127.0.0.1/start" });
  await vi.advanceTimersByTimeAsync(40);
  await pending;
  expect(
    exchanges.map((e) => [e.fetchId, e.hop, e.diagnostics?.transportWaitMs]),
  ).toEqual([
    [1, 0, 10],
    [1, 1, 20],
  ]);
  expect(exchanges[0]?.diagnostics).not.toBe(exchanges[1]?.diagnostics);
});

it("keeps an intentional response limit distinct from a transport failure", async () => {
  const exchanges: HttpExchange[] = [];
  const transport: Transport = async () => {
    const request = {};
    emit("request:create", request);
    emit("client:sendHeaders", request, { socket: { alpnProtocol: "h2" } });
    emit("request:headers", request);
    return {
      statusCode: 200,
      headers: {},
      body: {
        async *[Symbol.asyncIterator]() {
          try {
            yield new Uint8Array(MAX_RESPONSE_BODY_BYTES + 1);
          } finally {
            emit("request:error", request);
          }
        },
        async dump() {},
      },
    };
  };
  const fetcher = createFetcherWith(
    { requestDiagnostics: true, onExchange: (e) => exchanges.push(e) },
    transport,
  );
  const result = await fetcher.fetch({
    url: "https://site.test",
    binary: true,
  });
  expect(result.status).toBe(200);
  expect(result.error).toBeUndefined();
  expect(result.bytes).toHaveLength(MAX_RESPONSE_BODY_BYTES);
  expect(exchanges[0]?.response).toMatchObject({
    status: 200,
    bodyRead: true,
    truncated: true,
  });
  expect(exchanges[0]?.diagnostics).toMatchObject({
    abortSource: RequestAbortSource.ResponseLimit,
    transportError: true,
    headersSent: true,
    responseHeaders: true,
    bodyEnded: false,
  });
});

it("retains unknown first source when pre-aborted inputs share a reason", async () => {
  const caller = new AbortController(),
    budget = new AbortController();
  const reason = new Error("shared reason");
  caller.abort(reason);
  budget.abort(reason);
  const exchanges: HttpExchange[] = [];
  const transport = vi.fn<Transport>();
  const fetcher = createFetcherWith(
    {
      requestDiagnostics: true,
      budgetSignal: budget.signal,
      onExchange: (exchange) => exchanges.push(exchange),
    },
    transport,
  );
  await fetcher.fetch({
    url: "https://site.test",
    signal: AbortSignal.any([caller.signal, budget.signal]),
  });
  expect(transport).not.toHaveBeenCalled();
  expect(exchanges[0]?.diagnostics?.abortSource).toBeNull();
  expect(exchanges[0]?.error).toBe("shared reason");
});

it("retains the first native error code when wrapper failure has none", async () => {
  const exchanges: HttpExchange[] = [];
  const transport: Transport = async () => {
    const request = {};
    emit("request:create", request);
    emit("request:error", request, { error: { code: "ECONNRESET" } });
    emit("request:error", request, { error: { code: "LATER_CODE" } });
    throw new Error("generic wrapper");
  };
  const fetcher = createFetcherWith(
    {
      requestDiagnostics: true,
      onExchange: (exchange) => exchanges.push(exchange),
    },
    transport,
  );
  const result = await fetcher.fetch({ url: "https://site.test" });
  expect(exchanges[0]?.diagnostics?.failureCode).toBe("ECONNRESET");
  expect(result.error).toBe("generic wrapper (ECONNRESET)");
  expect(fetcher.summary().failures).toHaveProperty("ECONNRESET", 1);
});

it("tracks native resends internally and leaves combined timing/protocol unknown", async () => {
  vi.useFakeTimers();
  const exchanges: HttpExchange[] = [];
  const transport: Transport = async () => {
    const request = {};
    emit("request:create", request);
    await sleep(10);
    emit("client:sendHeaders", request, { socket: { alpnProtocol: "h2" } });
    await sleep(10);
    emit("request:headers", request);
    emit("request:error", request, { error: { code: "FIRST_NATIVE" } });
    await sleep(10);
    emit("client:sendHeaders", request, { socket: { alpnProtocol: false } });
    await sleep(10);
    emit("request:headers", request);
    return response(request, 5);
  };
  const fetcher = createFetcherWith(
    {
      requestDiagnostics: true,
      onExchange: (exchange) => exchanges.push(exchange),
    },
    transport,
  );
  const pending = fetcher.fetch({ url: "https://site.test" });
  await vi.advanceTimersByTimeAsync(50);
  await pending;
  expect(exchanges[0]?.diagnostics).not.toHaveProperty("sendCount");
  expect(exchanges[0]?.diagnostics).toMatchObject({
    created: true,
    headersSent: true,
    responseHeaders: true,
    bodyEnded: true,
    transportError: true,
    failureCode: "FIRST_NATIVE",
    protocol: null,
    transportWaitMs: null,
    responseWaitMs: null,
    bodyMs: null,
  });
});
