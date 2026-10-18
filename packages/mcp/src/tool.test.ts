import { describe, it, expect } from "vitest";
import type {
  CategoryResult,
  CheckResult,
  ScanReport,
} from "@forkpoint/agent-lighthouse-core";
import {
  CATEGORY_MASS,
  CaptureSource,
  DocumentState,
  EvidenceSource,
  AttemptOutcome,
  AuditTier,
  CheckPriority,
  CheckStatus,
  NoticeKind,
  PageType,
  PageTypeSource,
  ScoreDisplayMode,
  ScoreTier,
} from "@forkpoint/agent-lighthouse-core";
import { buildReportView } from "@forkpoint/agent-lighthouse-report";
import {
  AUDIT_TOOL,
  MAX_OPPORTUNITIES,
  buildAuditSummary,
  targetUrl,
  pageOptions,
} from "./tool";

/**
 * The MCP tool contract.
 *
 * `server.ts` is a stdio entry point — it connects a transport at import time,
 * so a test can never call its handlers. These are the two pieces a client
 * actually observes: the declared schema and the JSON of a `tools/call` reply.
 *
 * The view is built by the real `buildReportView` rather than hand-written, so
 * a change to the view model that breaks the summary shows up here instead of
 * in a client's parser.
 */

function check(over: Partial<CheckResult> = {}): CheckResult {
  return {
    id: "c",
    category: "agent-interfaces",
    title: "title",
    description: "desc",
    status: CheckStatus.Pass,
    score: 1,
    scoreDisplayMode: ScoreDisplayMode.Binary,
    priority: CheckPriority.Medium,
    impact: "",
    fix: "",
    ...over,
  };
}

function cat(over: Partial<CategoryResult> & { id: string }): CategoryResult {
  return {
    name: over.id,
    weight: CATEGORY_MASS[over.id] ?? 0.1,
    score: 0,
    passCount: 0,
    warnCount: 0,
    failCount: 0,
    checks: [],
    ...over,
  };
}

function report(over: Partial<ScanReport> = {}): ScanReport {
  return {
    scanId: "s1",
    url: "https://shop.test/",
    domain: "shop.test",
    overallScore: 42,
    scoreTier: ScoreTier.NeedsWork,
    categories: [
      cat({
        id: "agent-interfaces",
        score: 80,
        checks: [
          check({ id: "p1", status: CheckStatus.Pass }),
          check({
            id: "w1",
            status: CheckStatus.Warn,
            priority: CheckPriority.High,
          }),
          check({
            id: "f1",
            status: CheckStatus.Fail,
            priority: CheckPriority.Critical,
          }),
        ],
        passCount: 1,
        warnCount: 1,
        failCount: 1,
      }),
    ],
    topPasses: [],
    topFails: [],
    recommendations: [],
    pagesScanned: [{ url: "https://shop.test/", pageType: PageType.Homepage }],
    scannedAt: "2026-01-01T00:00:00.000Z",
    durationMs: 12_340,
    ...over,
  };
}

/** Build the summary the way `server.ts` does. */
function summarise(r: ScanReport) {
  return buildAuditSummary(r, buildReportView(r));
}

describe("AUDIT_TOOL", () => {
  it("declares a url string as its only required input", () => {
    expect(AUDIT_TOOL.name).toBe("audit_website");
    expect(AUDIT_TOOL.inputSchema.required).toEqual(["url"]);
    expect(AUDIT_TOOL.inputSchema.properties.url.type).toBe("string");
  });

  it("describes itself, so a model can tell when to call it", () => {
    expect(AUDIT_TOOL.description.length).toBeGreaterThan(40);
  });
});

describe("targetUrl", () => {
  it("reads the url argument", () => {
    expect(targetUrl({ url: "https://shop.test" })).toBe("https://shop.test");
  });

  it("trims surrounding whitespace", () => {
    expect(targetUrl({ url: "  https://shop.test  " })).toBe(
      "https://shop.test",
    );
  });

  // String(undefined) is "undefined", which is truthy: the original guard could
  // never fire, so an argument-less call scanned a host named "undefined".
  it("rejects a call with no arguments", () => {
    expect(() => targetUrl(undefined)).toThrow("Missing target URL");
  });

  it("rejects a missing url", () => {
    expect(() => targetUrl({})).toThrow("Missing target URL");
  });

  it("rejects an empty or blank url", () => {
    expect(() => targetUrl({ url: "" })).toThrow("Missing target URL");
    expect(() => targetUrl({ url: "   " })).toThrow("Missing target URL");
  });

  it("rejects a non-string url instead of coercing it", () => {
    expect(() => targetUrl({ url: 42 })).toThrow("Missing target URL");
    expect(() => targetUrl({ url: null })).toThrow("Missing target URL");
  });
});

