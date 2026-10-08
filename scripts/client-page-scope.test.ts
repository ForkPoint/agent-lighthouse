import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FetchResult, ScanReport } from "@forkpoint/agent-lighthouse-core";
import { runScan, defaultOriginCache } from "@forkpoint/agent-lighthouse-core";
import { PageType } from "#core/types";

const h = vi.hoisted(() => ({
  map: new Map<string, FetchResult>(),
  calls: [] as string[],
}));
vi.mock("#core/fetcher", async (original) => ({
  ...(await original<typeof import("#core/fetcher")>()),
  isSafeUrl: async () => true,
  createFetcher: () => ({
    fetch: async ({ url }: { url: string }) => {
      h.calls.push(url);
      return (
        h.map.get(url) ?? {
          url,
          finalUrl: url,
          status: 404,
          headers: {},
          body: "",
          contentType: "",
          contentLength: 0,
          ttfbMs: 0,
          totalMs: 0,
        }
      );
    },
  }),
}));
vi.mock("#core/audits/operability-safety/runner", () => ({
  runA11yForHtml: async () => ({}),
  A11Y_RULES: [],
}));
function set(url: string, body: string) {
  h.map.set(url, {
    url,
    finalUrl: url,
    status: 200,
    headers: { "content-type": "text/html" },
    body,
    contentType: "text/html",
    contentLength: body.length,
    ttfbMs: 1,
    totalMs: 2,
  });
}
beforeEach(() => {
  h.map.clear();
  h.calls.length = 0;
  defaultOriginCache.clear();
});

// Exercise each public declaration path against the same scan evidence.
describe("v7 client page scope parity", () => {
  it("gives SDK, CLI flag/config, and MCP declarations the same findings and score", async () => {
    const { parseCliOptions } = await import("../packages/cli/src/options.js");
    const { pageOptions, buildAuditSummary } =
      await import("../packages/mcp/src/tool.js");
    const { auditWebsite } = await import("../packages/mcp/src/index.js");
    const { buildReportView } =
      await import("../packages/report/src/view-model.js");
    const url = "https://example.com/story";
    const other = "https://example.com/other";
    const html = `<html><head><meta property="og:type" content="article"></head><body><main><h1>Story</h1><p>${"Article facts and useful detail. ".repeat(60)}</p><a href="/other">Other</a></main></body></html>`;
    set(url, html);
    set(other, html);
    const declarations = {
      pageType: PageType.Article,
      pages: [
        { url: "https://example.com/unread", pageType: PageType.Article },
      ],
    };
    const cliFlag = parseCliOptions(["--page-type", "article"], url, {
      pages: declarations.pages,
    });
    const cliConfig = parseCliOptions([], url, declarations);
    const paths = [
      declarations,
      cliFlag,
      cliConfig,
      pageOptions({ url, ...declarations }),
    ];
    const reports: ScanReport[] = [];
    for (const options of paths) {
      defaultOriginCache.clear();
      reports.push(
        await runScan(url, {
          pageType: options.pageType,
          pages: options.pages,
        }),
      );
    }
    const projection = (r: (typeof reports)[number]) => ({
      score: r.overallScore,
      pages: r.pagesScanned,
      attempts: r.pageAttempts,
      checks: r.categories
        .flatMap((c) => c.checks)
        .map((c) => ({
          id: c.id,
          status: c.status,
          score: c.score,
          mode: c.scoreDisplayMode,
          coverage: c.coverage,
          advisory: c.advisoryResults,
        })),
    });
    for (const r of reports.slice(1))
      expect(projection(r)).toEqual(projection(reports[0]!));
    const expectedScope = buildReportView(reports[0]!).pageScope;
    expect(
      buildAuditSummary(reports[0]!, buildReportView(reports[0]!)).pageScope,
    ).toEqual(expectedScope);
    defaultOriginCache.clear();
    expect((await auditWebsite(url, declarations)).pageScope).toEqual(
      expectedScope,
    );
  });
  it("rejects unsupported declarations before fetching, including on unread scans", async () => {
    for (const options of [
      { pageType: "author" },
      { pages: [{ url: "https://example.com/", pageType: "typo" }] },
      { pages: [{ url: "not a url", pageType: PageType.Article }] },
    ]) {
      await expect(
        runScan("https://example.com/unread", options as never),
      ).rejects.toThrow();
    }
    expect(h.calls).toEqual([]);
  });
});
