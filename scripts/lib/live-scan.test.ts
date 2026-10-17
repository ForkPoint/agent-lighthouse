import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FetchResult } from "#core/fetcher";
import type { ScanOptions } from "#core/orchestrator";
import type { ScanReport } from "#core/types";

// A test-controlled URL → FetchResult map behind the real scanner. Every URL
// not in the map answers 404, so no test reaches the network.
const h = vi.hoisted(() => ({
  map: new Map<string, FetchResult>(),
}));

vi.mock("#core/fetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("#core/fetcher")>();
  return {
    ...actual,
    isSafeUrl: async () => true,
    createFetcher: () => ({
      fetch: async ({ url }: { url: string }) =>
        h.map.get(url) ?? response(url, 404, ""),
      summary: () => ({ requests: 0, statuses: {}, failures: {}, open: [] }),
    }),
  };
});

// The real runScan by default; the fallback tests replace it with canned
// reports so they can say which origin answers.
vi.mock("#core/orchestrator", async (importOriginal) => {
  const actual = await importOriginal<typeof import("#core/orchestrator")>();
  return { ...actual, runScan: vi.fn(actual.runScan) };
});

vi.mock("#core/audits/operability-safety/runner", () => ({
  runA11yForHtml: vi.fn(async () => ({})),
  A11Y_RULES: [],
}));

import { runScan } from "#core/orchestrator";
import { defaultOriginCache } from "#core/origin-cache";
import { CORPUS_ACCEPT_LANGUAGE, scanDomain } from "./live-scan";

function response(url: string, status: number, body: string): FetchResult {
  return {
    url,
    finalUrl: url,
    status,
    headers: { "content-type": status === 200 ? "text/plain" : "" },
    body,
    ttfbMs: 1,
    totalMs: 2,
    contentType: status === 200 ? "text/plain" : "",
    contentLength: body.length,
  };
}

/** A report whose only page attempt got `status`; 0 is no HTTP answer. */
function reportFor(url: string, status: number): ScanReport {
  return { url, pageAttempts: [{ url, status }] } as unknown as ScanReport;
}

/** Stub runScan so each listed URL answers its status; others never connect. */
function origins(statuses: Record<string, number>): void {
  vi.mocked(runScan).mockImplementation(async (url) =>
    reportFor(url, statuses[url] ?? 0),
  );
}

const scannedUrls = (): string[] =>
  vi.mocked(runScan).mock.calls.map(([url]) => url);

beforeEach(() => {
  h.map.clear();
  defaultOriginCache.clear();
  // Back to the real runScan the mock factory wrapped.
  vi.mocked(runScan).mockReset();
});

