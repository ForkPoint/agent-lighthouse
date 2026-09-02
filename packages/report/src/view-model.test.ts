import { describe, it, expect } from "vitest";
import type {
  CategoryResult,
  CheckResult,
  ScanReport,
} from "@forkpoint/agent-lighthouse-core";
import {
  CATEGORY_MASS,
  TAG_SCAN_ERROR,
  TAG_SKIPPED_PAGE_TYPE,
} from "@forkpoint/agent-lighthouse-core";
import { buildReportView } from "./view-model";

// ── Fixtures ────────────────────────────────────────────────────

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

function report(
  categories: CategoryResult[],
  over: Partial<ScanReport> = {},
): ScanReport {
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
    ...over,
  };
}

/**
 * A category's real evidence mass, not a hand-written fraction.
 *
 * `CategoryResult.weight` carries the summed weight of the category's
 * registered audits, so a fixture that hard-codes 0.15 pins a number the
 * engine never produces and cannot notice when the real mass drifts.
 */
const mass = (id: string): number => {
  const value = CATEGORY_MASS[id];
  if (value === undefined)
    throw new Error(`no evidence mass for category ${id}`);
  return value;
};

// A report spanning two section groups with a mix of statuses on agent-interfaces.
function mixedReport(): ScanReport {
  return report([
    cat({
      id: "agent-interfaces",
      weight: mass("agent-interfaces"),
      score: 80,
      checks: [
        check({ id: "p1", status: "pass" }),
        check({ id: "w1", status: "warn", priority: "high" }),
        check({ id: "f1", status: "fail", priority: "critical" }),
        check({ id: "e1", status: "na", tags: [TAG_SCAN_ERROR] }),
        check({ id: "s1", status: "na", tags: [TAG_SKIPPED_PAGE_TYPE] }),
        check({ id: "n1", status: "na" }),
      ],
    }),
    cat({
      id: "machine-discovery",
      weight: mass("machine-discovery"),
      score: 60,
      checks: [
        check({ id: "cd1", category: "machine-discovery", status: "pass" }),
      ],
    }),
    cat({
      id: "answer-readiness",
      weight: mass("answer-readiness"),
      score: 100,
      checks: [
        check({ id: "ar1", category: "answer-readiness", status: "pass" }),
      ],
    }),
  ]);
}

// ── Tests ───────────────────────────────────────────────────────

