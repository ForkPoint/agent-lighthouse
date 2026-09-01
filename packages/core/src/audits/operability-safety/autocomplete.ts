/**
 * 7.15 Form fields declare autocomplete (`operability-safety/autocomplete`).
 *
 * Wraps the a11y rule engine (see ./engine); aggregation semantics live in
 * ./_shared.ts.
 */
import { base, defineA11yAudit, graded } from "./_shared";

export const AutocompleteAudit = defineA11yAudit({
  rules: ["autocomplete-valid"],
  meta: {
    ...base,
    ...graded("A", "autocomplete"),
    id: "operability-safety/autocomplete",
    title: "Form fields use valid autocomplete tokens",
    failureTitle: "Invalid autocomplete tokens on form fields",
    description:
      "Form-filling agents map fields to known data (name, email, address, payment) via autocomplete tokens. Invalid tokens break that mapping.",
    defaultPriority: "high",
    guidance: {
      impact:
        "Without valid autocomplete, an agent must guess each field’s meaning, so automated checkout/sign-up flows fail or misfill.",
      fix: "Use valid HTML autocomplete tokens on inputs (e.g. email, given-name, postal-code, cc-number).",
      code: '<input name="email" autocomplete="email">',
      effort: "easy",
      tags: ["forms", "autocomplete", "agent"],
    },
  },
});