describe("buildAuditSummary", () => {
  it("carries the headline numbers", () => {
    const s = summarise(report());
    expect(s.url).toBe("https://shop.test/");
    expect(s.scoreTier).toBe(ScoreTier.NeedsWork);
    expect(typeof s.overallScore).toBe("number");
  });

  it("reports the duration in seconds, not milliseconds", () => {
    expect(summarise(report({ durationMs: 12_340 })).durationSeconds).toBe(
      "12.3",
    );
  });

  it("flattens the view groups into a flat category list", () => {
    const s = summarise(report());
    const names = s.categories.map((c) => c.name);
    expect(names).toContain("agent-interfaces");
    // A model has no use for the report's visual grouping.
    expect(s.categories.every((c) => typeof c.score === "number")).toBe(true);
  });

  it("carries each category status count", () => {
    const entry = summarise(report()).categories.find(
      (c) => c.name === "agent-interfaces",
    );
    expect(entry).toMatchObject({ passCount: 1, warnCount: 1, failCount: 1 });
  });

  it("tells the model whether each category was assessed", () => {
    const s = summarise(report());
    expect(s.categories.every((c) => typeof c.assessed === "boolean")).toBe(
      true,
    );
  });

  it("passes the readiness vitals through", () => {
    expect(summarise(report()).vitals).toBeDefined();
  });

  it("lists the top fixes with the fields a model needs to act", () => {
    const fail = check({
      id: "agent-interfaces/webmcp",
      status: CheckStatus.Fail,
      priority: CheckPriority.Critical,
      impact: "Agents cannot transact.",
      fix: "Declare a WebMCP endpoint.",
    });
    const s = summarise(report({ topFails: [fail] }));
    expect(s.topOpportunities).toEqual([
      {
        id: "agent-interfaces/webmcp",
        title: "title",
        priority: CheckPriority.Critical,
        impact: "Agents cannot transact.",
        fix: "Declare a WebMCP endpoint.",
      },
    ]);
  });

  it(`caps the fix list at ${MAX_OPPORTUNITIES}, so a model is not handed all 215`, () => {
    const fails = Array.from({ length: 25 }, (_, i) =>
      check({ id: `f${i}`, status: CheckStatus.Fail }),
    );
    const s = summarise(report({ topFails: fails }));
    expect(s.topOpportunities).toHaveLength(MAX_OPPORTUNITIES);
    expect(s.topOpportunities[0]?.id).toBe("f0");
  });

  it("returns an empty fix list for a clean scan rather than omitting the key", () => {
    expect(summarise(report({ topFails: [] })).topOpportunities).toEqual([]);
  });

  it("serialises to JSON, which is what the handler actually returns", () => {
    const text = JSON.stringify(summarise(report()), null, 2);
    const parsed = JSON.parse(text);
    expect(parsed.url).toBe("https://shop.test/");
    expect(Array.isArray(parsed.categories)).toBe(true);
  });
});

describe("v7 tool declarations", () => {
  it("advertises the same purpose enum for target and extra pages", () => {
    expect(AUDIT_TOOL.inputSchema.properties.pageType.enum).toEqual(
      AUDIT_TOOL.inputSchema.properties.pages.items.properties.pageType.enum,
    );
    expect(AUDIT_TOOL.inputSchema.properties.pageType.enum).toContain(
      "article",
    );
    expect(AUDIT_TOOL.inputSchema.properties.pageType.enum).not.toContain(
      "author",
    );
  });
  it("keeps omission and legacy content explicit", () => {
    expect(pageOptions({ url: "https://x.test" })).toEqual({});
    expect(pageOptions({ pageType: PageType.General })).toEqual({
      pageType: PageType.General,
    });
    expect(() => pageOptions({ pageType: "author" })).toThrow();
  });
  it("passes recorded page evidence to the summary, without adding it to legacy reports", () => {
    const r = report();
    expect(summarise(r)).not.toHaveProperty("pageScope");
    r.pageAttempts = [
      {
        url: r.url,
        pageType: PageType.General,
        source: PageTypeSource.Detected,
        outcome: AttemptOutcome.Unread,
        status: 503,
      },
    ];
    expect(summarise(r).pageScope?.attempts).toEqual(r.pageAttempts);
  });
});

