import { channel } from "node:diagnostics_channel";
import { afterEach, expect, it, vi } from "vitest";
import {
  createFetcherWith,
  type HttpExchange,
  type Transport,
} from "./fetcher";
import { createRequestScheduler } from "./request-scheduler";
import { withScanEnvironment } from "./scan-environment";
import { RequestAbortSource } from "./request-diagnostics";
import { RedirectFailure } from "./types";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function redirectFixture() {
  let drained = false;
  let sends = 0;
  const transport: Transport = async () => {
    const request = {};
    channel("undici:request:create").publish({ request });
    channel("undici:client:sendHeaders").publish({
      request,
      socket: { alpnProtocol: "h2" },
    });
    channel("undici:request:headers").publish({ request });
    const first = sends++ === 0;
    return {
      statusCode: first ? 302 : 200,
      headers: first ? { location: "https://destination.test/end" } : {},
      body: {
        async *[Symbol.asyncIterator]() {
          yield new TextEncoder().encode("ok");
          channel("undici:request:trailers").publish({ request });
        },
        async dump() {
          drained = true;
          channel("undici:request:trailers").publish({ request });
        },
      },
    };
  };
  return { transport, drained: () => drained, sends: () => sends };
}

it("releases a ready redirect lease after draining, before DNS safety checks", async () => {
  const scheduler = createRequestScheduler({
    maxConcurrent: 1,
    originCapacity: true,
  });
  const fixture = redirectFixture();
  const seen: { drained: boolean; active: number }[] = [];
  const fetcher = createFetcherWith(
    { requestScheduler: scheduler, readyRequestScheduling: true },
    fixture.transport,
  );
  const result = await withScanEnvironment(
    {
      lookup: async () => {
        seen.push({
          drained: fixture.drained(),
          active: scheduler
            .snapshot()
            .reduce((n, host) => n + host.activeRequests, 0),
        });
        return { address: "203.0.113.1" };
      },
    },
    () => fetcher.fetch({ url: "https://source.test/start" }),
  );
  expect(result.status).toBe(200);
  expect(seen).toHaveLength(2);
  expect(seen).toEqual([
    { drained: true, active: 0 },
    { drained: true, active: 0 },
  ]);
});

it("does not label a drained redirect as timed out or send the next hop after its budget expired", async () => {
  vi.useFakeTimers();
  vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
    const controller = new AbortController();
    setTimeout(
      () =>
        controller.abort(
          new DOMException(
            "The operation was aborted due to timeout",
            "TimeoutError",
          ),
        ),
      ms,
    );
    return controller.signal;
  });
  const scheduler = createRequestScheduler({
    maxConcurrent: 1,
    originCapacity: true,
  });
  const fixture = redirectFixture();
  const exchanges: HttpExchange[] = [];
  const fetcher = createFetcherWith(
    {
      requestScheduler: scheduler,
      readyRequestScheduling: true,
      requestDiagnostics: true,
      onExchange: (exchange) => exchanges.push(exchange),
    },
    fixture.transport,
  );
  const pending = withScanEnvironment(
    {
      lookup: async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 30));
        return { address: "203.0.113.1" };
      },
    },
    () => fetcher.fetch({ url: "https://source.test/start", timeout: 10 }),
  );
  await vi.advanceTimersByTimeAsync(60);
  const result = await pending;
  expect(result.status).toBe(0);
  expect(result.error).toContain("timeout");
  expect(fixture.sends()).toBe(1);
  expect(exchanges[0]?.diagnostics).toMatchObject({
    bodyEnded: true,
    abortSource: null,
  });
  expect(exchanges[1]?.diagnostics).toMatchObject({
    headersSent: null,
    abortSource: RequestAbortSource.RequestTimeout,
  });
  expect(scheduler.snapshot().every((host) => host.activeRequests === 0)).toBe(
    true,
  );
});

it("still refuses a private redirect after releasing the completed response", async () => {
  const scheduler = createRequestScheduler({ maxConcurrent: 1 });
  const fixture = redirectFixture();
  const checked: string[] = [];
  const fetcher = createFetcherWith(
    { requestScheduler: scheduler, readyRequestScheduling: true },
    fixture.transport,
  );
  const result = await withScanEnvironment(
    {
      lookup: async (hostname) => {
        checked.push(hostname);
        return {
          address: hostname === "source.test" ? "203.0.113.1" : "127.0.0.1",
        };
      },
    },
    () => fetcher.fetch({ url: "https://source.test/start" }),
  );
  expect(result.error).toBe(RedirectFailure.Refused);
  expect(checked).toEqual(["source.test", "destination.test"]);
  expect(fixture.sends()).toBe(1);
  expect(fixture.drained()).toBe(true);
  expect(scheduler.snapshot().every((host) => host.activeRequests === 0)).toBe(
    true,
  );
});

it("does not send a redirect after the site budget aborts during DNS validation", async () => {
  const scheduler = createRequestScheduler({ maxConcurrent: 1 });
  const fixture = redirectFixture();
  const budget = new AbortController();
  const exchanges: HttpExchange[] = [];
  const fetcher = createFetcherWith(
    {
      requestScheduler: scheduler,
      readyRequestScheduling: true,
      requestDiagnostics: true,
      budgetSignal: budget.signal,
      onExchange: (exchange) => exchanges.push(exchange),
    },
    fixture.transport,
  );
  const result = await withScanEnvironment(
    {
      lookup: async () => {
        budget.abort(new Error("site budget expired"));
        return { address: "203.0.113.1" };
      },
    },
    () =>
      fetcher.fetch({
        url: "https://source.test/start",
        signal: budget.signal,
      }),
  );
  expect(result.error).toBe("site budget expired");
  expect(fixture.sends()).toBe(1);
  expect(exchanges[0]?.diagnostics?.abortSource).toBeNull();
  expect(exchanges[1]?.diagnostics?.abortSource).toBe(
    RequestAbortSource.SiteBudget,
  );
  expect(scheduler.snapshot().every((host) => host.activeRequests === 0)).toBe(
    true,
  );
});
