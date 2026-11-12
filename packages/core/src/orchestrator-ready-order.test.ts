import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAgent } from "undici";
import { runScan } from "./orchestrator";
import { createRequestScheduler } from "./request-scheduler";
import { RequestAbortSource } from "./request-diagnostics";
import type { HttpExchange } from "./fetcher";
import { defaultOriginCache } from "./origin-cache";

vi.mock("./audits/operability-safety/runner", () => ({
  runA11yForHtml: vi.fn(async () => ({})),
  A11Y_RULES: [],
}));

const origin = "https://example.test";
const home = `<html><head><title>Home</title></head><body><main><h1>Home</h1><p>${"Home content. ".repeat(80)}</p></main></body></html>`;
beforeEach(() => defaultOriginCache.clear());

function fixture(refuse: string | undefined, delay = 0) {
  const dispatcher = new MockAgent();
  dispatcher.disableNetConnect();
  const calls: string[] = [];
  const pool = dispatcher.get(origin);
  for (const path of ["/robots.txt", "/", "/en/", "/item", "/llms.txt"]) {
    const code =
      path === refuse
        ? 429
        : path === "/"
          ? 302
          : ["/item", "/en/"].includes(path)
            ? 200
            : 404;
    const reply = pool.intercept({ path, method: "GET" }).reply(() => {
      calls.push(path);
      return {
        statusCode: code,
        data: code === 200 ? home : "",
        responseOptions: {
          headers:
            path === "/" && code === 302
              ? { location: "/en/" }
              : { "content-type": "text/html" },
        },
      };
    });
    if (path === "/en/" && delay) reply.delay(delay);
    reply.persist();
  }
  pool
    .intercept({ path: () => true, method: () => true })
    .reply((options) => {
      calls.push(options.path);
      return { statusCode: 404, data: "" };
    })
    .persist();
  return { dispatcher, calls };
}

const lookup = async () => ({ address: "93.184.216.34", family: 4 });

describe("ready scan essential evidence order", () => {
  it("completes redirected homepage before an optional root refusal", async () => {
    const { dispatcher, calls } = fixture("/llms.txt", 25);
    const exchanges: HttpExchange[] = [];
    try {
      await runScan(origin, {
        dispatcher,
        lookup,
        readyRequestScheduling: true,
        requestDiagnostics: true,
        onExchange: (e) => exchanges.push(e),
        requestScheduler: createRequestScheduler({
          autoThrottle: { maxPerHost: 4 },
        }),
        maxConcurrent: 4,
      });
      expect(calls.slice(0, 3)).toEqual(["/robots.txt", "/", "/en/"]);
      expect(calls.indexOf("/llms.txt")).toBeGreaterThan(calls.indexOf("/en/"));
      expect(
        exchanges.find((e) => e.request.url === `${origin}/en/`)?.response,
      ).toMatchObject({ status: 200, bodyRead: true });
      expect(exchanges.length).toBeGreaterThan(0);
      expect(
        exchanges.every((exchange) => exchange.diagnostics !== undefined),
      ).toBe(true);
      expect(
        exchanges.find((exchange) => exchange.request.url === `${origin}/en/`)
          ?.diagnostics?.abortSource,
      ).toBeNull();
    } finally {
      await dispatcher.close();
    }
  });

  it.each(["/robots.txt", "/"])(
    "stops sends after refusal on %s",
    async (refuse) => {
      const { dispatcher, calls } = fixture(refuse);
      try {
        await runScan(origin, {
          dispatcher,
          lookup,
          readyRequestScheduling: true,
          requestScheduler: createRequestScheduler({
            autoThrottle: { maxPerHost: 4 },
          }),
          maxConcurrent: 4,
        });
        expect(calls).toEqual(
          refuse === "/robots.txt" ? ["/robots.txt"] : ["/robots.txt", "/"],
        );
      } finally {
        await dispatcher.close();
      }
    },
  );

  it.each([false, true])(
    "completes origin homepage before roots for subpages with target reuse %s",
    async (reuse) => {
      const { dispatcher, calls } = fixture(undefined, 20);
      const exchanges: HttpExchange[] = [];
      try {
        await runScan(`${origin}/item`, {
          dispatcher,
          lookup,
          readyRequestScheduling: true,
          onExchange: (e) => exchanges.push(e),
          requestScheduler: createRequestScheduler({
            autoThrottle: { maxPerHost: 4 },
          }),
          maxConcurrent: 4,
          ...(reuse && {
            targetPage: {
              url: `${origin}/item`,
              finalUrl: `${origin}/item`,
              status: 200,
              headers: { "content-type": "text/html" },
              body: home,
              ttfbMs: 1,
              totalMs: 1,
              contentType: "text/html",
              contentLength: home.length,
            },
          }),
        });
        expect(calls.indexOf("/en/")).toBeLessThan(calls.indexOf("/llms.txt"));
        expect(calls.slice(0, reuse ? 3 : 4)).toEqual(
          reuse
            ? ["/robots.txt", "/", "/en/"]
            : ["/robots.txt", "/item", "/", "/en/"],
        );
        expect(
          exchanges.find((e) => e.request.url === `${origin}/en/`)?.response,
        ).toMatchObject({ status: 200, bodyRead: true });
      } finally {
        await dispatcher.close();
      }
    },
  );

  it("ends a slow homepage on the site budget before sending optional roots", async () => {
    const { dispatcher, calls } = fixture(undefined, 200);
    const exchanges: HttpExchange[] = [];
    try {
      const report = await runScan(origin, {
        dispatcher,
        lookup,
        timeoutMs: 40,
        readyRequestScheduling: true,
        requestDiagnostics: true,
        onExchange: (exchange) => exchanges.push(exchange),
        requestScheduler: createRequestScheduler({
          autoThrottle: { maxPerHost: 4 },
        }),
        maxConcurrent: 4,
      });
      expect(report.conditions?.budget?.exhausted).toBe(true);
      expect(calls).not.toContain("/llms.txt");
      expect(
        exchanges.find((exchange) => exchange.request.url === `${origin}/en/`)
          ?.diagnostics?.abortSource,
      ).toBe(RequestAbortSource.SiteBudget);
    } finally {
      await dispatcher.close();
    }
  });
});

it("rejects diagnostics configuration for a supplied custom fetcher", async () => {
  const fetcher = {
    fetch: vi.fn(),
    summary: () => ({ requests: 0, statuses: {}, failures: {}, open: [] }),
  };
  await expect(
    runScan(origin, { fetcher, requestDiagnostics: true }),
  ).rejects.toThrow("requestDiagnostics cannot configure a supplied fetcher");
  expect(fetcher.fetch).not.toHaveBeenCalled();
});
