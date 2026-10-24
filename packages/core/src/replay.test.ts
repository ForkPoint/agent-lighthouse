import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("undici", () => {
  class Agent {
    compose() {
      return this;
    }
  }
  return { request: vi.fn(), Agent, interceptors: { redirect: vi.fn() } };
});

vi.mock("node:dns/promises", () => ({
  default: { lookup: vi.fn() },
}));

import { request } from "undici";
import dns from "node:dns/promises";
import { createFetcher, type HttpExchange } from "./fetcher";
import { runScan } from "./orchestrator";
import { OriginCache } from "./origin-cache";
import { createReplay } from "./replay";
import { HttpMethod } from "./types";

const mockRequest = vi.mocked(request);
const mockLookup = vi.mocked(dns.lookup);

const SITE = "https://shop.example/";
const SCANNED_AT = Date.parse("2026-10-09T12:00:00.000Z");
const HOME = `<!doctype html><html lang="en"><head><title>Copper kettles</title>
<meta name="description" content="Hand-made copper kettles.">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Kettle Co","url":"https://shop.example/"}</script>
</head><body><main><h1>Copper kettles</h1>
<p>${"Each kettle is hammered by hand from recycled copper. ".repeat(20)}</p>
<a href="/about">About us</a> <a href="/products/kettle">The kettle</a>
</main></body></html>`;

/** The site behind the mocked network: a homepage, robots.txt and 404s. */
function site(url: string): { status: number; body: string; type: string } {
  const path = new URL(url).pathname;
  if (path === "/")
    return { status: 200, body: HOME, type: "text/html; charset=utf-8" };
  if (path === "/robots.txt")
    return {
      status: 200,
      body: "User-agent: *\nAllow: /\nSitemap: https://shop.example/sitemap.xml\n",
      type: "text/plain",
    };
  if (path === "/old") return { status: 301, body: "", type: "text/plain" };
  return { status: 404, body: "Not found", type: "text/html" };
}

function serve(url: string) {
  const page = site(url);
  const bytes = Buffer.from(page.body, "utf8");
  return {
    statusCode: page.status,
    headers: {
      "content-type": page.type,
      ...(page.status === 301 && { location: "/" }),
    },
    body: {
      async *[Symbol.asyncIterator]() {
        yield bytes;
      },
      dump: vi.fn().mockResolvedValue(undefined),
    },
  };
}

function liveNetwork(): void {
  mockRequest.mockImplementation((async (url: string) =>
    serve(url)) as unknown as typeof request);
  mockLookup.mockResolvedValue({ address: "93.184.216.34", family: 4 });
}

/** After this, any request or lookup that reaches the network fails the test. */
function noNetwork(): void {
  mockRequest.mockReset();
  mockLookup.mockReset();
  mockRequest.mockImplementation(() => {
    throw new Error("replay sent a request");
  });
  mockLookup.mockImplementation(() => {
    throw new Error("replay made a DNS lookup");
  });
}

const options = {
  scanId: "00000000-0000-4000-8000-000000000001",
  now: () => SCANNED_AT,
  timeoutMs: 0,
  bypassOriginCache: true,
};

beforeEach(() => {
  mockRequest.mockReset();
  mockLookup.mockReset();
});

