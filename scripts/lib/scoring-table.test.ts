import { describe, expect, it } from "vitest";
import type { AuditMeta } from "#core/types";
import { AuditTier } from "#core/types";
import {
  SCORING_TABLE_END,
  SCORING_TABLE_START,
  scoringSummary,
  withScoringSummary,
} from "./scoring-table";

function meta(category: string, tier: AuditTier, weight: number): AuditMeta {
  return { category, tier, weight } as AuditMeta;
}

describe("scoringSummary", () => {
  it("counts tiers and sums each category's mass, heaviest first", () => {
    const summary = scoringSummary([
      meta("structured-data", AuditTier.Scored, 1),
      meta("structured-data", AuditTier.Informative, 0),
      meta("agentic-commerce", AuditTier.Scored, 1),
      meta("agentic-commerce", AuditTier.Scored, 0.6),
      meta("agentic-commerce", AuditTier.Obsolete, 0),
    ]);

    expect(summary).toContain(
      "The current registry has 5 audits: 3 scored, 1 informative, 0 experimental, 1 obsolete, with a total registry mass of 2.6:",
    );
    const rows = summary.split("\n").filter((line) => line.startsWith("| "));
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
