/**
 * 7.18 Page has a title (`operability-safety/document-title`).
 *
 * Wraps the a11y rule engine (see ./engine); aggregation semantics live in
 * ./_shared.ts.
 */
import { base, defineA11yAudit, graded } from "./_shared";
import { CheckPriority, EvidenceGrade, FixEffort } from "#core/types";

export const DocumentTitleAudit = defineA11yAudit({
  rules: ["document-title"],
  meta: {
    ...base,
    ...graded(EvidenceGrade.A, "document-title"),
    id: "operability-safety/document-title",
    title: "Page has a non-empty <title>",
    failureTitle: "Missing or empty <title>",
    description:
      "The document title is the page’s identity in the accessibility tree and in agent context windows. A missing/empty title leaves the page unnamed.",
    defaultPriority: CheckPriority.High,
    guidance: {
      impact:
        "Agents use <title> to identify and reference a page; without it, the page is hard to cite or disambiguate.",
      fix: "Provide a descriptive, unique <title> for every page.",
      code: "<title>Men’s Wool Runners — Allbirds</title>",
      effort: FixEffort.Trivial,
      tags: ["title", "identity", "agent"],
    },
  },
});
