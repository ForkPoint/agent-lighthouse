import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultConfig } from "#core/audit-config";
import { AuditTier } from "#core/types";
import { CORE_VERSION, getRegistrySummary } from "./registry-summary";

describe("getRegistrySummary", () => {
  const summary = getRegistrySummary();
  const metas = Object.values(defaultConfig.audits)
    .flat()
    .map((registration) => registration.meta);

  it("counts every registered audit once, by tier and by category", () => {
    expect(summary.audits).toBe(metas.length);
    expect(
      Object.values(summary.tiers).reduce((sum, count) => sum + count, 0),
    ).toBe(metas.length);
    expect(
      summary.byCategory.reduce((sum, category) => sum + category.audits, 0),
    ).toBe(metas.length);
    expect(summary.categories).toBe(defaultConfig.categories.length);
    expect(summary.tiers[AuditTier.Scored]).toBe(
      metas.filter((meta) => meta.tier === AuditTier.Scored).length,
    );
  });

  it("sums weights to the registry mass each category reports", () => {
    for (const category of summary.byCategory) {
      const expected = defaultConfig.categories.find(
        (config) => config.id === category.id,
      )!.weight;
      expect(category.registryMass).toBeCloseTo(expected, 1);
    }
  });

  it("reports the core package version", () => {
    const pkg = JSON.parse(
      readFileSync(resolve(__dirname, "../package.json"), "utf8"),
    ) as { version: string };
    expect(CORE_VERSION).toBe(pkg.version);
    expect(summary.version).toBe(pkg.version);
  });
});
