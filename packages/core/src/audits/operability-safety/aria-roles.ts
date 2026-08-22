/**
 * 7.11 Valid ARIA roles (`operability-safety/aria-roles`).
 *
 * Wraps the a11y rule engine (see ./engine); aggregation semantics live in
 * ./_shared.ts.
 */
import { base, defineA11yAudit, graded } from './_shared';

export const AriaRolesAudit = defineA11yAudit({
  rules: ['aria-roles', 'aria-deprecated-role', 'aria-allowed-role'],
  meta: {
    ...base,
    ...graded('A', 'aria-roles'),
    id: 'operability-safety/aria-roles',
    title: 'Valid ARIA roles',
    failureTitle: 'Invalid or misused ARIA roles',
    description:
      'AI agents map elements to behaviors by their ARIA role. Invalid, deprecated, or disallowed roles make an element’s purpose ambiguous, so agents may mis-classify or skip it.',
    defaultPriority: 'high',
    guidance: {
      impact:
        'A wrong role tells an agent the element is something it is not (e.g. a div role="button" that isn’t operable), causing failed or incorrect actions.',
      fix: 'Use valid, non-deprecated ARIA roles allowed on the element. Prefer native HTML elements over role overrides.',
      code: '<button>Add to cart</button> <!-- preferred over <div role="button"> -->',
      effort: 'easy',
      tags: ['aria', 'roles', 'agent'],
    },
  },
});
