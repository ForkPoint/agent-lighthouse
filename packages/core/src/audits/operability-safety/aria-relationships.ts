/**
 * 7.13 Complete ARIA relationships (`operability-safety/aria-relationships`).
 *
 * Wraps the a11y rule engine (see ./engine); aggregation semantics live in
 * ./_shared.ts.
 */
import { base, defineA11yAudit, graded } from "./_shared";
import { CheckPriority, EvidenceGrade, FixEffort } from "../../types";

export const AriaRelationshipsAudit = defineA11yAudit({
  rules: [
    "aria-required-attr",
    "aria-required-children",
    "aria-required-parent",
  ],
  meta: {
    ...base,
    ...graded(EvidenceGrade.A, "aria-relationships"),
    id: "operability-safety/aria-relationships",
    title: "Complete ARIA relationships",
    failureTitle: "Incomplete ARIA role relationships",
    description:
      "Composite widgets (menus, listboxes, tabs, grids) require specific child/parent roles and attributes. Missing pieces break the structure agents traverse.",
    defaultPriority: CheckPriority.Medium,
    guidance: {
      impact:
        'An incomplete widget (e.g. a role="listbox" without role="option" children) is unparseable as a coherent control, so agents cannot operate it reliably.',
      fix: "Provide all required attributes and the required child/parent roles for each ARIA widget.",
      code: '<ul role="listbox"><li role="option">A</li><li role="option">B</li></ul>',
      effort: FixEffort.Moderate,
      tags: ["aria", "relationships", "agent"],
    },
  },
});
