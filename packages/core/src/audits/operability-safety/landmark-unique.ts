/**
 * 7.4 Landmarks are uniquely identifiable (`operability-safety/landmark-unique`).
 *
 * Wraps the a11y rule engine (see ./engine); aggregation semantics live in
 * ./_shared.ts.
 *
 * Replaces the former hand-rolled MultipleNavAudit. The `landmark-unique` rule
 * covers all landmark types (not just <nav>) by role + accessible-name.
 *
 * Absorbs 7.3 (nav-aria-label) in Plan 4: that audit demanded a label on every
 * <nav>, which is stricter than the mechanism — a label disambiguates landmarks
 * of the same role, so a lone <nav> needs none. The rule measures exactly that,
 * across every landmark type, and resolves aria-labelledby.
 */
import { base, defineA11yAudit, graded } from "./_shared";

export const LandmarkUniqueAudit = defineA11yAudit({
  rules: ["landmark-unique"],
  meta: {
    ...base,
    ...graded("A", "landmark-unique"),
    id: "operability-safety/landmark-unique",
    title: "Landmarks are uniquely identifiable",
    failureTitle: "Duplicate landmarks without distinguishing labels",
    description:
      "AI browser agents traverse the accessibility tree and use a landmark’s role plus accessible name to target the right region. Two landmarks of the same role (e.g. a primary <nav> and a footer <nav>) without unique labels are indistinguishable, causing agents to act on the wrong region. A single unlabeled landmark is unambiguous and is not flagged.",
    defaultPriority: "medium",
    guidance: {
      impact:
        "Without unique role/label combinations, agents cannot tell primary navigation from footer or breadcrumb navigation, leading to navigation failures. The same applies to duplicate main, banner, contentinfo and complementary landmarks.",
      fix: 'Give each landmark that shares a role with another a unique aria-label or aria-labelledby (e.g. "Primary navigation", "Footer navigation"). A landmark with no same-role sibling needs no label.',
      code: '<nav aria-label="Primary navigation">...</nav>\n<nav aria-label="Footer navigation">...</nav>',
      effort: "trivial",
      tags: ["aria", "landmarks", "navigation", "agent", "accessibility"],
    },
  },
});
