/**
 * 7.5 Form inputs have associated labels (`operability-safety/label`).
 *
 * Wraps the a11y rule engine (see ./engine); aggregation semantics live in
 * ./_shared.ts.
 *
 * Replaces the former hand-rolled FormLabelsAudit.
 */
import { base, defineA11yAudit, graded } from './_shared';

export const LabelAudit = defineA11yAudit({
  rules: ['label', 'select-name'],
  meta: {
    ...base,
    ...graded('A', 'label'),
    id: 'operability-safety/label',
    title: 'Form inputs have associated labels',
    failureTitle: 'Form inputs lack associated labels',
    description:
      'AI agents filling forms identify fields by their accessible name (label, aria-label, or aria-labelledby). Unlabeled inputs are invisible to form-filling agents, so automated workflows like "sign me up" or "submit a contact request" fail.',
    defaultPriority: 'high',
    guidance: {
      impact:
        'Unlabeled inputs have no programmatic name, so form-filling agents cannot map fields to data and abandon or misfill the form.',
      fix: 'Associate every input/select/textarea with a <label for="id">, or add aria-label/aria-labelledby. Hidden and button-type inputs are exempt.',
      code: '<label for="email">Email</label>\n<input id="email" type="email" name="email">',
      effort: 'easy',
      tags: ['forms', 'aria', 'agent'],
    },
  },
});