describe("browser snapshot tool contract", () => {
  it("advertises and validates input and preserves the separate output", () => {
    const snapshots = {
      version: 1 as const,
      pages: [
        {
          requestedUrl: "https://shop.test/",
          capturedUrl: "https://shop.test/",
          html: "<p>Captured page</p>",
          capturedAt: "2026-10-13T10:00:00Z",
          captureSource: CaptureSource.CurrentTab,
          collector: { name: "fixture", version: "1" },
          documentState: DocumentState.Complete,
          truncation: { truncated: false },
          redaction: { redacted: false, fields: [] },
        },
      ],
    };
    expect(pageOptions({ snapshots }).snapshots).toEqual(snapshots);
    expect(AUDIT_TOOL.inputSchema.properties.snapshots).toHaveProperty(
      "properties.version.const",
      1,
    );
    expect(() =>
      pageOptions({ snapshots: { ...snapshots, version: 2 } }),
    ).toThrow();
    const { html: _html, ...capture } = snapshots.pages[0]!;
    const r = report({
      browserAssessment: {
        version: 1,
        evidenceSource: EvidenceSource.BrowserSnapshot,
        score: null,
        unscoredReason: "No browser scoring denominator.",
        captures: [capture],
        findings: [],
        coverage: { eligibleAuditIds: [], eligible: 0, assessed: 0 },
        missingEvidence: [],
        notEligible: [],
        limits: ["No action success proof"],
      },
    });
    const summary = buildAuditSummary(r, buildReportView(r));
    expect(summary.browserAssessment).toEqual(r.browserAssessment);
    expect(summary.overallScore).toBe(r.overallScore);
  });
});

describe("obsolete checks", () => {
  const retired = check({
    id: "agent-interfaces/retired-file",
    title: "Retired file still published",
    status: CheckStatus.Warn,
    tier: AuditTier.Obsolete,
    scoreDisplayMode: ScoreDisplayMode.Informative,
    weight: 0,
    deprecated: {
      kind: NoticeKind.Obsolete,
      notice: "The vendor retired this file in 2024.",
      link: "https://example.com/retired",
      replacement: "Publish the successor file.",
    },
  });

  it("lists found obsolete artifacts so the model can tell the owner", () => {
    const out = summarise(
      report({
        categories: [cat({ id: "agent-interfaces", checks: [retired] })],
      }),
    );
    expect(out.obsoleteFound).toEqual([
      {
        id: "agent-interfaces/retired-file",
        title: "Retired file still published",
        notice: "The vendor retired this file in 2024.",
        replacement: "Publish the successor file.",
        link: "https://example.com/retired",
      },
    ]);
    expect(out.categories[0]!.warnCount).toBe(0);
  });

  it("returns an empty list when nothing obsolete was found", () => {
    expect(summarise(report()).obsoleteFound).toEqual([]);
  });

  it("passes on the notice of a check no AI vendor reads", () => {
    const out = summarise(
      report({
        categories: [
          cat({
            id: "machine-discovery",
            checks: [
              check({
                id: "machine-discovery/unread-file",
                title: "Unread file is well formed",
                tier: AuditTier.Informative,
                scoreDisplayMode: ScoreDisplayMode.Informative,
                weight: 0,
                deprecated: {
                  kind: NoticeKind.Unconsumed,
                  notice: "No AI vendor documents reading this file.",
                  link: "https://example.com/evidence",
                },
              }),
            ],
          }),
        ],
      }),
    );
    expect(out.notices).toEqual([
      {
        id: "machine-discovery/unread-file",
        title: "Unread file is well formed",
        kind: NoticeKind.Unconsumed,
        notice: "No AI vendor documents reading this file.",
        link: "https://example.com/evidence",
      },
    ]);
    expect(summarise(report()).notices).toEqual([]);
  });
});
