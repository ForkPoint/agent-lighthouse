/**
 * 7.21 Logical focus order (`operability-safety/tabindex`).
 *
 * Wraps the a11y rule engine (see ./engine); aggregation semantics live in
 * ./_shared.ts.
 */
import { base, defineA11yAudit, graded } from "./_shared";

export const TabindexAudit = defineA11yAudit({
  rules: ["tabindex"],
  meta: {
    ...base,
    ...graded("C", "tabindex"),
    id: "operability-safety/tabindex",
    title: "No positive tabindex (logical focus order)",
    failureTitle: "Positive tabindex disrupts focus order",
    description:
      "Positive tabindex values force a non-DOM focus order. Agents that traverse the page by focus order then encounter a confusing, non-linear sequence.",
    defaultPriority: "low",
    guidance: {
      impact:
        "A scrambled focus order makes sequential agent navigation jump around unpredictably, raising the chance of missed or wrong interactions.",
      fix: 'Avoid tabindex > 0; rely on DOM order and use tabindex="0"/"-1" only.',
      code: '<!-- BAD --> <input tabindex="5">  <!-- GOOD --> <input>',
      effort: "moderate",
      tags: ["focus-order", "agent"],
    },
  },
});
