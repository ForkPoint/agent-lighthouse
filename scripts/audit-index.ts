/** Fields for the central audit index. Runtime facts and historical review stay separate. */
import type { AuditMeta } from "../packages/core/src/types";
import { auditPageTypes } from "../packages/core/src/audit-applicability";

export const REVIEW_PATH = "docs/architecture/v7-audit-applicability-ledger.md";

export interface AuditReview {
  reference: string;
  baselinePopulationAndRead: string;
  baselineAggregationAndAbsence: string | null;
  proposedWork: string;
  acceptanceCriteria: string | null;
}

/** Parse the ledger's labelled bullets; preserve inline code and normalize wrapping. */
export function parseAuditReviews(markdown: string): Map<string, AuditReview> {
  const reviews = new Map<string, AuditReview>();
  for (const section of markdown.split(/^### /m).slice(1)) {
    const newline = section.indexOf("\n");
    const id = section.slice(0, newline).trim();
    if (!/^[a-z0-9-]+\/[a-z0-9._-]+$/.test(id)) {
      throw new Error(`Invalid audit review heading: ${id}`);
    }
    if (reviews.has(id)) throw new Error(`Duplicate audit review: ${id}`);
    const body = section.slice(newline + 1).split(/^#{1,2} /m)[0];
    const fields = new Map<string, string>();
    const bullets = [...body.matchAll(/^- \*\*([^*]+):\*\*\s*/gm)];
    for (let i = 0; i < bullets.length; i++) {
      const match = bullets[i];
      const key = match[1];
      if (fields.has(key))
        throw new Error(`Duplicate review field ${key}: ${id}`);
      fields.set(
        key,
        body
          .slice(
            match.index! + match[0].length,
            bullets[i + 1]?.index ?? body.length,
          )
          .replace(/\s+/g, " ")
          .trim(),
      );
    }
    const population =
      fields.get("Population / read") ?? fields.get("Scope / read");
    const proposal =
      fields.get("Disposition") ?? fields.get("Disposition / tests");
    if (!population || !proposal)
      throw new Error(`Incomplete audit review: ${id}`);
    reviews.set(id, {
      reference: `${REVIEW_PATH}#${id.replace("/", "")}`,
      baselinePopulationAndRead: population,
      baselineAggregationAndAbsence:
        fields.get("Current aggregation / absence") ??
        fields.get("Current aggregation / absence after this slice") ??
        fields.get("Aggregation") ??
        null,
      proposedWork: proposal,
      // Four original rows combine disposition and tests; do not invent a split.
      acceptanceCriteria: fields.get("Tests") ?? null,
    });
  }
  if (reviews.size === 0)
    throw new Error("The audit review ledger has no audit entries.");
  return reviews;
}

export function auditIndexFields(
  meta: AuditMeta,
  review: AuditReview | undefined,
) {
  if (!meta.description.trim() || !meta.tier || !meta.evidenceGrade) {
    throw new Error(`Incomplete audit metadata: ${meta.id}`);
  }
  const pageTypes = auditPageTypes(meta) ?? [];
  return {
    purpose: meta.description,
    features: [...new Set(meta.guidance?.tags ?? [])].sort(),
    priority: meta.defaultPriority,
    enabledByDefault: meta.tier !== "experimental",
    applicability: {
      pageTypeGate: pageTypes.length
        ? ("restricted" as const)
        : ("unrestricted" as const),
      pageTypes,
    },
    source: `packages/core/src/audits/${meta.id}.ts`,
    test: `packages/core/src/audits/${meta.id}.test.ts`,
    review: review ?? null,
  };
}
