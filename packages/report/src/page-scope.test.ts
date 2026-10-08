import { describe, expect, it } from "vitest";
import type { CheckResult, ScanReport } from "@forkpoint/agent-lighthouse-core";
import { buildReportView } from "./view-model";
import { generateHtmlReport } from "./html-generator";
import { generateMarkdownSummary } from "./markdown-generator";
import { hydrateReport } from "./hydrate";
import {
  AttemptOutcome,
  AuditTier,
  CheckPriority,
  CheckStatus,
  ClassificationConfidence,
  CoverageProvenance,
  PageType,
  PageTypeSource,
  ScoreDisplayMode,
  ScoreTier,
} from "@forkpoint/agent-lighthouse-core";

const declared = "https://x.test/declared";
const detected = "https://x.test/detected";
const unread = "https://x.test/unread";
const check: CheckResult = {
  id: "answer-readiness/named-author",
  category: "answer-readiness",
  title: "Named author",
  description: "An author",
  priority: CheckPriority.Medium,
  impact: "",
  fix: "",
  status: CheckStatus.Pass,
  score: 1,
  scoreDisplayMode: ScoreDisplayMode.Binary,
  tier: AuditTier.Scored,
  weight: 1,
  coverage: {
    provenance: CoverageProvenance.Declared,
    selectedUrls: [declared, unread],
    inputUrls: [declared],
    unreadUrls: [unread],
  },
  advisoryResults: [
    {
      id: "answer-readiness/named-author",
      category: "answer-readiness",
      title: "Named author",
      description: "An author",
      priority: CheckPriority.Medium,
      impact: "",
      status: CheckStatus.Fail,
      score: 0,
      scoreDisplayMode: ScoreDisplayMode.Informative,
      tier: AuditTier.Scored,
      weight: 1,
      explanation: "Detected article lacks an author.",
      fix: "Name the author.",
      coverage: {
        provenance: CoverageProvenance.Detected,
        selectedUrls: [detected],
        inputUrls: [detected],
        unreadUrls: [],
      },
    },
  ],
};
function report(): ScanReport {
  return {
    scanId: "scope",
    url: declared,
    domain: "x.test",
    overallScore: 100,
    scoreTier: ScoreTier.AgentReady,
    categories: [
      {
        id: "answer-readiness",
        name: "Answer Readiness",
        weight: 1,
        score: 100,
        passCount: 1,
        warnCount: 0,
        failCount: 0,
        checks: [structuredClone(check)],
      },
    ],
    topPasses: [check],
    topFails: [],
    recommendations: [],
    durationMs: 1,
    scannedAt: "2026-10-07T00:00:00Z",
    pagesScanned: [
      {
        url: detected,
        pageType: PageType.Article,
        classification: {
          type: PageType.Article,
          source: PageTypeSource.Detected,
          confidence: ClassificationConfidence.Hint,
          signals: ["Article URL hint"],
        },
      },
    ],
    pageAttempts: [
      {
        url: unread,
        pageType: PageType.Article,
        source: PageTypeSource.Declared,
        outcome: AttemptOutcome.Unread,
        status: 503,
      },
    ],
  };
}