describe("scanDomain — origin fallback", () => {
  it("scans https://<domain> and nothing else when it answers", async () => {
    origins({ "https://example.com": 200 });

    const result = await scanDomain("example.com", {});

    expect(scannedUrls()).toEqual(["https://example.com"]);
    expect(result.scannedUrl).toBe("https://example.com");
    expect(result.originFallback).toBeUndefined();
  });

  it("tries https://www.<domain> first when the apex never connects", async () => {
    origins({ "https://www.example.com": 200, "http://example.com": 200 });

    const result = await scanDomain("example.com", {});

    expect(scannedUrls()).toEqual([
      "https://example.com",
      "https://www.example.com",
    ]);
    expect(result.scannedUrl).toBe("https://www.example.com");
    expect(result.report.url).toBe("https://www.example.com");
    expect(result.originFallback).toEqual({
      from: "https://example.com",
      to: "https://www.example.com",
    });
  });

  it("tries http://<domain> after the www host", async () => {
    origins({ "http://example.com": 301 });

    const result = await scanDomain("example.com", {});

    expect(scannedUrls()).toEqual([
      "https://example.com",
      "https://www.example.com",
      "http://example.com",
    ]);
    expect(result.originFallback?.to).toBe("http://example.com");
  });

  it("does not prefix www to a domain that already has it", async () => {
    origins({});

    await scanDomain("www.example.com", {});

    expect(scannedUrls()).toEqual([
      "https://www.example.com",
      "http://www.example.com",
    ]);
  });

  // With no origin reachable, the report says so about the domain the corpus
  // lists, not about the last fallback tried.
  it("keeps the first report when no origin answers", async () => {
    origins({});

    const result = await scanDomain("example.com", {});

    expect(scannedUrls()).toHaveLength(3);
    expect(result.scannedUrl).toBe("https://example.com");
    expect(result.report.url).toBe("https://example.com");
    expect(result.originFallback).toBeUndefined();
  });

  // A 403 or 404 is the site speaking. Only a missing HTTP status counts as
  // an unreachable origin.
  it.each([403, 404, 500])(
    "does not fall back when the apex answers HTTP %i",
    async (status) => {
      origins({ "https://example.com": status });

      const result = await scanDomain("example.com", {});

      expect(scannedUrls()).toEqual(["https://example.com"]);
      expect(result.originFallback).toBeUndefined();
    },
  );

  it("does not fall back when one page of several answered", async () => {
    vi.mocked(runScan).mockImplementation(
      async (url) =>
        ({
          url,
          pageAttempts: [
            { url, status: 0 },
            { url: `${url}/en/`, status: 200 },
          ],
        }) as unknown as ScanReport,
    );

    await scanDomain("example.com", {});

    expect(scannedUrls()).toEqual(["https://example.com"]);
  });

  // A report with no page attempt at all, a scan stopped before the page
  // fetch, is not proof the origin is down.
  it("does not fall back on a report with no page attempts", async () => {
    vi.mocked(runScan).mockImplementation(
      async (url) => ({ url, pageAttempts: [] }) as unknown as ScanReport,
    );

    await scanDomain("example.com", {});

    expect(scannedUrls()).toEqual(["https://example.com"]);
  });
});

describe("scanDomain — request options", () => {
  it("sends the fixed Accept-Language on every attempt", async () => {
    origins({ "http://example.com": 200 });

    await scanDomain("example.com", {});

    for (const [, options] of vi.mocked(runScan).mock.calls)
      expect(options?.headers?.["Accept-Language"]).toBe(
        CORPUS_ACCEPT_LANGUAGE,
      );
  });

  it("keeps the caller's options and lets its headers win", async () => {
    origins({ "https://example.com": 200 });
    const options: ScanOptions = {
      maxConcurrent: 3,
      headers: { "Accept-Language": "de-DE", "X-Test": "1" },
    };

    await scanDomain("example.com", options);

    const passed = vi.mocked(runScan).mock.calls[0]?.[1];
    expect(passed?.maxConcurrent).toBe(3);
    expect(passed?.headers).toEqual({
      "Accept-Language": "de-DE",
      "X-Test": "1",
    });
  });
});

// The runners test the scanner; they are not crawlers. A robots.txt that
// shuts out every agent and asks for a crawl delay does not stop the scan.
describe("scanDomain — robots.txt", () => {
  it("scans a site whose robots.txt disallows every agent", async () => {
    const page = "https://example.com";
    h.map.set(
      `${page}/robots.txt`,
      response(
        `${page}/robots.txt`,
        200,
        "User-agent: *\nDisallow: /\nCrawl-delay: 30\n",
      ),
    );
    h.map.set(page, {
      ...response(
        page,
        200,
        `<html><body><main><h1>Kettles</h1><p>${"copper kettle ".repeat(60)}</p></main></body></html>`,
      ),
      headers: { "content-type": "text/html" },
      contentType: "text/html",
    });

    const result = await scanDomain("example.com", {});

    expect(result.scannedUrl).toBe(page);
    expect(result.report.pageAttempts?.map((a) => a.status)).toEqual([200]);
    expect(result.report.pagesScanned.map((p) => p.url)).toEqual([page]);
    expect(vi.mocked(runScan).mock.calls[0]?.[1]?.robotsTxt).toBeUndefined();
  });
});
