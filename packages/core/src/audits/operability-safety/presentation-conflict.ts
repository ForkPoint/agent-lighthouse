/**
 * 7.23 No presentation-role conflicts (`operability-safety/presentation-conflict`).
 *
 * Wraps the a11y rule engine (see ./engine); aggregation semantics live in
 * ./_shared.ts.
 */
import { base, defineA11yAudit, graded } from "./_shared";

export const PresentationConflictAudit = defineA11yAudit({
  rules: ["presentation-role-conflict"],
  meta: {
    ...base,
    ...graded("A", "presentation-conflict"),
    id: "operability-safety/presentation-conflict",
    title: "No presentation-role conflicts",
    failureTitle: "Presentation role conflicts with focusable/labeled element",
    description:
      'An element marked role="presentation"/"none" while still focusable or carrying ARIA sends contradictory signals about whether it exists in the accessibility tree.',
    defaultPriority: "low",
    guidance: {
      impact:
        "A presentational element that is still focusable/labeled confuses agents about whether to treat it as content or ignore it.",
      fix: 'Don’t put role="presentation"/"none" on focusable or ARIA-labeled elements.',
      code: '<!-- BAD --> <a href="/x" role="presentation">Link</a>',
      effort: "easy",
      tags: ["aria", "agent"],
    },
  },
});
