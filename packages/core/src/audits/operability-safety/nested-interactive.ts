/**
 * 7.16 No nested interactive controls (`operability-safety/nested-interactive`).
 *
 * Wraps the a11y rule engine (see ./engine); aggregation semantics live in
 * ./_shared.ts.
 */
import { base, defineA11yAudit, graded } from './_shared';

export const NestedInteractiveAudit = defineA11yAudit({
  rules: ['nested-interactive'],
  meta: {
    ...base,
    ...graded('A', 'nested-interactive'),
    id: 'operability-safety/nested-interactive',
    title: 'No nested interactive controls',
    failureTitle: 'Nested interactive controls',
    description:
      'Interactive elements nested inside other interactive elements (e.g. a button inside a link) create ambiguous targets in the accessibility tree.',
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Nested controls give agents two overlapping action targets, so the wrong action may fire or the control becomes unoperable.',
      fix: 'Do not nest focusable/interactive elements; keep one control per actionable region.',
      code: '<!-- BAD --> <a href="/x"><button>Go</button></a>',
      effort: 'moderate',
      tags: ['interactive', 'agent'],
    },
  },
});
