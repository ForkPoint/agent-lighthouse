import { describe, it, expect } from "vitest";
import { runScan } from "../orchestrator";
import { ScanConditionsSchema } from "../schemas";
import { defaultConfig } from "../audit-config";

describe("Phase 6: The score states its conditions", () => {
  it("populates valid conditions adhering to ScanConditionsSchema", async () => {
    const report = await runScan("https://example.com");

    expect(report.conditions).toBeDefined();
    const parsed = ScanConditionsSchema.safeParse(report.conditions);
    expect(parsed.success).toBe(true);

    const conditions = report.conditions!;
    expect(conditions.url).toBe("https://example.com");
    expect(conditions.origin.origin).toBe("https://example.com");
    expect(conditions.origin.version).toBeDefined();
    expect(conditions.origin.readAt).toBeDefined();
    expect(typeof conditions.origin.cached).toBe("boolean");

    // Coverage mass breakdown
    expect(conditions.coverage.registryMass).toBeGreaterThan(0);
    expect(conditions.coverage.assessedMass).toBeGreaterThanOrEqual(0);
    expect(conditions.coverage.pageMass).toBeGreaterThan(0);
    expect(conditions.coverage.originMass).toBeGreaterThan(0);
    expect(
      Number(
        (
          conditions.coverage.pageMass + conditions.coverage.originMass
        ).toFixed(1),
      ),
    ).toBe(conditions.coverage.registryMass);

    // Unscored breakdown
    expect(conditions.unscored.totalCount).toBeGreaterThanOrEqual(0);
    expect(conditions.unscored.informativeCount).toBeGreaterThanOrEqual(0);
    expect(conditions.unscored.gatedCount).toBeGreaterThanOrEqual(0);
    expect(conditions.unscored.reasons).toBeDefined();
  });

  it("marks pageType source as declared when explicitly supplied in options", async () => {
    const report = await runScan("https://example.com", {
      pageType: "product",
    });

    expect(report.conditions).toBeDefined();
    expect(report.conditions?.pageType.type).toBe("product");
    expect(report.conditions?.pageType.source).toBe("declared");
  });

  it("marks pageType source as declared when supplied via explicit pages array", async () => {
    const report = await runScan("https://example.com", {
      pages: [
        {
          url: "https://example.com",
          pageType: "category",
        },
      ],
    });

    expect(report.conditions).toBeDefined();
    expect(report.conditions?.pageType.type).toBe("category");
    expect(report.conditions?.pageType.source).toBe("declared");
  });

  it("marks pageType source as detected when not explicitly supplied", async () => {
    const report = await runScan("https://example.com");

    expect(report.conditions).toBeDefined();
    expect(report.conditions?.pageType.source).toBe("detected");
  });

  it("calculates registryMass accurately when filtering by specific categories", async () => {
    const targetCategories = ["access-crawl-control", "machine-discovery"];
    const report = await runScan("https://example.com", {
      categories: targetCategories,
    });

    expect(report.conditions).toBeDefined();
    const cond = report.conditions!;

    // Sum of scored weights for only the filtered categories
    const expectedMass = Number(
      targetCategories
        .flatMap((cat) => (defaultConfig.audits as Record<string, any[]>)[cat] ?? [])
        .filter((a) => a.meta.tier === "scored")
        .reduce((sum, a) => sum + a.meta.weight, 0)
        .toFixed(1),
    );

    expect(cond.coverage.registryMass).toBe(expectedMass);
    expect(
      Number((cond.coverage.pageMass + cond.coverage.originMass).toFixed(1)),
    ).toBe(expectedMass);
  });

  it("tracks informative and experimental audits within unscored metrics", async () => {
    const reportWithExperimental = await runScan("https://example.com", {
      includeExperimental: true,
      categories: ["agent-interfaces"],
    });

    expect(reportWithExperimental.conditions).toBeDefined();
    const cond = reportWithExperimental.conditions!;

    expect(cond.unscored.informativeCount).toBeGreaterThanOrEqual(0);
    expect(cond.unscored.totalCount).toBeGreaterThanOrEqual(
      cond.unscored.informativeCount,
    );
    expect(cond.unscored.reasons["informative"]).toBe(
      cond.unscored.informativeCount,
    );
  });

  it("retains valid conditions structure when a scan is unscored or gated", async () => {
    // example.com provides no llms.txt, no sitemaps, minimal HTML text
    // forcing heavy evidence gating
    const report = await runScan("https://example.com");

    expect(report.conditions).toBeDefined();
    const parsed = ScanConditionsSchema.safeParse(report.conditions);
    expect(parsed.success).toBe(true);

    // Verify gated mass and count tracking
    if (report.overallScore === null) {
      expect(report.conditions!.coverage.gatedMass).toBeGreaterThan(0);
      expect(report.conditions!.unscored.gatedCount).toBeGreaterThan(0);
      expect(
        report.conditions!.unscored.reasons["skipped-no-evidence"],
      ).toBeGreaterThan(0);
    }
  });

  it("prioritizes explicit options.pageType over options.pages when both are provided", async () => {
    const report = await runScan("https://example.com", {
      pageType: "product",
      pages: [
        {
          url: "https://example.com",
          pageType: "category",
        },
      ],
    });

    expect(report.conditions).toBeDefined();
    expect(report.conditions?.pageType.type).toBe("product");
    expect(report.conditions?.pageType.source).toBe("declared");
  });

  it("matches declared page overrides regardless of trailing slash differences", async () => {
    // Target has no trailing slash, override has trailing slash
    const report = await runScan("https://example.com", {
      pages: [
        {
          url: "https://example.com/",
          pageType: "content",
        },
      ],
    });

    expect(report.conditions).toBeDefined();
    expect(report.conditions?.pageType.type).toBe("content");
    expect(report.conditions?.pageType.source).toBe("declared");
  });

  it("proves that unscored.totalCount exactly equals the sum of reasons values", async () => {
    const report = await runScan("https://example.com");

    expect(report.conditions).toBeDefined();
    const { unscored } = report.conditions!;

    const reasonsSum = Object.values(unscored.reasons).reduce(
      (sum, count) => sum + count,
      0,
    );
    expect(unscored.totalCount).toBe(reasonsSum);
  });
});
