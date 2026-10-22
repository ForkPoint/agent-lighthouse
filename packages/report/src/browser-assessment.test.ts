import { describe, expect, it } from "vitest";
import {
  BrowserAssessmentSchema,
  ScanReportSchema,
  CaptureSource,
  DocumentState,
  EvidenceSource,
  CheckPriority,
  CheckStatus,
  ScoreDisplayMode,
} from "@forkpoint/agent-lighthouse-core";
import type { ScanReport } from "@forkpoint/agent-lighthouse-core";
import { buildReportView } from "./view-model";
import { hydrateReport } from "./hydrate";
import { generateHtmlReport } from "./html-generator";
import { generateMarkdownSummary } from "./markdown-generator";
import { formatBrowserAssessment } from "./browser-assessment";

function report(): ScanReport {
  return {
    scanId: "snapshot",
    url: "https://example.test/",
    domain: "example.test",
    overallScore: null,
    scoreTier: null,
    categories: [],
    topPasses: [],
    topFails: [],
    recommendations: [],
    pagesScanned: [],
    scannedAt: "2026-10-13T10:00:00Z",
    durationMs: 1,
    browserAssessment: {
      version: 1,
      evidenceSource: EvidenceSource.BrowserSnapshot,
      score: null,
      unscoredReason: "No browser scoring denominator.",
      captures: [CaptureSource.CurrentTab, CaptureSource.FreshBrowser].map(
        (captureSource) => ({
          requestedUrl: "https://example.test/",
          capturedUrl: "https://example.test/",
          capturedAt: "2026-10-13T10:00:00Z",
          captureSource,
          collector: { name: "</pre><script>alert(1)</script>", version: "1" },
          documentState: DocumentState.Complete,
          truncation: { truncated: false },
          redaction: { redacted: false, fields: [] },
        }),
      ),
      findings: [
        {
          evidenceSource: EvidenceSource.BrowserSnapshot,
          pageUrl: "https://example.test/",
          captureSource: CaptureSource.CurrentTab,
          check: {
            id: "structured-data/json-ld-present",
            category: "structured-data",
            title: "JSON-LD present",
            description: "DOM only",
            status: CheckStatus.Pass,
            score: 1,
            scoreDisplayMode: ScoreDisplayMode.Informative,
            weight: 0,
            priority: CheckPriority.Low,
            impact: "",
            fix: "",
            explanation: "</pre><script>alert(2)</script>",
          },
        },
      ],
      coverage: {
        eligibleAuditIds: ["structured-data/json-ld-present"],
        eligible: 2,
        assessed: 1,
      },
      missingEvidence: [
        {
          auditId: "structured-data/json-ld-present",
          pageUrl: "https://example.test/",
          reason: "The snapshot is truncated",
        },
      ],
      notEligible: [
        {
          auditIds: ["content-extraction/server-rendered"],
          reason: "Requires HTTP evidence",
        },
      ],
      limits: ["No action success proof"],
    },
  };
}
describe("browser assessment report surfaces", () => {
  it("round trips the output and keeps old reports valid", () => {
    const r = report();
    expect(ScanReportSchema.parse(JSON.parse(JSON.stringify(r)))).toEqual(r);
    expect(BrowserAssessmentSchema.parse(r.browserAssessment)).toEqual(
      r.browserAssessment,
    );
    const { browserAssessment: _browser, ...old } = r;
    expect(ScanReportSchema.parse(old)).toEqual(old);
  });
  it("preserves the separate population in the view and persisted row", () => {
    const r = report();
    expect(buildReportView(r).browserAssessment).toEqual(r.browserAssessment);
    const restored = hydrateReport({
      id: r.scanId,
      url: r.url,
      domain: r.domain,
      overallScore: null,
      scoreTier: null,
      categoryScores: null,
      checkResults: null,
      recommendations: null,
      pagesData: null,
      durationMs: 1,
      readinessScore: null,
      readinessVitals: null,
      browserAssessment: r.browserAssessment,
    });
    expect(restored.browserAssessment).toEqual(r.browserAssessment);
    expect(restored.topPasses).toEqual([]);
    expect(restored.overallScore).toBeNull();
  });
  it.each([generateHtmlReport, generateMarkdownSummary])(
    "renders capture sources, coverage, findings and missing evidence safely",
    (render) => {
      const output = render(report());
      expect(output).toContain("Browser agent assessment");
      expect(output).toContain("Current tab");
      expect(output).toContain("Fresh browser");
      expect(output).toContain("1/2");
      expect(output).toContain("JSON-LD present");
      expect(output).toContain("Requires HTTP evidence");
      expect(output).toContain("The snapshot is truncated");
      expect(output).not.toContain("</pre><script>alert(");
      expect(output).toContain("&lt;script&gt;");
    },
  );
  it("keeps saved multi-line capture labels on one line in every renderer", () => {
    const r = report();
    r.browserAssessment!.captures[0]!.collector.name =
      "x\n\n![t](https://tracker.example/p.png)";
    const text = formatBrowserAssessment(r.browserAssessment!);
    expect(text).toContain("collector: x ![t](https://tracker.example/p.png)");
    expect(text).not.toMatch(/\n\s*\n/);
    expect(generateMarkdownSummary(r)).not.toMatch(/\n\s*\n!\[t\]/);
  });
  it("renders terminal text without client terminal control sequences", () => {
    const r = report();
    r.browserAssessment!.captures[0]!.collector.name = "evil\u001b[2J";
    const output = formatBrowserAssessment(r.browserAssessment!);
    expect(output).toContain("Current tab");
    expect(output).toContain("Fresh browser");
    expect(output).toContain("1/2");
    expect(output).not.toContain("\u001b");
  });
  it.each([CheckStatus.Fail, CheckStatus.Warn, CheckStatus.Pass])(
    "shows fixes only for failed or warning findings: %s",
    (status) => {
      const assessment = report().browserAssessment!;
      const finding = assessment.findings[0]!;
      finding.captureSource = CaptureSource.FreshBrowser;
      finding.check.status = status;
      finding.check.fix = "Add the missing markup.";
      const output = formatBrowserAssessment(assessment);
      expect(output).toContain("Fresh browser / browser-snapshot:");
      expect(output.includes("Fix: Add the missing markup.")).toBe(
        status === CheckStatus.Fail || status === CheckStatus.Warn,
      );
    },
  );

  it("uses display text and then a clear fallback when explanations are absent", () => {
    const assessment = report().browserAssessment!;
    const check = assessment.findings[0]!.check;
    check.displayValue = "Readable markup";
    expect(formatBrowserAssessment(assessment)).not.toContain(
      "Readable markup",
    );
    delete check.explanation;
    expect(formatBrowserAssessment(assessment)).toContain("Readable markup");
    delete check.displayValue;
    expect(formatBrowserAssessment(assessment)).toContain("No explanation.");
  });

  it("keeps redaction fields on one line and names grouped exclusions", () => {
    const assessment = report().browserAssessment!;
    assessment.captures[0]!.redaction = {
      redacted: true,
      fields: ["account\nemail", "session\u2028token"],
    };
    assessment.missingEvidence = [];
    assessment.notEligible[0]!.auditIds.push("access-crawl-control/robots-txt");
    const output = formatBrowserAssessment(assessment);
    expect(output).toContain("redacted: true (account email, session token)");
    expect(output).not.toContain("Missing evidence:");
    expect(output).toContain("Not eligible for snapshot evidence (2 audits):");
    expect(output).toContain(
      "content-extraction/server-rendered, access-crawl-control/robots-txt",
    );
  });
});
