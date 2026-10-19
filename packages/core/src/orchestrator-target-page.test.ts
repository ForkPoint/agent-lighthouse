import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FetchOptions, FetchResult } from "./fetcher";

// A test-controlled URL -> FetchResult map. Every URL not in the map answers
// 404, so nothing reaches the network.
const h = vi.hoisted(() => ({
  map: new Map<string, FetchResult>(),
  calls: [] as string[],
  options: [] as FetchOptions[],
}));

/**
 * Requests for `url` sent as the scan's own page read: no probe User-Agent,
 * Accept or method. Audits such as UA parity probe the target on purpose.
 */
const pageReads = (url: string) =>
  h.options.filter(
    (o) =>
      o.url === url &&
      o.userAgent === undefined &&
      o.acceptHeader === undefined &&
      o.method === undefined,
  );

function response(url: string, status: number, body: string): FetchResult {
  return {
    url,
    finalUrl: url,
    status,
    headers: status === 200 ? { "content-type": "text/html" } : {},
    body,
    ttfbMs: 1,
    totalMs: 2,
    contentType: status === 200 ? "text/html" : "",
    contentLength: body.length,
  };
}

vi.mock("./fetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./fetcher")>();
  return {
    ...actual,
    isSafeUrl: async () => true,
    createFetcher: () => ({
      fetch: async (options: FetchOptions) => {
        const { url } = options;
        h.calls.push(url);
        h.options.push(options);
        return h.map.get(url) ?? response(url, 404, "");
      },
      summary: () => ({ requests: 0, statuses: {}, failures: {}, open: [] }),
    }),
  };
});

// No jsdom: these tests are about which pages a scan reads.
vi.mock("./audits/operability-safety/runner", () => ({
  runA11yForHtml: vi.fn(async () => ({})),
  A11Y_RULES: [],
}));

import { runScan } from "./orchestrator";
import { defaultOriginCache } from "./origin-cache";
import { ScanReportSchema } from "./schemas";
import { PageType, PageTypeSource, PayloadOrigin } from "./contracts";

const TARGET = "https://shop.example/p/mug";
const PRODUCT = `<html><head><meta property="og:type" content="product"></head>
<body><main><h1>Blue mug</h1><p>${"A sturdy blue mug. ".repeat(40)}</p></main></body></html>`;

beforeEach(() => {
  h.map.clear();
  h.calls.length = 0;
  h.options.length = 0;
  defaultOriginCache.clear();
});

describe("runScan — targetPage", () => {
  it("reads the target from the response it was given, without a fetch", async () => {
    const report = await runScan(TARGET, {
      targetPage: response(TARGET, 200, PRODUCT),
    });
    expect(pageReads(TARGET)).toEqual([]);
    expect(h.calls).toContain("https://shop.example/robots.txt");
    expect(report.pagesScanned[0]).toMatchObject({
      url: TARGET,
      pageType: PageType.Product,
    });
    expect(report.pagesScanned[0]!.classification?.source).toBe(
      PageTypeSource.Detected,
    );
  });

  it("still follows a gateway named by the response it was given", async () => {
    const root = "https://shop.example/";
    const gateway = `<html><head><meta http-equiv="refresh" content="0;url=/en/"></head><body></body></html>`;
    h.map.set("https://shop.example/en/", response(root, 200, PRODUCT));
    await runScan(root, { targetPage: response(root, 200, gateway) });
    expect(pageReads(root)).toEqual([]);
    expect(pageReads("https://shop.example/en/")).toHaveLength(1);
  });

  it("records the page identity it was given and stays detected", async () => {
    const pageIdentity = {
      type: PageType.Product,
      source: PageTypeSource.Detected,
      detectionId: "d_1",
      payloadSha256: "ab12",
      origin: PayloadOrigin.Fetched,
    };
    const report = await runScan(TARGET, {
      targetPage: response(TARGET, 200, PRODUCT),
      pageIdentity,
    });
    expect(report.pageIdentity).toEqual(pageIdentity);
    expect(report.conditions?.pageType.source).toBe(PageTypeSource.Detected);
    expect(ScanReportSchema.parse(report).pageIdentity).toEqual(pageIdentity);
  });

  it("ignores a response for another URL and reads the target", async () => {
    h.map.set(TARGET, response(TARGET, 200, PRODUCT));
    const other = "https://shop.example/p/other";
    await runScan(TARGET, { targetPage: response(other, 200, "<p>x</p>") });
    expect(pageReads(TARGET)).toHaveLength(1);
  });

  it("matches the target without its trailing slash or fragment", async () => {
    await runScan(TARGET, {
      targetPage: response(`${TARGET}/#top`, 200, PRODUCT),
    });
    expect(pageReads(TARGET)).toEqual([]);
  });

  it("adds no identity to a plain scan", async () => {
    h.map.set(TARGET, response(TARGET, 200, PRODUCT));
    const report = await runScan(TARGET);
    expect(pageReads(TARGET)).toHaveLength(1);
    expect("pageIdentity" in report).toBe(false);
  });
});
