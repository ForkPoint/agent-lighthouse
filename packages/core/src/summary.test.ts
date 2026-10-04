import { describe, it, expect } from "vitest";
import type { CategoryResult, CheckResult, ScanReport } from "./types";
import { generateScanSummary } from "./summary";

function makeCheck(status: CheckResult["status"] = "pass"): CheckResult {
  return {
    id: "c",
    category: "cat",
    title: "T",
    description: "D",
    status,
    score: status === "pass" ? 1 : 0,
    scoreDisplayMode: "binary",
    priority: "medium",
    impact: "i",
    fix: "f",
    weight: 1,
  };
}

function makeCategory(overrides: Partial<CategoryResult> = {}): CategoryResult {
  return {
    id: "cat",
    name: "Category",
    weight: 0.5,
    score: 50,
    checks: [makeCheck()],
    passCount: 1,
    warnCount: 0,
    failCount: 0,
    ...overrides,
  };
}

describe("generateScanSummary", () => {
  it("says the scan was not scored when the overall score is null", () => {
    const summary = generateScanSummary({
      domain: "example.com",
      overallScore: null,
      scoreTier: null,
      categories: [makeCategory()],
    });
    expect(summary).toContain(
      "Scan Report for example.com: not scored — this scan obtained too little evidence to judge the site.",
    );
    expect(summary).not.toContain("null%");
  });

  it("never names an unassessed category as the weakest", () => {
    const summary = generateScanSummary({
      domain: "example.com",
      overallScore: 70,
      scoreTier: "partially-ready",
      categories: [
        makeCategory({ id: "a", name: "Strong", score: 90 }),
        makeCategory({ id: "b", name: "Middling", score: 60 }),
        // Ran no checks at all: its 0 is "no data".
        makeCategory({
          id: "c",
          name: "Commerce",
          score: 0,
          checks: [],
          assessedMass: 0,
          passCount: 0,
        }),
      ],
    });
    expect(summary).toContain("Primary Improvement Area: Middling (60%).");
    expect(summary).not.toContain("Commerce (0%)");
  });

  it("builds a full summary with tier, vitals, strongest and weakest", () => {
    const report: Partial<ScanReport> = {
      domain: "example.com",
      overallScore: 72,
      scoreTier: "partially-ready",
      readinessVitals: {
        commerce: 80,
        content: 60,
        botAccessibility: 40,
        technical: 90,
      },
      categories: [
        makeCategory({
          id: "strong",
          name: "Strong",
          score: 95,
          passCount: 2,
          checks: [makeCheck(), makeCheck()],
        }),
        makeCategory({
          id: "weak",
          name: "Weak",
          score: 20,
          passCount: 0,
          failCount: 1,
          checks: [makeCheck("fail")],
        }),
      ],
      recommendations: [
        { priority: "critical", description: "x" },
        { priority: "critical", description: "y" },
        { priority: "high", description: "z" },
        { priority: "low", description: "w" },
      ],
    };

    const summary = generateScanSummary(report);

    expect(summary).toContain(
      "Scan Report for example.com: Overall Readiness 72% (Partially Ready).",
    );
    expect(summary).toContain(
      "Commerce 80%, Content 60%, AI Bot Accessibility 40%, Technical Readiness 90%.",
    );
    expect(summary).toContain("2 of 3 checks passed.");
    expect(summary).toContain("2 critical, 1 high priority findings.");
    expect(summary).toContain("Top Strength: Strong (95%).");
    expect(summary).toContain("Primary Improvement Area: Weak (20%).");
  });

  it("uses N/A when a scored report has no tier", () => {
    const summary = generateScanSummary({ domain: "x.com", overallScore: 50 });
    expect(summary).toContain("Overall Readiness 50% (N/A).");
  });

  it("reads a report with no score as not scored and applies defaults", () => {
    const summary = generateScanSummary({ domain: "empty.com" });

    expect(summary).toContain("Scan Report for empty.com: not scored");
    expect(summary).toContain(
      "Commerce 0%, Content 0%, AI Bot Accessibility 0%, Technical Readiness 0%.",
    );
    expect(summary).toContain("0 of 0 checks passed.");
    expect(summary).toContain("0 critical, 0 high priority findings.");
    // No categories → no strength / improvement lines.
    expect(summary).not.toContain("Top Strength");
    expect(summary).not.toContain("Primary Improvement Area");
  });

  it("shows a strength but no improvement area for a single category", () => {
    const summary = generateScanSummary({
      domain: "one.com",
      scoreTier: "agent-ready",
      categories: [makeCategory({ id: "only", name: "Only", score: 88 })],
    });

    expect(summary).toContain("Top Strength: Only (88%).");
    expect(summary).not.toContain("Primary Improvement Area");
  });

  it("omits improvement area when strongest and weakest share an id", () => {
    const shared = makeCategory({ id: "same", name: "Same", score: 50 });
    const summary = generateScanSummary({
      domain: "dup.com",
      categories: [
        shared,
        makeCategory({ id: "same", name: "Same", score: 50 }),
      ],
    });

    expect(summary).toContain("Top Strength: Same (50%).");
    expect(summary).not.toContain("Primary Improvement Area");
  });
});
