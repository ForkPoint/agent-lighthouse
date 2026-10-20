import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultConfig } from "./audit-config";
import { AuditTier, EvidenceGrade, EvidenceKey } from "./contracts";
import { SNAPSHOT_AUDITS } from "./snapshot-eligibility";

const repoRoot = join(__dirname, "..", "..", "..");
const registered = new Map(
  Object.values(defaultConfig.audits)
    .flat()
    .map((reg) => [reg.meta.id, reg.meta]),
);
const source = (id: string) =>
  readFileSync(join(__dirname, "audits", `${id}.ts`), "utf8");

// The browser view may only claim a DOM fact for an audit whose proven consumer
// reads a rendered page. These tests pin the four-part review of the design note
// (docs/superpowers/specs/2026-10-20-browser-view-audits-design.md).
/**
 * Entries reviewed before the four-part rule, each in its own dossier. The grade C
 * profile check is a static field-token fact with the same limits as its grade B
 * sibling, and its finding was already informative.
 */
const REVIEWED_BEFORE_RULE = new Set([
  "operability-safety/profile-autofill-token-coverage",
]);

describe("browser view eligibility", () => {
  const ids = Object.keys(SNAPSHOT_AUDITS);

  it("names only registered scored audits of grade A or B", () => {
    for (const id of ids) {
      const meta = registered.get(id);
      expect(meta, id).toBeDefined();
      if (REVIEWED_BEFORE_RULE.has(id)) continue;
      expect(meta!.tier, id).toBe(AuditTier.Scored);
      expect([EvidenceGrade.A, EvidenceGrade.B], id).toContain(
        meta!.evidenceGrade,
      );
    }
  });

  it("names no audit that reads HTTP response, root-file or network evidence", () => {
    for (const id of ids)
      expect(source(id), id).not.toMatch(
        /fetchResult|rootFiles|ctx\.fetch\b|robots|redirect|\.headers\b/,
      );
  });

  it("needs readable DOM text and never an HTTP evidence key", () => {
    for (const [id, entry] of Object.entries(SNAPSHOT_AUDITS)) {
      expect(entry.requires, id).toContain(EvidenceKey.RenderedBody);
      expect(entry.requires, id).not.toContain(EvidenceKey.OriginReachable);
      expect(entry.requires, id).not.toContain(EvidenceKey.UnblockedFetches);
    }
  });

  it("flags exactly the audits that read a11y rule results", () => {
    for (const [id, entry] of Object.entries(SNAPSHOT_AUDITS))
      expect(Boolean(entry.a11yRules), id).toBe(
        source(id).includes("defineA11yAudit"),
      );
  });

  it("keeps the published inventory and each dossier in step", () => {
    const doc = readFileSync(
      join(repoRoot, "docs", "architecture", "browser-snapshots.md"),
      "utf8",
    );
    const inventory = doc
      .split("## Supported audit inventory")[1]!
      .split("\n## ")[0]!;
    const listed = [...inventory.matchAll(/^\| `([a-z-]+\/[a-z0-9-]+)`/gm)].map(
      (m) => m[1],
    );
    expect(listed).toHaveLength(ids.length);
    expect(new Set(listed)).toEqual(new Set(ids));
    for (const id of ids) {
      const dossier = readFileSync(
        join(repoRoot, "docs", "evidence", "audits", `${id}.md`),
        "utf8",
      );
      expect(dossier, id).toContain("snapshot-eligibility.ts");
    }
  });
});
