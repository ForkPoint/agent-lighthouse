import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defaultConfig } from "#core/audit-config";

const root = resolve(__dirname, "../..");
const index = JSON.parse(
  readFileSync(resolve(root, "docs/evidence/audit-map.json"), "utf8"),
);

describe("central audit index", () => {
  it("covers each registration exactly once", () => {
    const expected = Object.values(defaultConfig.audits)
      .flat()
      .map((r) => r.meta.id)
      .sort();
    expect(index.audits.map((a: { id: string }) => a.id).sort()).toEqual(
      expected,
    );
    expect(new Set(index.audits.map((a: { id: string }) => a.id)).size).toBe(
      expected.length,
    );
  });

  it("explains current rules and carries no historical review notes", () => {
    expect(index.version).toBe(6);
    expect(index.readingGuide.purpose).toContain("declared intent");
    expect(index.readingGuide.review).toBeUndefined();
    expect(index.reviewContext).toBeUndefined();
    expect(index.audits.some((a: object) => "review" in a)).toBe(false);
  });

  it("records article scope, purpose, features, and proof pointers", () => {
    const entry = index.audits.find(
      (a: { id: string }) => a.id === "structured-data/article-schema",
    );
    expect(entry.purpose).toContain("Article schema");
    expect(entry.features).toContain("article");
    expect(entry.applicability).toEqual({
      pageTypeGate: "restricted",
      pageTypes: ["article"],
    });
    expect(entry.source).toBe(
      "packages/core/src/audits/structured-data/article-schema.ts",
    );
    expect(entry.test).toBe(
      "packages/core/src/audits/structured-data/article-schema.test.ts",
    );
  });

  it("keeps common metadata scope distinct from artifact guards", () => {
    const entry = index.audits.find(
      (a: { id: string }) => a.id === "agent-interfaces/openapi-servers",
    );
    expect(entry.applicability).toEqual({
      pageTypeGate: "unrestricted",
      pageTypes: [],
    });
    expect(index.readingGuide.applicability).toContain("body guards");
  });

  it("marks experimental audits as excluded by default", () => {
    const entry = index.audits.find(
      (a: { id: string }) =>
        a.id === "access-crawl-control/ai-content-declaration",
    );
    expect(entry.enabledByDefault).toBe(false);
    expect(entry.weight).toBe(0);
  });
});

import { auditIndexFields } from "./audit-index";
import { ArticleSchemaAudit } from "#core/audits/structured-data/article-schema";
import { AuditTier, PageType } from "#core/types";
import { omit } from "#core/tests/omit";

describe("audit index generation boundaries", () => {
  it("does not infer feature tags", () => {
    const entry = auditIndexFields(omit(ArticleSchemaAudit.meta, "guidance"));
    expect(entry.features).toEqual([]);
  });

  it("uses the runner's alias rules and rejects conflicting metadata", () => {
    const meta = {
      ...ArticleSchemaAudit.meta,
      pageTypes: [PageType.Article] as const,
    };
    const entry = auditIndexFields({
      ...omit(meta, "applicablePageTypes"),
      pageTypes: [...meta.pageTypes],
    });
    expect(entry.applicability).toEqual({
      pageTypeGate: "restricted",
      pageTypes: ["article"],
    });
    expect(() =>
      auditIndexFields({ ...ArticleSchemaAudit.meta, pageTypes: [] }),
    ).toThrow("Conflicting page types");
  });

  it("never substitutes scored grade A for absent evidence metadata", () => {
    expect(() =>
      auditIndexFields(omit(ArticleSchemaAudit.meta, "evidenceGrade")),
    ).toThrow("Incomplete audit metadata");
  });

  it("keeps current runtime fields in sync across the complete registry", () => {
    for (const { meta } of Object.values(defaultConfig.audits).flat()) {
      const entry = index.audits.find((a: { id: string }) => a.id === meta.id);
      expect(entry.purpose, meta.id).toBe(meta.description);
      expect(entry.enabledByDefault, meta.id).toBe(
        meta.tier !== AuditTier.Experimental,
      );
      expect(entry.applicability.pageTypes, meta.id).toEqual(
        [...(meta.applicablePageTypes ?? meta.pageTypes ?? [])].sort(),
      );
      expect(entry.requires, meta.id).toEqual(meta.requires ?? []);
      expect(entry.tier, meta.id).toBe(meta.tier);
      expect(entry.evidenceGrade, meta.id).toBe(meta.evidenceGrade);
      expect(entry.weight, meta.id).toBe(meta.weight);
    }
  });
});
