import { describe, it, expect } from "vitest";
import { toPortableReport, hydratePortableReport } from "./portable-report";
import { PortableScanReportSchema, ScanReportSchema } from "./schemas";
import {
  CheckPriority,
  CheckStatus,
  EvidenceKey,
  PageType,
  ScoreDisplayMode,
  ScoreTier,
} from "./types";
import type { CheckResult, ScanReport } from "./contracts";

function makeCheck(
  over: Partial<CheckResult> & { id: string; category: string },
): CheckResult {
  return {
    title: "Test Check Title",
    description: "Test Check Description",
    status: CheckStatus.Pass,
    score: 1,
    weight: 1,
    scoreDisplayMode: ScoreDisplayMode.Binary,
    priority: CheckPriority.Medium,
    impact: "Impact text",
    fix: "Fix text",
    ...over,
  };
}

function makeReport(over: Partial<ScanReport> = {}): ScanReport {
  const check1 = makeCheck({
    id: "access-crawl-control/canonical",
    category: "access-crawl-control",
    status: CheckStatus.Pass,
    score: 1,
    weight: 1,
  });

  const check2 = makeCheck({
    id: "access-crawl-control/no-nofollow",
    category: "access-crawl-control",
    status: CheckStatus.Fail,
    score: 0,
    weight: 1,
    priority: CheckPriority.Critical,
    explanation: "Robots directives were missing.",
    displayValue: "404 Not Found",
  });

  const check3 = makeCheck({
    id: "structured-data/service-schema",
    category: "structured-data",
    status: CheckStatus.Pass,
    score: 1,
    weight: 0.6,
  });

  const allChecks = [check1, check2, check3];

  return {
    scanId: "scan-test-123",
    url: "https://example.com/",
    domain: "example.com",
    overallScore: 67,
    scoreTier: ScoreTier.NeedsWork,
    summary: "Scan summary placeholder",
    categories: [
      {
        id: "access-crawl-control",
        name: "Access & Crawl Control",
        weight: 2,
        score: 50,
        checks: [check1, check2],
        passCount: 1,
        warnCount: 0,
        failCount: 1,
        registryMass: 2,
        assessedMass: 2,
      },
      {
        id: "structured-data",
        name: "Structured Data",
        weight: 0.6,
        score: 100,
        checks: [check3],
        passCount: 1,
        warnCount: 0,
        failCount: 0,
        registryMass: 0.6,
        assessedMass: 0.6,
      },
    ],
    topPasses: [check1, check3],
    topFails: [check2],
    categoryScores: {
      "access-crawl-control": 50,
      "structured-data": 100,
    },
    checkResults: allChecks,
    recommendations: [
      {
        priority: CheckPriority.Critical,
        description: `${check2.title}: ${check2.fix}`,
      },
    ],
    pagesScanned: [
      { url: "https://example.com/", pageType: PageType.Homepage },
    ],
    scannedAt: "2026-11-15T20:00:00.000Z",
    durationMs: 1200,
    readinessScore: 60,
    readinessVitals: {
      commerce: 100,
      content: 0,
      botAccessibility: 50,
      technical: 0,
    },
    ...over,
  };
}

