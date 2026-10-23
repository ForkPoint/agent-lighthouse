import { describe, expect, it } from "vitest";
import type { RegistrySummary } from "#core/registry-summary";
import { AuditTier, Category } from "#core/types";
import {
  SCORING_TABLE_END,
  SCORING_TABLE_START,
  registryManifest,
  scoringSummary,
  withRegistryValues,
  withScoringSummary,
} from "./registry-docs";

const summary: RegistrySummary = {
  version: "1.2.3",
  audits: 5,
  categories: 2,
  tiers: {
    [AuditTier.Scored]: 3,
    [AuditTier.Informative]: 1,
    [AuditTier.Experimental]: 0,
    [AuditTier.Obsolete]: 1,
  },
  registryMass: 2.6,
  byCategory: [
    {
      id: Category.StructuredData,
      name: "Structured Data",
      audits: 2,
      scored: 1,
      registryMass: 1,
    },
    {
      id: Category.AgenticCommerce,
      name: "Agentic Commerce",
      audits: 3,
      scored: 2,
      registryMass: 1.6,
    },
  ],
};

describe("withRegistryValues", () => {
  it("rewrites only the text between each pair of markers", () => {
    const doc =
      "Runs <!-- registry:audits -->7<!-- /registry:audits --> checks in " +
      "<!-- registry:categories -->1<!-- /registry:categories --> categories; 207 legacy audits.";
    expect(withRegistryValues(doc, summary)).toBe(
      "Runs <!-- registry:audits -->5<!-- /registry:audits --> checks in " +
        "<!-- registry:categories -->2<!-- /registry:categories --> categories; 207 legacy audits.",
    );
  });

  it("fills tier counts and the registry mass", () => {
    expect(
      withRegistryValues(
        "<!-- registry:scored --><!-- /registry:scored --> / <!-- registry:registry-mass -->0<!-- /registry:registry-mass -->",
        summary,
      ),
    ).toBe(
      "<!-- registry:scored -->3<!-- /registry:scored --> / <!-- registry:registry-mass -->2.6<!-- /registry:registry-mass -->",
    );
  });

  it("refuses an unknown key or a mismatched closing marker", () => {
    expect(() =>
      withRegistryValues(
        "<!-- registry:audit -->1<!-- /registry:audit -->",
        summary,
      ),
    ).toThrow('Unknown registry key "audit"');
    expect(() =>
      withRegistryValues(
        "<!-- registry:audits -->1<!-- /registry:scored -->",
        summary,
      ),
    ).toThrow("closed by /registry:scored");
  });
});

describe("scoringSummary", () => {
  it("states the tier counts and lists categories heaviest first", () => {
    const block = scoringSummary(summary);
    expect(block).toContain(
      "The current registry has 5 audits: 3 scored, 1 informative, 0 experimental, 1 obsolete, with a total registry mass of 2.6:",
    );
    const rows = block.split("\n").filter((line) => line.startsWith("| "));
    expect(rows[2]).toMatch(/^\| Agentic Commerce +\| +3 \| +2 \| +1\.6 \|$/);
    expect(rows[3]).toMatch(/^\| Structured Data +\| +2 \| +1 \| +1\.0 \|$/);
    // Every row has the same width, as Prettier pads a table.
    expect(new Set(rows.map((row) => row.length)).size).toBe(1);
  });
});

describe("withScoringSummary", () => {
  it("replaces only the text between the markers", () => {
    const doc = `before\n\n${SCORING_TABLE_START}\nold\n${SCORING_TABLE_END}\n\nafter\n`;
    expect(withScoringSummary(doc, "new")).toBe(
      `before\n\n${SCORING_TABLE_START}\n\nnew\n\n${SCORING_TABLE_END}\n\nafter\n`,
    );
  });

  it("refuses a document without the markers", () => {
    expect(() => withScoringSummary("no markers", "new")).toThrow(
      SCORING_TABLE_START,
    );
  });
});

describe("registryManifest", () => {
  it("keeps the counts and leaves out the package version", () => {
    const manifest = JSON.parse(registryManifest(summary));
    expect(manifest).not.toHaveProperty("version");
    expect(manifest).toMatchObject({ audits: 5, categories: 2 });
  });
});
