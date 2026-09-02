/**
 * 7.10 Page exposed to the accessibility tree (`operability-safety/aria-hidden-body`).
 *
 * Wraps the a11y rule engine (see ./engine); aggregation semantics live in
 * ./_shared.ts.
 */
import { base, defineA11yAudit, graded } from "./_shared";

export const AriaHiddenBodyAudit = defineA11yAudit({
  rules: ["aria-hidden-body"],
  meta: {
    ...base,
    ...graded("A", "aria-hidden-body"),
    id: "operability-safety/aria-hidden-body",
    title: "Page exposed to the accessibility tree",
    failureTitle: "Page hidden from the accessibility tree",
    description:
      'aria-hidden="true" on the document body removes the entire page from the accessibility tree. AI browser agents that navigate via the accessibility tree would see nothing at all.',
    defaultPriority: "critical",
    guidance: {
      impact:
        "If the root is aria-hidden, agents relying on the accessibility tree perceive an empty page and cannot read or act on any content.",
      fix: 'Never put aria-hidden="true" on <body> or the root element. Hide only specific decorative subtrees.',
      code: '<!-- BAD --> <body aria-hidden="true">\n<!-- GOOD --> <body> ... </body>',
      effort: "trivial",
      tags: ["aria", "accessibility-tree", "agent"],
    },
  },
});