describe("PortableScanReport", () => {
  it("converts a ScanReport into a valid PortableScanReport", () => {
    const report = makeReport();
    const portable = toPortableReport(report);

    expect(portable.schemaVersion).toBe(1);
    expect(portable.coreVersion).toBeDefined();
    expect(portable.scanId).toBe(report.scanId);
    expect(portable.url).toBe(report.url);
    expect(portable.domain).toBe(report.domain);
    expect(portable.overallScore).toBe(report.overallScore);
    expect(portable.scoreTier).toBe(report.scoreTier);
    expect(portable.checks).toHaveLength(3);

    // Verify macro derived properties are omitted from portable payload
    const rawPortable = portable as unknown as Record<string, unknown>;
    expect(rawPortable["categories"]).toBeUndefined();
    expect(rawPortable["topPasses"]).toBeUndefined();
    expect(rawPortable["topFails"]).toBeUndefined();
    expect(rawPortable["recommendations"]).toBeUndefined();
    expect(rawPortable["summary"]).toBeUndefined();
    expect(rawPortable["readinessVitals"]).toBeUndefined();

    // Verify check properties are stripped of static prose
    const p0 = portable.checks[0]!;
    const rawP0 = p0 as unknown as Record<string, unknown>;
    expect(rawP0["title"]).toBeUndefined();
    expect(rawP0["description"]).toBeUndefined();
    expect(rawP0["impact"]).toBeUndefined();
    expect(rawP0["fix"]).toBeUndefined();
    expect(rawP0["category"]).toBeUndefined();
    expect(rawP0["weight"]).toBeUndefined();

    // Validates against Zod schema
    expect(PortableScanReportSchema.parse(portable)).toBeDefined();
  });

  it("losslessly hydrates a PortableScanReport back into a ScanReport", () => {
    const report = makeReport();
    const portable = toPortableReport(report);
    const hydrated = hydratePortableReport(portable);

    expect(hydrated.scanId).toBe(report.scanId);
    expect(hydrated.url).toBe(report.url);
    expect(hydrated.domain).toBe(report.domain);
    expect(hydrated.overallScore).toBe(report.overallScore);
    expect(hydrated.scoreTier).toBe(report.scoreTier);
    expect(hydrated.durationMs).toBe(report.durationMs);
    expect(hydrated.scannedAt).toBe(report.scannedAt);

    // Categories are rebuilt
    expect(hydrated.categories.length).toBeGreaterThanOrEqual(2);
    const acc = hydrated.categories.find(
      (c) => c.id === "access-crawl-control",
    )!;
    expect(acc).toBeDefined();
    expect(acc.score).toBe(50);
    expect(acc.passCount).toBe(1);
    expect(acc.failCount).toBe(1);

    // Checks have static titles and metadata reinstated from registry
    const canonicalCheck = hydrated.checkResults!.find(
      (c) => c.id === "access-crawl-control/canonical",
    )!;
    expect(canonicalCheck).toBeDefined();
    expect(canonicalCheck.title).toBeDefined();
    expect(canonicalCheck.description).toBeDefined();
    expect(canonicalCheck.fix).toBeDefined();
    expect(canonicalCheck.impact).toBeDefined();
    expect(canonicalCheck.category).toBe("access-crawl-control");
    expect(canonicalCheck.evidenceGrade).toBe("A");
    expect(canonicalCheck.tier).toBe("scored");

    // Recommendations and top passes/fails are restored
    expect(hydrated.topFails).toHaveLength(1);
    expect(hydrated.topFails[0]!.id).toBe("access-crawl-control/no-nofollow");
    expect(hydrated.topPasses.map((c) => c.id)).toContain(
      "access-crawl-control/canonical",
    );
    expect(hydrated.recommendations.length).toBeGreaterThanOrEqual(1);

    // Summary is regenerated
    expect(hydrated.summary).toBeDefined();
    expect(hydrated.summary!.length).toBeGreaterThan(0);

    // Validates against full ScanReportSchema
    expect(ScanReportSchema.parse(hydrated)).toBeDefined();
  });

  it("preserves unjudgeable scans with null overallScore and scoreTier", () => {
    const report = makeReport({
      overallScore: null,
      scoreTier: null,
      scanValidity: {
        judgeable: false,
        evidence: {
          [EvidenceKey.OriginReachable]: false,
          [EvidenceKey.UnblockedFetches]: false,
          [EvidenceKey.RenderedBody]: false,
          [EvidenceKey.SampleAdequate]: false,
        },
        reasons: {
          [EvidenceKey.OriginReachable]: "Host unreachable",
        },
        unscoredReason: "Host unreachable",
      },
    });

    const portable = toPortableReport(report);
    expect(portable.overallScore).toBeNull();
    expect(portable.scoreTier).toBeNull();
    expect(portable.scanValidity?.judgeable).toBe(false);

    const hydrated = hydratePortableReport(portable);
    expect(hydrated.overallScore).toBeNull();
    expect(hydrated.scoreTier).toBeNull();
    expect(hydrated.scanValidity?.judgeable).toBe(false);
  });

  it("preserves dynamic runtime overrides (priority, remediation, tags)", () => {
    const customFix = "Special bespoke server configuration needed.";
    const report = makeReport({
      checkResults: [
        makeCheck({
          id: "access-crawl-control/canonical",
          category: "access-crawl-control",
          status: CheckStatus.Fail,
          score: 0,
          priority: CheckPriority.Critical, // overridden from default medium
          fix: customFix,
          tags: ["skipped:no-evidence"],
        }),
      ],
    });

    const portable = toPortableReport(report);
    const pCheck = portable.checks.find(
      (c) => c.id === "access-crawl-control/canonical",
    )!;
    expect(pCheck.priority).toBe(CheckPriority.Critical);
    expect(pCheck.remediation).toBe(customFix);
    expect(pCheck.tags).toEqual(["skipped:no-evidence"]);

    const hydrated = hydratePortableReport(portable);
    const hCheck = hydrated.checkResults!.find(
      (c) => c.id === "access-crawl-control/canonical",
    )!;
    expect(hCheck.priority).toBe(CheckPriority.Critical);
    expect(hCheck.fix).toBe(customFix);
    expect(hCheck.tags).toContain("skipped:no-evidence");
  });

  it("gracefully inflates custom or unknown audit IDs not present in registry", () => {
    const portable = {
      schemaVersion: 1 as const,
      coreVersion: "10.6.0",
      scanId: "scan-custom",
      url: "https://example.com/",
      domain: "example.com",
      overallScore: 80,
      scoreTier: ScoreTier.PartiallyReady,
      scannedAt: "2026-11-15T20:00:00.000Z",
      durationMs: 500,
      pagesScanned: [
        { url: "https://example.com/", pageType: PageType.Homepage },
      ],
      checks: [
        {
          id: "custom-category/unknown-audit",
          status: CheckStatus.Pass,
          score: 1,
          displayValue: "Custom observation",
        },
      ],
    };

    const hydrated = hydratePortableReport(portable);
    expect(hydrated.checkResults).toHaveLength(1);
    const check = hydrated.checkResults![0]!;
    expect(check.id).toBe("custom-category/unknown-audit");
    expect(check.category).toBe("custom-category");
    expect(check.status).toBe(CheckStatus.Pass);
    expect(check.displayValue).toBe("Custom observation");
  });
});
