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
});
