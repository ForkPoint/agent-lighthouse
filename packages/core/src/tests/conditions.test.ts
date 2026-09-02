import { describe, it, expect } from "vitest";
import { runScan } from "../orchestrator";
import { ScanConditionsSchema } from "../schemas";

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
    expect(conditions.coverage.assessedMass).toBeGreaterThan(0);
    expect(conditions.coverage.pageMass).toBeGreaterThan(0);
    expect(conditions.coverage.originMass).toBeGreaterThan(0);
    expect(
      Number(
        (conditions.coverage.pageMass + conditions.coverage.originMass).toFixed(
          1,
        ),
      ),
    ).toBe(conditions.coverage.registryMass);

    // Unscored breakdown
    expect(conditions.unscored.totalCount).toBeGreaterThanOrEqual(0);
    expect(conditions.unscored.informativeCount).toBeGreaterThanOrEqual(0);
    expect(conditions.unscored.gatedCount).toBeGreaterThanOrEqual(0);
    expect(conditions.unscored.reasons).toBeDefined();
  });

  it("marks pageType source as declared when explicitly supplied", async () => {
    const report = await runScan("https://example.com", {
      pageType: "product",
    });

    expect(report.conditions).toBeDefined();
    expect(report.conditions?.pageType.type).toBe("product");
    expect(report.conditions?.pageType.source).toBe("declared");
  });

  it("marks pageType source as detected when not explicitly supplied", async () => {
    const report = await runScan("https://example.com");

    expect(report.conditions).toBeDefined();
    expect(report.conditions?.pageType.source).toBe("detected");
  });
});
