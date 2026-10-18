import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defaultConfig } from "#core/audit-config";
import { AuditMetaSchema } from "#core/schemas";
import { AuditTier, EvidenceGrade, NoticeKind } from "#core/types";

/**
 * Audits whose subject is live but has no documented AI consumer
 * (docs/evidence/policy.md, "Informative or obsolete"). Each stays
 * informative, carries an `unconsumed` notice, and never warns or fails:
 * a defect is still named in the message, but nothing a site owner did here
 * costs them anything with an AI agent.
 */
const UNCONSUMED = [
  "machine-discovery/llms-txt-exists",
  "machine-discovery/llms-txt-structure",
  "machine-discovery/llms-txt-links-valid",
  "machine-discovery/llms-txt-link-descriptions",
  "machine-discovery/llms-full-txt",
  "machine-discovery/rss-feed-content",
  "machine-discovery/cors-ai-files",
  "operability-safety/trust-txt-reciprocity-coherence",
] as const;

const byId = new Map(
  Object.values(defaultConfig.audits)
    .flat()
    .map((reg) => [reg.meta.id, reg.meta] as const),
);

describe("unconsumed-notice audits", () => {
  it.each(UNCONSUMED)("%s carries an unconsumed notice", (id) => {
    const meta = byId.get(id);
    expect(meta, id).toBeDefined();
    if (!meta) return;
    expect(() => AuditMetaSchema.parse(meta)).not.toThrow();
    expect(meta.tier).toBe(AuditTier.Informative);
    expect(meta.evidenceGrade).toBe(EvidenceGrade.C);
    expect(meta.weight).toBe(0);
    expect(meta.deprecated?.kind).toBe(NoticeKind.Unconsumed);
    expect(meta.deprecated?.link).toMatch(/^https:\/\//);
    expect(meta.deprecated?.notice).toMatch(/no .*documents? reading/i);
  });

  // The source holds no warn or fail call at all, so no input can reach one.
  it.each(UNCONSUMED)("%s never warns or fails", (id) => {
    const file = resolve(__dirname, `${id}.ts`);
    const source = readFileSync(file, "utf8");
    expect(source).not.toMatch(/this\.(warn|fail)\(/);
  });
});