describe("buildReportView", () => {
  it("groups categories into their section groups with a weighted roll-up score", () => {
    const v = buildReportView(mixedReport());
    // technicalFoundation has no categories present → dropped.
    expect(v.groups.map((g) => g.key)).toEqual([
      "agenticReadiness",
      "aiSearchOptimization",
    ]);
    // agenticReadiness = the two categories' scores weighted by their real
    // evidence mass, computed here from the same source the fixture uses.
    const ai = mass("agent-interfaces");
    const md = mass("machine-discovery");
    expect(v.groups[0]!.score).toBe(
      Math.round((80 * ai + 60 * md) / (ai + md)),
    );
    expect(v.groups[0]!.label).toBe("Agentic Readiness");
    // aiSearchOptimization has one category, so its roll-up is that score.
    expect(v.groups[1]!.score).toBe(100);
  });

  it("returns categories flat in canonical order regardless of input order", () => {
    const v = buildReportView(
      report([
        cat({ id: "answer-readiness" }),
        cat({ id: "agent-interfaces" }),
      ]),
    );
    // agent-interfaces precedes answer-readiness in CATEGORY_ORDER.
    expect(v.categories.map((c) => c.id)).toEqual([
      "agent-interfaces",
      "answer-readiness",
    ]);
  });

  it("splits assessed checks from not-applicable and counts them", () => {
    const v = buildReportView(mixedReport());
    const at = v.categories.find((c) => c.id === "agent-interfaces")!;
    expect(at.checks.map((c) => c.id)).toEqual(["p1", "w1", "f1"]); // assessed only
    expect(at.notApplicable.map((c) => c.id)).toEqual(["e1", "s1", "n1"]);
    expect(at.counts).toEqual({
      pass: 1,
      warn: 1,
      fail: 1,
      na: 3,
      advisory: 0,
      total: 3,
    });
  });

  it("buckets coverage by na tag across all categories", () => {
    const v = buildReportView(mixedReport());
    expect(v.coverage).toMatchObject({
      ran: 5, // p1,w1,f1 + cd1 + ar1
      errored: 1, // e1
      skippedByPageType: 1, // s1
      notApplicable: 1, // n1 (untagged na)
    });
    expect(v.coverage.erroredChecks.map((c) => c.id)).toEqual(["e1"]);
  });

  it("counts gated checks apart, and carries the reason that explains the number", () => {
    const v = buildReportView(
      report(
        [
          cat({
            id: "agent-interfaces",
            checks: [
              check({
                id: "g1",
                status: "na",
                score: 0,
                tags: ["skipped:no-evidence"],
              }),
              check({
                id: "g2",
                status: "na",
                score: 0,
                tags: ["skipped:no-evidence"],
              }),
              check({ id: "p1" }),
            ],
          }),
        ],
        {
          scanValidity: {
            judgeable: true,
            evidence: {
              "origin-reachable": true,
              "unblocked-fetches": true,
              "rendered-body": false,
              "sample-adequate": false,
            },
            reasons: {
              "rendered-body":
                "None of the 3 fetched page(s) served readable text.",
            },
          },
        },
      ),
    );

    expect(v.coverage.skippedNoEvidence).toBe(2);
    // The gated checks must not also be counted as plain not-applicable.
    expect(v.coverage.notApplicable).toBe(0);
    expect(v.coverage.noEvidenceReasons).toEqual([
      "None of the 3 fetched page(s) served readable text.",
    ]);
  });

  it("carries a null score through as null, never as zero", () => {
    const v = buildReportView(
      report([cat({ id: "agent-interfaces", checks: [check({ id: "p1" })] })], {
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
      }),
    );

    expect(v.overallScore).toBeNull();
    expect(v.scoreTier).toBeNull();
    expect(v.unscoredReason).toBe("The homepage answered HTTP 403.");
  });

  it("orders topFixes by priority (fail+warn) and topPasses by category weight", () => {
    const v = buildReportView(mixedReport());
    expect(v.topFixes.map((c) => c.id)).toEqual(["f1", "w1"]); // critical before high
    // Passes sort by owning category mass, descending. The expected order is
    // derived from the live masses rather than written out, so it stays true
    // when the registry moves audits between categories or adds them.
    const expectedOrder = (
      [
        ["p1", "agent-interfaces"],
        ["cd1", "machine-discovery"],
        ["ar1", "answer-readiness"],
      ] as const
    )
      .slice()
      .sort((a, b) => mass(b[1]) - mass(a[1]))
      .map(([id]) => id);
    expect(v.topPasses.map((c) => c.id)).toEqual(expectedOrder);
  });

  it("excludes informative checks from topFixes and topPasses", () => {
    const v = buildReportView(
      report([
        cat({
          id: "agent-interfaces",
          weight: mass("agent-interfaces"),
          checks: [
            check({
              id: "inf-fail",
              status: "fail",
              priority: "critical",
              scoreDisplayMode: "informative",
            }),
            check({ id: "norm-fail", status: "fail", priority: "high" }),
            check({
              id: "inf-pass",
              status: "pass",
              scoreDisplayMode: "informative",
            }),
            check({ id: "norm-pass", status: "pass" }),
          ],
        }),
      ]),
    );
    expect(v.topFixes.map((c) => c.id)).toEqual(["norm-fail"]);
    expect(v.topPasses.map((c) => c.id)).toEqual(["norm-pass"]);
  });

  it("honours topN for topFixes / topPasses", () => {
    const many = report([
      cat({
        id: "agent-interfaces",
        checks: Array.from({ length: 5 }, (_v, i) =>
          check({ id: `f${i}`, status: "fail", priority: "high" }),
        ),
      }),
    ]);
    expect(buildReportView(many, { topN: 2 }).topFixes).toHaveLength(2);
  });

  it("applies the priority filter to checks, categories, and recommendations", () => {
    const v = buildReportView(mixedReport(), { priority: "critical" });
    // only f1 (critical) survives → only agent-interfaces remains.
    expect(v.categories.map((c) => c.id)).toEqual(["agent-interfaces"]);
    expect(v.categories[0]!.checks.map((c) => c.id)).toEqual(["f1"]);
    expect(v.groups.map((g) => g.key)).toEqual(["agenticReadiness"]);
  });

  it("filters recommendations by priority when requested", () => {
    const r = report(
      [
        cat({
          id: "agent-interfaces",
          checks: [check({ status: "fail", priority: "low" })],
        }),
      ],
      {
        recommendations: [
          { priority: "critical", description: "crit" },
          { priority: "low", description: "low" },
        ],
      },
    );
    expect(buildReportView(r, { priority: "low" }).recommendations).toEqual([
      { priority: "low", description: "low" },
    ]);
  });

  it("guards the group roll-up against a zero total weight", () => {
    const v = buildReportView(
      report([cat({ id: "agent-interfaces", weight: 0, score: 90 })]),
    );
    expect(v.groups[0]!.score).toBe(0);
  });

  it("fills defaults for optional report fields", () => {
    const v = buildReportView(
      report([cat({ id: "agent-interfaces" })], {
        summary: undefined,
        readinessVitals: undefined,
        readinessScore: undefined,
        overallScore: 55,
      }),
    );
    expect(v.summary).toBe("");
    expect(v.vitals).toEqual({
      commerce: 0,
      content: 0,
      botAccessibility: 0,
      technical: 0,
    });
    expect(v.readinessScore).toBe(55); // falls back to overallScore
  });
});

