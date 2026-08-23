/**
 * 7.9 Dialogs have accessible names (`operability-safety/dialog-name`).
 *
 * Wraps the a11y rule engine (see ./engine); aggregation semantics live in
 * ./_shared.ts.
 *
 * Replaces the former hand-rolled ModalDialogAudit.
 */
import { base, defineA11yAudit, graded } from './_shared';

export const DialogNameAudit = defineA11yAudit({
  rules: ['aria-dialog-name'],
  meta: {
    ...base,
    ...graded('A', 'dialog-name'),
    id: 'operability-safety/dialog-name',
    title: 'Dialogs have accessible names',
    failureTitle: 'Dialogs without accessible names',
    description:
      'AI browser agents detect modals via role="dialog"/"alertdialog" and need an accessible name to understand the dialog’s purpose. Unlabeled dialogs trap agents in unknown UI states, blocking confirmations, forms, or cookie-consent flows.',
    defaultPriority: 'high',
    guidance: {
      impact:
        'An unlabeled dialog gives an agent no context for the interruption, so it cannot decide how to proceed.',
      fix: 'Add aria-labelledby (pointing to the dialog title) or aria-label to every role="dialog"/"alertdialog" element. Prefer the native <dialog> element.',
      code: '<div role="dialog" aria-labelledby="dlg-title">\n  <h2 id="dlg-title">Confirm action</h2>\n</div>',
      effort: 'easy',
      tags: ['aria', 'dialog', 'agent'],
    },
  },
});
