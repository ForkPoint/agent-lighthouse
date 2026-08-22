// TODO(redeem): this audit survives only if rewritten (pending triage approval). Target tier: scored.
// Evidence dossier: docs/evidence/audits/operability-safety/form-error-messages.md
// Required rework:
//   Rebuild: verify aria-describedby/aria-errormessage linkage on invalid-state inputs instead of
//   current broken heuristic. Evidence: a11y-tree consumption by computer-use agents graded A.

import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';

export class FormErrorMessagesAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'operability-safety/form-error-messages',
    category: 'operability-safety',
    title: 'Form error messages linked',
    failureTitle: 'Form error messages linked',
    description:
      'AI agents filling forms use aria-describedby to detect and understand validation errors programmatically. Without linked error messages, agents cannot self-correct form submissions, causing them to repeatedly submit invalid data or abandon the form entirely.',
    scoreDisplayMode: 'ternary',
    weight: weightForGrade('A', 'scored'),
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/operability-safety/form-error-messages.md',
    defaultPriority: 'medium',
    guidance: {
      impact:
        'AI agents filling forms use aria-describedby to detect and understand validation errors programmatically. Without linked error messages, agents cannot self-correct form submissions, causing them to repeatedly submit invalid data or abandon the form entirely.',
      fix: 'Add aria-describedby attributes to form inputs that link to error message elements. Use role="alert" on error message containers for dynamic error display.',
      code: '<input id="email" aria-describedby="email-error">\n<span id="email-error" role="alert">Please enter a valid email.</span>',
      effort: 'easy',
      docsUrl: 'https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA1',
      tags: ['a11y', 'forms', 'aria', 'accessibility'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    if (!ctx.pages || ctx.pages.length === 0) {
      return this.notApplicable(
        'No pages scanned — nothing to evaluate (excluded from score).',
        'Form inputs use aria-describedby to link to error messages',
        'No pages scanned',
      );
    }

    let totalFormInputs = 0;
    let withDescribedby = 0;

    for (const page of ctx.pages) {
      const $ = page.$;
      const formInputs = $('form input, form select, form textarea');

      formInputs.each((_, el) => {
        const type = ($(el).attr('type') ?? '').toLowerCase();
        if (type === 'hidden' || type === 'submit' || type === 'button') return;
        totalFormInputs++;
        const describedbyIds = $(el).attr('aria-describedby');
        if (describedbyIds) {
          // Verify at least one referenced ID actually exists in the DOM
          const ids = describedbyIds.split(/\s+/).filter(Boolean);
          const hasValidRef = ids.some((id) => $(`[id="${id.replace(/"/g, '\\"')}"]`).length > 0);
          if (hasValidRef) {
            withDescribedby++;
          }
        }
      });
    }

    if (totalFormInputs === 0) {
      return this.notApplicable(
        'No form inputs found — no forms to validate (excluded from score).',
        'Form inputs use aria-describedby to link to error messages',
        'No form inputs on scanned pages',
      );
    }

    if (withDescribedby > 0) {
      return this.pass(
        `${withDescribedby} of ${totalFormInputs} form input(s) use aria-describedby for error message linking.`,
        'Form inputs use aria-describedby to link to error messages',
        `${withDescribedby} of ${totalFormInputs} input(s) have aria-describedby`,
      );
    }

    return this.warn(
      'No form inputs use aria-describedby. Error messages should be programmatically linked to their inputs.',
      'Form inputs use aria-describedby to link to error messages',
      `${totalFormInputs} form input(s), none with aria-describedby`,
      {
        priority: 'medium',
        description:
          'AI agents filling forms use aria-describedby to detect and understand validation errors programmatically. Without linked error messages, agents cannot self-correct form submissions, causing them to repeatedly submit invalid data or abandon the form entirely.',
        code: '<input id="email" aria-describedby="email-error">\n<span id="email-error" role="alert">Please enter a valid email.</span>',
      },
    );
  }
}