describe("createReplay", () => {
  it("answers a fetch with its captured response, redirects included", async () => {
    liveNetwork();
    const exchanges: HttpExchange[] = [];
    const live = createFetcher({ onExchange: (e) => exchanges.push(e) });
    const first = await live.fetch({ url: `${SITE}old` });
    noNetwork();

    const replayed = await createReplay(exchanges).fetcher.fetch({
      url: `${SITE}old`,
    });

    expect(replayed).toEqual(first);
    expect(replayed.redirectChain).toEqual([
      { status: 301, from: `${SITE}old`, to: SITE },
    ]);
    // The redirect check resolved the hop through the capture.
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it("answers requests in the order they started, not the order they finished", async () => {
    let calls = 0;
    mockRequest.mockImplementation((async () => {
      calls += 1;
      const answer = String(calls);
      // The first request finishes last.
      if (calls === 1) await new Promise((resolve) => setTimeout(resolve, 30));
      return {
        statusCode: 200,
        headers: { "content-type": "text/plain" },
        body: {
          async *[Symbol.asyncIterator]() {
            yield Buffer.from(answer);
          },
          dump: vi.fn(),
        },
      };
    }) as unknown as typeof request);
    mockLookup.mockResolvedValue({ address: "93.184.216.34", family: 4 });
    const exchanges: HttpExchange[] = [];
    const live = createFetcher({ onExchange: (e) => exchanges.push(e) });
    const first = await Promise.all([
      live.fetch({ url: SITE }),
      live.fetch({ url: SITE }),
    ]);
    noNetwork();

    const replay = createReplay(exchanges);
    const replayed = await Promise.all([
      replay.fetcher.fetch({ url: SITE }),
      replay.fetcher.fetch({ url: SITE }),
    ]);

    expect(first.map((r) => r.body)).toEqual(["1", "2"]);
    expect(replayed.map((r) => r.body)).toEqual(["1", "2"]);
    expect(replay.ambiguous()).toEqual([`GET ${SITE}`]);
    expect(replay.misses()).toEqual([]);
  });

  it("replays a body discard that failed", async () => {
    liveNetwork();
    mockRequest.mockResolvedValueOnce({
      statusCode: 200,
      headers: {},
      body: {
        async *[Symbol.asyncIterator]() {},
        dump: vi.fn().mockRejectedValue(new Error("dump failed")),
      },
    } as never);
    const exchanges: HttpExchange[] = [];
    const first = await createFetcher({
      onExchange: (e) => exchanges.push(e),
    }).fetch({ url: SITE, method: HttpMethod.Options });
    noNetwork();

    const replayed = await createReplay(exchanges).fetcher.fetch({
      url: SITE,
      method: HttpMethod.Options,
    });

    expect(first.status).toBe(0);
    expect(replayed).toEqual(first);
  });

  it("fails a request the capture does not hold, and lists it", async () => {
    const replay = createReplay([]);

    const result = await replay.fetcher.fetch({ url: `${SITE}missing` });

    expect(result.status).toBe(0);
    expect(result.error).toBe(`Not in the capture: GET ${SITE}missing`);
    expect(replay.misses()).toEqual([`GET ${SITE}missing`]);
  });

  it("replays a failure with its captured error", async () => {
    mockRequest.mockRejectedValueOnce(
      Object.assign(new Error("fetch failed"), {
        cause: { code: "ECONNRESET" },
      }),
    );
    const exchanges: HttpExchange[] = [];
    const first = await createFetcher({
      onExchange: (e) => exchanges.push(e),
    }).fetch({ url: SITE });
    noNetwork();

    const replayed = await createReplay(exchanges).fetcher.fetch({ url: SITE });

    expect(replayed).toEqual(first);
  });

  it("tells requests apart by User-Agent, Accept and method", async () => {
    const exchange = (ua: string, status: number): HttpExchange => ({
      fetchId: 1,
      hop: 0,
      startedAt: new Date(SCANNED_AT).toISOString(),
      request: {
        url: SITE,
        method: HttpMethod.Get,
        headers: { "User-Agent": ua, Accept: "*/*" },
      },
      response: {
        status,
        headers: {},
        body: new Uint8Array(0),
        bodyRead: true,
        truncated: false,
      },
      ttfbMs: 5,
      totalMs: 6,
    });
    const replay = createReplay([
      exchange("GPTBot/1.0", 403),
      exchange("ClaudeBot/1.0", 200),
    ]);

    const claude = await replay.fetcher.fetch({
      url: SITE,
      userAgent: "ClaudeBot/1.0",
    });
    const head = await replay.fetcher.fetch({
      url: SITE,
      userAgent: "GPTBot/1.0",
      method: HttpMethod.Head,
    });

    expect(claude.status).toBe(200);
    expect([claude.ttfbMs, claude.totalMs]).toEqual([5, 6]);
    expect(head.error).toMatch(/^Not in the capture: HEAD/);
  });

  it("never answers a request with another one's response", async () => {
    const post = (body: string, origin: string): HttpExchange => ({
      fetchId: 1,
      hop: 0,
      startedAt: "",
      request: {
        url: `${SITE}mcp`,
        method: HttpMethod.Post,
        headers: {
          "User-Agent": "Scanner",
          Accept: "application/json",
          Origin: origin,
        },
        body,
      },
      response: {
        status: 200,
        headers: {},
        body: new Uint8Array(Buffer.from(`${body} from ${origin}`)),
        bodyRead: true,
        truncated: false,
      },
      ttfbMs: 1,
      totalMs: 1,
    });
    const replay = createReplay([
      post('{"method":"server/discover"}', "https://a.example"),
      post('{"method":"server/discover"}', "https://b.example"),
    ]);
    const send = (body: string, origin: string) =>
      replay.fetcher.fetch({
        url: `${SITE}mcp`,
        method: HttpMethod.Post,
        userAgent: "Scanner",
        acceptHeader: "application/json",
        headers: { Origin: origin },
        body,
      });

    const fromB = await send(
      '{"method":"server/discover"}',
      "https://b.example",
    );
    const tools = await send('{"method":"tools/list"}', "https://a.example");

    expect(fromB.body).toBe(
      '{"method":"server/discover"} from https://b.example',
    );
    expect(tools.error).toBe(`Not in the capture: POST ${SITE}mcp`);
    expect(replay.misses()).toEqual([`POST ${SITE}mcp`]);
  });

  it("resolves only the hosts the capture sent requests to", async () => {
    const replay = createReplay([
      {
        fetchId: 1,
        hop: 0,
        startedAt: "",
        request: { url: SITE, method: HttpMethod.Get, headers: {} },
        error: "x",
        ttfbMs: 0,
        totalMs: 0,
      },
    ]);

    await expect(replay.lookup("shop.example")).resolves.toMatchObject({
      address: "192.0.2.1",
    });
    await expect(replay.lookup("elsewhere.example")).rejects.toThrow(
      "ENOTFOUND",
    );
  });
});

describe("runScan — replay", () => {
  it("replays custom scan headers without loosening request matching", async () => {
    liveNetwork();
    const exchanges: HttpExchange[] = [];
    const configured = {
      ...options,
      headers: {
        "Accept-Language": "bg",
        "X-Scan-Variant": "retail",
        "cache-control": "max-age=60",
      },
    };
    const live = await runScan(SITE, {
      ...configured,
      onExchange: (exchange) => exchanges.push(exchange),
    });
    expect(exchanges[0]!.request.headers["Accept-Language"]).toBe("bg");
    noNetwork();
    const replay = createReplay(exchanges);
    const again = await runScan(SITE, {
      ...configured,
      fetcher: replay.fetcher,
      lookup: replay.lookup,
    });
    expect(replay.misses()).toEqual([]);
    expect(again).toEqual(live);
    expect(mockRequest).not.toHaveBeenCalled();
    expect(mockLookup).not.toHaveBeenCalled();
    const mismatched = createReplay(exchanges);
    const wrongVariant = await runScan(SITE, {
      ...configured,
      headers: { ...configured.headers, "X-Scan-Variant": "other" },
      fetcher: mismatched.fetcher,
      lookup: mismatched.lookup,
    });
    expect(mismatched.misses()).toContain(`GET ${SITE}`);
    expect(wrongVariant.pagesScanned).toEqual([]);
    expect(mockRequest).not.toHaveBeenCalled();
    expect(mockLookup).not.toHaveBeenCalled();
  }, 60_000);

  it("keeps the scan result when a cached capture callback throws", async () => {
    liveNetwork();
    const warm = {
      ...options,
      bypassOriginCache: false,
      originCache: new OriginCache(),
    };
    const baseline = await runScan(SITE, { ...warm, onExchange: () => {} });
    mockRequest.mockClear();
    const cachedDeliveries: string[] = [];
    const onExchange = vi.fn((exchange: HttpExchange) => {
      if (mockRequest.mock.calls.length === 0)
        cachedDeliveries.push(exchange.request.url);
      if (exchange.request.url === `${SITE}robots.txt`)
        throw new Error("capture disk full");
    });
    const result = await runScan(SITE, { ...warm, onExchange });
    expect(result.originEvidence?.cached).toBe(true);
    expect(result.overallScore).toBe(baseline.overallScore);
    expect(result.pagesScanned).toEqual(baseline.pagesScanned);
    expect(
      onExchange.mock.calls.some(
        ([e]) => e.request.url === `${SITE}robots.txt`,
      ),
    ).toBe(true);
    expect(cachedDeliveries[0]).toBe(`${SITE}robots.txt`);
    expect(cachedDeliveries).toContain(`${SITE}llms.txt`);
    const verdicts = (report: typeof baseline) =>
      report.categories.flatMap((category) =>
        category.checks.map(({ id, status, score }) => ({ id, status, score })),
      );
    expect(verdicts(result)).toEqual(verdicts(baseline));
  }, 60_000);

  it("rebuilds the live report from the captures, with no network", async () => {
    liveNetwork();
    const exchanges: HttpExchange[] = [];
    const live = await runScan(SITE, {
      ...options,
      onExchange: (exchange) => exchanges.push(exchange),
    });
    expect(exchanges.length).toBeGreaterThan(10);
    noNetwork();

    // A replay answers each captured request once, so each scan gets its own.
    const scan = () => {
      const replay = createReplay(exchanges);
      return runScan(SITE, {
        ...options,
        fetcher: replay.fetcher,
        lookup: replay.lookup,
      });
    };
    const first = await scan();
    const second = await scan();

    expect(mockRequest).not.toHaveBeenCalled();
    expect(mockLookup).not.toHaveBeenCalled();
    expect(first).toEqual(live);
    expect(second).toEqual(first);
    expect(first.scannedAt).toBe("2026-10-09T12:00:00.000Z");
  }, 60_000);

  it("captures cached origin evidence, so a warm-cache scan replays", async () => {
    liveNetwork();
    const originCache = new OriginCache();
    const warm = { ...options, bypassOriginCache: false, originCache };
    await runScan(SITE, { ...warm, onExchange: () => {} });
    mockRequest.mockClear();
    const exchanges: HttpExchange[] = [];
    const live = await runScan(`${SITE}about`, {
      ...warm,
      onExchange: (exchange) => exchanges.push(exchange),
    });
    const robotsSent = mockRequest.mock.calls.some(
      ([sent]) => sent === `${SITE}robots.txt`,
    );
    noNetwork();

    const replay = createReplay(exchanges);
    const replayed = await runScan(`${SITE}about`, {
      ...options,
      fetcher: replay.fetcher,
      lookup: replay.lookup,
    });

    // The live scan reused the evidence; the replay read it from the capture.
    // Only when the evidence was read, and whether it came from the cache,
    // may differ.
    const judged = (report: unknown) =>
      JSON.parse(
        JSON.stringify(report, (key, value) =>
          key === "readAt" || key === "cached" ? undefined : value,
        ),
      );
    expect(robotsSent).toBe(false);
    expect(live.originEvidence?.cached).toBe(true);
    expect(replay.misses()).toEqual([]);
    expect(judged(replayed)).toEqual(judged(live));
  }, 60_000);
});
