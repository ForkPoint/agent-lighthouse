import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
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

  it("pins the reviewed list, so an addition or removal is a deliberate edit", () => {
    expect([...ids].sort()).toEqual(
      [
        "content-extraction/image-alt-text",
        "content-extraction/section-headings",
        "content-extraction/semantic-lists",
        "operability-safety/accessible-names",
        "operability-safety/aria-attributes",
        "operability-safety/aria-hidden-body",
        "operability-safety/aria-landmarks",
        "operability-safety/aria-relationships",
        "operability-safety/aria-roles",
        "operability-safety/dialog-name",
        "operability-safety/duplicate-id",
        "operability-safety/form-actionability",
        "operability-safety/form-autofill-token-coverage",
        "operability-safety/label",
        "operability-safety/landmark-unique",
        "operability-safety/native-control-substitution",
        "operability-safety/nested-interactive",
        "operability-safety/presentation-conflict",
        "operability-safety/profile-autofill-token-coverage",
        "structured-data/json-ld-present",
        "structured-data/schema-validation",
      ].sort(),
    );
  });

  it("names no audit that reads HTTP evidence, itself or through a local helper", () => {
    const HTTP_READ =
      /fetchResult|rootFiles|ctx\.fetch\b|robots|redirect|\.headers\b/;
    for (const id of ids) {
      const file = join(__dirname, "audits", `${id}.ts`);
      // The audit file plus every audit-local helper it imports ("./x").
      const local = [
        ...readFileSync(file, "utf8").matchAll(/from "\.\/([^"]+)"/g),
      ].map((m) => join(dirname(file), `${m[1]}.ts`));
      for (const path of [file, ...local])
        expect(readFileSync(path, "utf8"), `${id}: ${path}`).not.toMatch(
          HTTP_READ,
        );
    }
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

  it("argues each browser view from its own evidence, not a shared paragraph", () => {
    const leads = new Map<string, string>();
    for (const id of ids) {
      const dossier = readFileSync(
        join(repoRoot, "docs", "evidence", "audits", `${id}.md`),
        "utf8",
      );
      const section = dossier.split(/^## Browser view$/m)[1];
      // The two autofill audits record the snapshot run in their deviations.
      if (section === undefined) {
        expect(id, id).toMatch(/autofill-token-coverage$/);
        continue;
      }
      const lead = section.trim().split("\n\n")[0]!;
      expect(leads.get(lead), `${id} repeats another audit's lead`).toBe(
        undefined,
      );
      leads.set(lead, id);
    }
  });
});
