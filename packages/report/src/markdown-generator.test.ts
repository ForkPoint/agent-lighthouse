import { describe, it, expect } from "vitest";
import type {
  CategoryResult,
  CheckResult,
  ScanReport,
} from "@forkpoint/agent-lighthouse-core";
import { generateMarkdownSummary } from "./markdown-generator";

function check(over: Partial<CheckResult> = {}): CheckResult {
  return {
    id: "c",
    category: "agent-interfaces",
    title: "title",
    description: "desc",
    status: "pass",
    score: 1,
    scoreDisplayMode: "binary",
    priority: "medium",
    impact: "",
    fix: "",
    ...over,
  };
}

function cat(over: Partial<CategoryResult> & { id: string }): CategoryResult {
  const checks = over.checks ?? [];
  return {
    name: over.id,
    weight: 0.1,
    score: 0,
    passCount: 0,
    warnCount: 0,
    failCount: 0,
    ...over,
    checks,
  };
}

function report(categories: CategoryResult[]): ScanReport {
  return {
    scanId: "s1",
    url: "https://x.test/",
    domain: "x.test",
    overallScore: 42,
    scoreTier: "needs-work",
    categories,
    topPasses: [],
    topFails: [],
    recommendations: [],
    pagesScanned: [{ url: "https://x.test/", pageType: "homepage" }],
    scannedAt: "2026-01-01T00:00:00.000Z",
    durationMs: 1234,
  };
}

describe("generateMarkdownSummary", () => {
  it("states how many checks were advisory", () => {
    const md = generateMarkdownSummary(
      report([
        cat({
          id: "agent-interfaces",
          checks: [
            check({ tier: "scored" }),
            check({
              id: "adv",
              tier: "informative",
              scoreDisplayMode: "informative",
            }),
          ],
        }),
      ]),
    );
    expect(md).toContain("1 advisory check ran");
  });

  it("says nothing about advisories when there are none", () => {
    const md = generateMarkdownSummary(
      report([
        cat({ id: "agent-interfaces", checks: [check({ tier: "scored" })] }),
      ]),
    );
    expect(md).not.toContain("advisory");
  });

  it("pluralises the advisory count", () => {
    const md = generateMarkdownSummary(
      report([
        cat({
          id: "agent-interfaces",
          checks: [
            check({
              id: "a",
              tier: "informative",
              scoreDisplayMode: "informative",
            }),
            check({ id: "b", tier: "experimental" }),
          ],
        }),
      ]),
    );
    expect(md).toContain("2 advisory checks ran");
  });
});

describe("generateMarkdownSummary — an unscored scan", () => {
  it("says not scored, with the reason, instead of printing a number", () => {
    const md = generateMarkdownSummary({
      ...report([]),
      overallScore: null,
      scoreTier: null,
      scanValidity: {
        judgeable: false,
        evidence: {
          "origin-reachable": false,
          "unblocked-fetches": true,
          "rendered-body": false,
          "sample-adequate": false,
        },
        reasons: { "origin-reachable": "The homepage answered HTTP 403." },
        unscoredReason: "The homepage answered HTTP 403.",
      },
    });

    expect(md).toContain("_Not scored_");
    expect(md).toContain("HTTP 403");
    expect(md).not.toContain("/100");
  });
});

describe("generateMarkdownSummary — scan conditions", () => {
  it("renders the scan conditions section when conditions are present", () => {
    const md = generateMarkdownSummary({
      ...report([]),
      conditions: {
        url: "https://x.test/",
        pageType: { type: "homepage", source: "detected" },
        origin: {
          origin: "https://x.test",
          version: "v1",
          readAt: "2026-09-02T08:00:00.000Z",
          cached: true,
        },
        coverage: {
          registryMass: 102.6,
          assessedMass: 94.2,
          pageMass: 70.8,
          originMass: 31.8,
          gatedMass: 0,
        },
        unscored: {
          totalCount: 15,
          informativeCount: 8,
          gatedCount: 0,
          reasons: { informative: 8, "not-applicable": 7 },
        },
      },
    });

    expect(md).toContain("**Scan Conditions:**");
    expect(md).toContain("`homepage` (detected)");
    expect(md).toContain("`cached` (version: `v1`");
    expect(md).toContain("`94.2 / 102.6` mass (92%)");
    expect(md).toContain("`15` (8 advisory, 0 gated)");
  });

  it("handles zero registryMass cleanly in markdown without NaN%", () => {
    const md = generateMarkdownSummary({
      ...report([]),
      conditions: {
        url: "https://x.test/",
        pageType: { type: "homepage", source: "detected" },
        origin: {
          origin: "https://x.test",
          version: "v1",
          readAt: "2026-09-02T08:00:00.000Z",
          cached: false,
        },
        coverage: {
          registryMass: 0,
          assessedMass: 0,
          pageMass: 0,
          originMass: 0,
          gatedMass: 0,
        },
        unscored: {
          totalCount: 0,
          informativeCount: 0,
          gatedCount: 0,
          reasons: {},
        },
      },
    });

    expect(md).not.toContain("NaN%");
    expect(md).toContain("`0 / 0` mass (0%)");
    expect(md).toContain("`fresh`");
  });
});

describe("scan conditions — the budget line", () => {
  const conditions = {
    url: "https://x.test/",
    pageType: { type: "homepage" as const, source: "detected" as const },
    origin: {
      origin: "https://x.test",
      version: "v1",
      readAt: "2026-09-02T08:00:00.000Z",
      cached: false,
    },
    coverage: {
      registryMass: 100,
      assessedMass: 50,
      pageMass: 70,
      originMass: 30,
      gatedMass: 0,
    },
    unscored: {
      totalCount: 10,
      informativeCount: 8,
      gatedCount: 0,
      reasons: { informative: 8, "skipped-scan-budget": 2 },
    },
  };

  it("names the budget the scan stayed inside", () => {
    const md = generateMarkdownSummary({
      ...report([]),
      conditions: {
        ...conditions,
        budget: {
          limitMs: 180_000,
          elapsedMs: 42_400,
          exhausted: false,
          skippedCount: 0,
        },
      },
    });
    expect(md).toContain("- **Budget:** `42 s` of 180 s");
  });

  it("says the budget ran out and how many audits it cut", () => {
    const md = generateMarkdownSummary({
      ...report([]),
      conditions: {
        ...conditions,
        budget: {
          limitMs: 180_000,
          elapsedMs: 180_210,
          exhausted: true,
          skippedCount: 37,
        },
      },
    });
    expect(md).toContain(
      "- **Budget:** `ran out` at 180 s — 37 audits not assessed",
    );
  });

  it("says there was no budget when it was disabled", () => {
    const md = generateMarkdownSummary({
      ...report([]),
      conditions: {
        ...conditions,
        budget: {
          limitMs: 0,
          elapsedMs: 9_000,
          exhausted: false,
          skippedCount: 0,
        },
      },
    });
    expect(md).toContain("- **Budget:** `none` (9 s elapsed)");
  });

  it("prints no budget line for a report written before the budget existed", () => {
    const md = generateMarkdownSummary({ ...report([]), conditions });
    expect(md).not.toContain("**Budget:**");
  });
});
