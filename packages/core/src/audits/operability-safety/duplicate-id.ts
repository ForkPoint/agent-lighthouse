/**
 * 7.14 Unique IDs for references (`operability-safety/duplicate-id`).
 *
 * Wraps the a11y rule engine (see ./engine); aggregation semantics live in
 * ./_shared.ts.
 */
import { base, defineA11yAudit, graded } from "./_shared";

export const DuplicateIdAudit = defineA11yAudit({
  rules: ["duplicate-id-aria"],
  meta: {
    ...base,
    ...graded("A", "duplicate-id"),
    id: "operability-safety/duplicate-id",
    title: "Unique IDs for ARIA references",
    failureTitle: "Duplicate IDs break ARIA references",
    description:
      "aria-labelledby / aria-describedby / for resolve by id. Duplicate ids make resolution ambiguous, so an agent may read the wrong label or description.",
    defaultPriority: "medium",
    guidance: {
      impact:
        "Duplicate ids referenced by ARIA cause agents to associate the wrong text with a control, mislabeling actions.",
      fix: "Ensure every id referenced by ARIA/label is unique within the page.",
      code: '<label id="lbl-email">Email</label><input aria-labelledby="lbl-email">',
      effort: "easy",
      tags: ["aria", "ids", "agent"],
    },
  },
});