describe("page scope reports", () => {
  it("retains both populations without changing counts, scores, or top fixes", () => {
    const view = buildReportView(report());
    expect(view.pageScope?.audits[0]?.assessments).toHaveLength(2);
    expect(view.pageScope?.audits[0]?.assessments[1]).toMatchObject({
      advisory: true,
      status: CheckStatus.Fail,
      coverage: check.advisoryResults![0]!.coverage,
    });
    expect(view.categories[0]?.counts).toMatchObject({
      pass: 1,
      fail: 0,
      total: 1,
    });
    expect(view.overallScore).toBe(100);
    expect(view.topFixes).toEqual([]);
  });
  it.each([generateHtmlReport, generateMarkdownSummary])(
    "renders uncertainty, unread URLs, and the advisory failure",
    (render) => {
      const output = render(report());
      for (const text of [
        "Page scope",
        "Detected article lacks an author.",
        "Advisory — not scored",
        "Unread URLs",
        unread,
        detected,
        "hint",
        "Article URL hint",
        "503",
      ])
        expect(output).toContain(text);
    },
  );
  it("keeps advisory errors visible when the primary result is not assessed", () => {
    const r = report();
    const c = r.categories[0]!.checks[0]!;
    c.status = CheckStatus.NotApplicable;
    c.advisoryResults![0]!.status = CheckStatus.NotApplicable;
    c.advisoryResults![0]!.explanation = "Audit failed to run: schema error";
    expect(generateHtmlReport(r)).toContain(
      "Audit failed to run: schema error",
    );
    expect(generateMarkdownSummary(r)).toContain(
      "Audit failed to run: schema error",
    );
  });
  it("escapes scanned text in HTML and Markdown", () => {
    const r = report();
    r.categories[0]!.checks[0]!.advisoryResults![0]!.explanation =
      "</pre><script>alert(1)</script>";
    for (const render of [generateHtmlReport, generateMarkdownSummary]) {
      expect(render(r)).not.toContain("</pre><script>alert(1)</script>");
      expect(render(r)).toContain("&lt;script&gt;");
    }
  });
  it("keeps old reports readable without inventing coverage", () => {
    const r = report();
    delete r.pageAttempts;
    delete r.pagesScanned[0]!.classification;
    delete r.categories[0]!.checks[0]!.coverage;
    delete r.categories[0]!.checks[0]!.advisoryResults;
    expect(buildReportView(r).pageScope).toBeUndefined();
    expect(generateHtmlReport(r)).not.toContain("Unread URLs");
    expect(generateMarkdownSummary(r)).not.toContain("Unread URLs");
  });
  it("retains persisted classification and attempts without rewriting old rows", () => {
    const r = report();
    const row = {
      id: r.scanId,
      url: r.url,
      domain: r.domain,
      overallScore: 100,
      scoreTier: r.scoreTier,
      categoryScores: { "answer-readiness": 100 },
      checkResults: r.categories[0]!.checks,
      recommendations: [],
      pagesData: r.pagesScanned,
      pageAttempts: r.pageAttempts,
      durationMs: 1,
      readinessScore: null,
      readinessVitals: null,
    };
    const saved = structuredClone(row);
    const restored = hydrateReport(row);
    expect(restored.pageAttempts).toEqual(r.pageAttempts);
    expect(buildReportView(restored).pageScope).toEqual(
      buildReportView(r).pageScope,
    );
    expect(row).toEqual(saved);
  });
});

it("public page schemas round-trip new data and preserve old saved pages", async () => {
  const { ScannedPageSchema, PageAttemptSchema, CheckResultSchema } =
    await import("@forkpoint/agent-lighthouse-core");
  const r = report();
  expect(ScannedPageSchema.parse(r.pagesScanned[0])).toEqual(r.pagesScanned[0]);
  expect(PageAttemptSchema.parse(r.pageAttempts![0])).toEqual(
    r.pageAttempts![0],
  );
  expect(CheckResultSchema.parse(check)).toEqual(check);
  const old = { url: declared, pageType: PageType.Content };
  expect(ScannedPageSchema.parse(old)).toEqual(old);
});

it("keeps the existing missing-pages fallback for old report readers", () => {
  const r = report();
  delete (r as Partial<ScanReport>).pagesScanned;
  delete r.pageAttempts;
  r.categories = [];
  const view = buildReportView(r);
  expect(view.pagesScanned).toEqual([]);
  expect(view.pageScope).toBeUndefined();
});

it("lists only audits whose population differs from a full-sample pass", () => {
  const r = report();
  const plain: CheckResult = {
    ...check,
    id: "content-extraction/plain-pass",
    advisoryResults: undefined,
    coverage: {
      provenance: CoverageProvenance.All,
      selectedUrls: [declared],
      inputUrls: [declared],
      unreadUrls: [],
    },
  };
  const failing: CheckResult = {
    ...plain,
    id: "content-extraction/plain-fail",
    status: CheckStatus.Fail,
    score: 0,
  };
  r.categories[0]!.checks.push(plain, failing);
  const ids = buildReportView(r).pageScope?.audits.map((a) => a.id);
  expect(ids).toContain(check.id);
  expect(ids).toContain(failing.id);
  expect(ids).not.toContain(plain.id);
});
