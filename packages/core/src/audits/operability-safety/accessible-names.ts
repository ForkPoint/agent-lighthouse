/**
 * 7.7 Buttons and links have accessible names (`operability-safety/accessible-names`).
 *
 * Wraps the a11y rule engine (see ./engine); aggregation semantics live in
 * ./_shared.ts.
 *
 * Replaces the former hand-rolled AccessibleNamesAudit AND IconLabelsAudit
 * (icon-only controls are just buttons/links with no visible text, already
 * covered by these rules).
 */
import { base, defineA11yAudit, graded } from './_shared';

export const AccessibleNamesAudit = defineA11yAudit({
  rules: ['button-name', 'link-name'],
  meta: {
    ...base,
    ...graded('A', 'accessible-names'),
    id: 'operability-safety/accessible-names',
    title: 'Buttons and links have accessible names',
    failureTitle: 'Buttons or links without accessible names',
    description:
      'AI browser agents identify clickable elements by their accessible name in the accessibility tree. Buttons and links (including icon-only controls) without text, aria-label, or aria-labelledby are invisible to agents, so they cannot navigate the site or trigger actions.',
    defaultPriority: 'high',
    guidance: {
      impact:
        'An unnamed button or link is an unidentifiable action target, causing failed or wrong interactions in agentic workflows.',
      fix: 'Give every <button> and <a> text content, aria-label, or aria-labelledby. For icon-only controls, use aria-label to describe the action.',
      code: '<a href="/pricing" aria-label="Go to pricing page">...</a>\n<button aria-label="Close menu">X</button>',
      effort: 'easy',
      tags: ['aria', 'interactive', 'agent'],
    },
  },
});