describe("tier counts", () => {
  it("counts advisory checks per category", () => {
    const view = buildReportView(
      report([
        cat({
          id: "agent-interfaces",
          checks: [
            check({ id: "agent-interfaces/a", tier: "scored" }),
            check({
              id: "structured-data/claimreview-advisory",
              tier: "informative",
              scoreDisplayMode: "informative",
              status: "fail",
              score: 0,
            }),
          ],
        }),
      ]),
    );
    expect(view.categories[0]!.counts.advisory).toBe(1);
  });

  it("does not count a not-applicable advisory check", () => {
    const view = buildReportView(
      report([
        cat({
          id: "agent-interfaces",
          checks: [
            check({
              tier: "informative",
              scoreDisplayMode: "informative",
              status: "na",
              score: 0,
            }),
          ],
        }),
      ]),
    );
    expect(view.categories[0]!.counts.advisory).toBe(0);
  });

  it("counts an experimental check as advisory", () => {
    const view = buildReportView(
      report([
        cat({
          id: "agent-interfaces",
          checks: [check({ tier: "experimental" })],
        }),
      ]),
    );
    expect(view.categories[0]!.counts.advisory).toBe(1);
  });

  it("passes through conditions from ScanReport to ReportView", () => {
    const conditions = {
      url: "https://x.test/",
      pageType: { type: "homepage" as const, source: "detected" as const },
      origin: {
        origin: "https://x.test",
        version: "v1",
        readAt: "2026-09-02T08:00:00.000Z",
        cached: true,
      },
      coverage: {
        registryMass: 100,
        assessedMass: 85,
        pageMass: 60,
        originMass: 40,
        gatedMass: 0,
      },
      unscored: {
        totalCount: 10,
        informativeCount: 4,
        gatedCount: 0,
        reasons: { informative: 4, "not-applicable": 6 },
      },
    };

    const view = buildReportView({
      ...report([]),
      conditions,
    });

    expect(view.conditions).toEqual(conditions);
  });

  it("handles reports without conditions gracefully (backward compatibility)", () => {
    const view = buildReportView(report([]));
    expect(view.conditions).toBeUndefined();
  });
});
