import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FetchResult } from "./fetcher";

// ── Mocks ────────────────────────────────────────────────────────
// A test-controlled URL → FetchResult map, as in orchestrator.test.ts. Every
// URL not in the map answers 404, so nothing reaches the network.
const h = vi.hoisted(() => ({
  map: new Map<string, FetchResult>(),
  calls: [] as string[],
  /** URLs `isSafeUrl` refuses, as if they resolved to a private address. */
  unsafe: new Set<string>(),
}));

function notFound(url: string): FetchResult {
  return {
    url,
    finalUrl: url,
    status: 404,
    headers: {},
    body: "",
    ttfbMs: 0,
    totalMs: 0,
    contentType: "",
    contentLength: 0,
  };
}

vi.mock("./fetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./fetcher")>();
  return {
    ...actual,
    isSafeUrl: async (url: string) => !h.unsafe.has(url),
    createFetcher: () => ({
      fetch: async ({ url }: { url: string }) => {
        h.calls.push(url);
        return h.map.get(url) ?? notFound(url);
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
import { DOM_WORK_LIMITS } from "./contracts";
import { defaultOriginCache } from "./origin-cache";
import { PhaseId, type ScanEvent } from "./progress";
import { AttemptOutcome, EvidenceKey, PageType } from "./types";

// ── Helpers ──────────────────────────────────────────────────────

function set(url: string, body: string, finalUrl = url): void {
  h.map.set(url, {
    url,
    finalUrl,
    status: 200,
    headers: { "content-type": "text/html" },
    body,
    ttfbMs: 1,
    totalMs: 2,
    contentType: "text/html",
    contentLength: body.length,
  });
}

const URL_ROOT = "https://example.com/";
const TARGET = "https://example.com/en/";
const FULL_HTML = `<html><body><main><h1>Kettles</h1><p>${"copper kettle ".repeat(60)}</p></main></body></html>`;
const gateway = (head: string): string =>
  `<html><head>${head}</head><body><h1>Brand</h1><p>Entering the store</p></body></html>`;

beforeEach(() => {
  h.map.clear();
  h.calls.length = 0;
  h.unsafe.clear();
  defaultOriginCache.clear();
});

// ── Gateway follow ───────────────────────────────────────────────

describe("runScan — gateway follow", () => {
  // The root redirected to the www host. A relative refresh resolves against
  // the page the browser landed on, not the URL that was typed.
  it("resolves a relative target against the final URL after a redirect", async () => {
    const landed = "https://www.example.com/";
    set(
      URL_ROOT,
      gateway(`<meta http-equiv="refresh" content="0;url=/en/">`),
      landed,
    );
    set("https://www.example.com/en/", FULL_HTML);

    const report = await runScan(URL_ROOT);

    expect(h.calls).toContain("https://www.example.com/en/");
    expect(h.calls).not.toContain(TARGET);
    expect(report.pagesScanned.map((page) => page.url)).toEqual([
      URL_ROOT,
      "https://www.example.com/en/",
    ]);
    expect(report.overallScore).not.toBeNull();
  });

  it("reads the www twin a gateway names and scores the site", async () => {
    const twin = "https://www.example.com/";
    set(
      URL_ROOT,
      gateway(`<meta http-equiv="refresh" content="0;URL=${twin}">`),
    );
    set(twin, FULL_HTML);

    const report = await runScan(URL_ROOT);

    expect(report.pageAttempts?.map((page) => page.url)).toEqual([
      URL_ROOT,
      twin,
    ]);
    expect(report.scanValidity?.evidence[EvidenceKey.RenderedBody]).toBe(true);
    expect(report.overallScore).not.toBeNull();
  });

  // A target the user already declared is read once, as the declared page,
  // with the purpose the user gave it.
  it("does not read a declared gateway target twice", async () => {
    set(URL_ROOT, gateway(`<meta http-equiv="refresh" content="0;url=/en/">`));
    set(TARGET, FULL_HTML);

    const report = await runScan(URL_ROOT, {
      pages: [{ url: TARGET, pageType: PageType.Article }],
    });

    expect(report.pageAttempts?.map((page) => page.url)).toEqual([
      URL_ROOT,
      TARGET,
    ]);
    expect(report.pagesScanned.map((page) => page.url)).toEqual([
      URL_ROOT,
      TARGET,
    ]);
    const declared = report.pagesScanned.find((page) => page.url === TARGET);
    expect(declared?.pageType).toBe(PageType.Article);
  });

  // The target comes from scanned content, so it passes the same SSRF gate
  // as every other URL taken from a page.
  it("does not read a target that isSafeUrl refuses", async () => {
    h.unsafe.add(TARGET);
    set(URL_ROOT, gateway(`<meta http-equiv="refresh" content="0;url=/en/">`));
    set(TARGET, FULL_HTML);

    const report = await runScan(URL_ROOT);

    expect(h.calls).not.toContain(TARGET);
    expect(report.pageAttempts?.map((page) => page.url)).toEqual([URL_ROOT]);
    expect(report.overallScore).toBeNull();
  });

  it("raises the page-fetch total so progress never reads 2 of 1", async () => {
    set(URL_ROOT, gateway(`<meta http-equiv="refresh" content="0;url=/en/">`));
    set(TARGET, FULL_HTML);
    const events: ScanEvent[] = [];

    await runScan(URL_ROOT, { onEvent: (event) => events.push(event) });

    const fetched = events.flatMap((event) =>
      event.type === "unit:done" && event.phase === PhaseId.FetchPages
        ? [`${event.completed}/${event.total}`]
        : [],
    );
    expect(fetched).toEqual(["1/1", "2/2"]);
  });

  // A requested page the scan could not parse within its work limits has no
  // DOM to read a refresh from, so nothing is followed.
  it("does not follow from a page over the DOM work limits", async () => {
    const deep = `<html><head><meta http-equiv="refresh" content="0;url=/en/"></head><body>${"<div>".repeat(DOM_WORK_LIMITS.maxDepth + 10)}x${"</div>".repeat(DOM_WORK_LIMITS.maxDepth + 10)}</body></html>`;
    set(URL_ROOT, deep);
    set(TARGET, FULL_HTML);

    const report = await runScan(URL_ROOT);

    expect(h.calls).not.toContain(TARGET);
    expect(report.pageAttempts).toMatchObject([
      { url: URL_ROOT, outcome: AttemptOutcome.Unread, status: 200 },
    ]);
  });

  // When the requested root redirects (here to its www twin) and the landed
  // page's canonical names the requested URL, following it leads back to the
  // URL already read: one more request, and the same URL listed twice in
  // pagesScanned. A target equal to the requested URL is the page itself.
  it("does not follow a canonical back to the requested URL", async () => {
    const landed = "https://www.example.com/";
    set(URL_ROOT, gateway(`<link rel="canonical" href="${URL_ROOT}">`), landed);

    const report = await runScan(URL_ROOT);

    expect(report.pageAttempts?.map((page) => page.url)).toEqual([URL_ROOT]);
  });
});

// ── Page set (no page budget) ────────────────────────────────────

describe("runScan — the pages a scan reads", () => {
  // The multi-page budget is gone. A scan reads the target, the gateway
  // target and every declared page, and no page it merely finds in links or
  // a sitemap. Audits may still request linked URLs; they are not pages.
  it("reads the target, the gateway target and every declared page, nothing else", async () => {
    const declared = Array.from(
      { length: 7 },
      (_, i) => `https://example.com/page-${i}`,
    );
    set(
      URL_ROOT,
      `<html><head><meta http-equiv="refresh" content="0;url=/en/"></head><body><nav><a href="/linked">Linked</a></nav></body></html>`,
    );
    set(TARGET, FULL_HTML.replace("</main>", `<a href="/deeper">x</a></main>`));
    for (const page of declared) set(page, FULL_HTML);
    set(
      "https://example.com/sitemap.xml",
      `<?xml version="1.0"?><urlset><url><loc>https://example.com/from-sitemap</loc></url></urlset>`,
    );

    const report = await runScan(URL_ROOT, {
      pages: declared.map((url) => ({ url, pageType: PageType.Article })),
    });

    expect(report.pageAttempts?.map((page) => page.url)).toEqual([
      URL_ROOT,
      TARGET,
      ...declared,
    ]);
  });
});
