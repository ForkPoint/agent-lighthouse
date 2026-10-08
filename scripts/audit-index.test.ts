import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defaultConfig } from "../packages/core/src/audit-config";

const root = resolve(__dirname, "..");
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

  it("explains current rules and distinguishes review proposals", () => {
    expect(index.version).toBe(5);
    expect(index.readingGuide.purpose).toContain("declared intent");
    expect(index.readingGuide.review).toContain("not execution proof");
    expect(index.reviewContext.source).toBe(
      "docs/architecture/v7-audit-applicability-ledger.md",
    );
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
    expect(entry.review.baselinePopulationAndRead).toContain("content");
    expect(entry.review.proposedWork).toBeTruthy();
    expect(entry.review.reference).toContain("#structured-dataarticle-schema");
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
    expect(entry.review).not.toBeNull();
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

import { auditIndexFields, parseAuditReviews } from "./audit-index";
import { ArticleSchemaAudit } from "../packages/core/src/audits/structured-data/article-schema";
import { AuditTier, PageType } from "../packages/core/src/types";

const reviewText = `# Review\n\n### example/check\n\n- **Scope / read:** Reads a\n  visible feature.\n- **Current aggregation / absence:** Absent is NA.\n- **Disposition:** Keep the feature guard.\n- **Tests:** Check missing input.\n`;

describe("audit index generation boundaries", () => {
  it("preserves wrapped review text and stops at a new section", () => {
    const reviews = parseAuditReviews(
      `${reviewText}\n## Other section\nNot part of the review.`,
    );
    expect(reviews.get("example/check")).toEqual({
      reference:
        "docs/architecture/v7-audit-applicability-ledger.md#examplecheck",
      baselinePopulationAndRead: "Reads a visible feature.",
      baselineAggregationAndAbsence: "Absent is NA.",
      proposedWork: "Keep the feature guard.",
      acceptanceCriteria: "Check missing input.",
    });
  });

  it("rejects duplicate audit headings instead of silently overwriting a review", () => {
    expect(() => parseAuditReviews(reviewText + reviewText)).toThrow(
      "Duplicate audit review: example/check",
    );
  });

  it("rejects incomplete and empty review ledgers", () => {
    expect(() => parseAuditReviews("# Review")).toThrow("no audit entries");
    expect(() =>
      parseAuditReviews("### example/check\n- **Tests:** Only a test."),
    ).toThrow("Incomplete audit review");
  });

  it("preserves combined disposition/tests without inventing absent fields", () => {
    const review = parseAuditReviews(
      "### example/check\n- **Population / read:** An optional artifact.\n- **Disposition / tests:** Keep NA; test absent input.",
    ).get("example/check");
    expect(review?.proposedWork).toBe("Keep NA; test absent input.");
    expect(review?.acceptanceCriteria).toBeNull();
    expect(review?.baselineAggregationAndAbsence).toBeNull();
  });

  it("keeps unreviewed audits explicit and does not infer feature tags", () => {
    const entry = auditIndexFields(
      { ...ArticleSchemaAudit.meta, guidance: undefined },
      undefined,
    );
    expect(entry.features).toEqual([]);
    expect(entry.review).toBeNull();
  });

  it("uses the runner's alias rules and rejects conflicting metadata", () => {
    const meta = {
      ...ArticleSchemaAudit.meta,
      pageTypes: [PageType.Article] as const,
    };
    const entry = auditIndexFields(
      {
        ...meta,
        pageTypes: [...meta.pageTypes],
        applicablePageTypes: undefined,
      },
      undefined,
    );
    expect(entry.applicability).toEqual({
      pageTypeGate: "restricted",
      pageTypes: ["article"],
    });
    expect(() =>
      auditIndexFields(
        { ...ArticleSchemaAudit.meta, pageTypes: [] },
        undefined,
      ),
    ).toThrow("Conflicting page types");
  });

  it("never substitutes scored grade A for absent evidence metadata", () => {
    expect(() =>
      auditIndexFields(
        { ...ArticleSchemaAudit.meta, evidenceGrade: undefined },
        undefined,
      ),
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
    expect(index.summary.auditsWithReview).toBe(
      index.audits.filter((a: { review: unknown }) => a.review !== null).length,
    );
    expect(index.summary.auditsWithoutReview).toEqual(
      index.audits
        .filter((a: { review: unknown }) => a.review === null)
        .map((a: { id: string }) => a.id),
    );
  });
});
