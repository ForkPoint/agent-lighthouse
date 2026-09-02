/**
 * 7.12 Valid ARIA attributes (`operability-safety/aria-attributes`).
 *
 * Wraps the a11y rule engine (see ./engine); aggregation semantics live in
 * ./_shared.ts.
 */
import { base, defineA11yAudit, graded } from "./_shared";

export const AriaAttributesAudit = defineA11yAudit({
  rules: [
    "aria-valid-attr",
    "aria-valid-attr-value",
    "aria-allowed-attr",
    "aria-prohibited-attr",
  ],
  meta: {
    ...base,
    ...graded("A", "aria-attributes"),
    id: "operability-safety/aria-attributes",
    title: "Valid ARIA attributes",
    failureTitle: "Invalid ARIA attributes or values",
    description:
      "ARIA states and properties carry the machine-readable state agents act on (expanded, checked, disabled, labels). Invalid attributes or values corrupt that state.",
    defaultPriority: "high",
    guidance: {
      impact:
        'Misspelled attributes or bad values (e.g. aria-expanded="yes") leave agents with wrong or missing state, leading to incorrect interactions.',
      fix: "Use only valid aria-* attributes with valid values, allowed on the element’s role.",
      code: '<button aria-expanded="false" aria-controls="menu">Menu</button>',
      effort: "easy",
      tags: ["aria", "attributes", "agent"],
    },
  },
});
