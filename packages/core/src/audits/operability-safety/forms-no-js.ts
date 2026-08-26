import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from '../../scorer';
import type { CheckContext } from '../../check-context';
import { extractForms } from '../../parser';

export class FormsNoJsAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'operability-safety/forms-no-js',
    category: 'operability-safety',
    title: 'Forms work without JavaScript',
    failureTitle: 'Forms work without JavaScript',
    description:
      'Many AI agents do not execute JavaScript, so forms that rely on JS for submission are invisible to them. Adding standard HTML action and method attributes ensures forms work via simple HTTP requests, making them accessible to all AI agents.',
    scoreDisplayMode: 'informative',
    weight: weightForGrade('C', 'informative'),
    evidenceGrade: 'C',
    tier: 'informative',
    dossier: 'docs/evidence/audits/operability-safety/forms-no-js.md',
    requires: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
    defaultPriority: 'medium',
    guidance: {
      impact:
        'Most AI agents do not execute JavaScript. If your forms rely on JS for submission (e.g., React/Vue event handlers with no HTML action), agents cannot submit them at all. This blocks lead capture, contact requests, and any form-based interaction.',
      fix: 'Ensure every <form> element has a standard HTML action attribute pointing to a server endpoint and a method attribute (typically POST). This allows forms to work via plain HTTP requests without JavaScript.',
      code: `<!-- Use standard HTML form attributes -->
<form action="/api/contact" method="POST">
  <input type="text" name="name" required />
  <input type="email" name="email" required />
  <textarea name="message" required></textarea>
  <button type="submit">Send</button>
</form>`,
      effort: 'easy',
      tags: ['forms', 'html', 'accessibility', 'no-js'],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    let totalForms = 0;
    let formsWithAction = 0;
    let formsWithMethod = 0;
    let firstPageUrl = '';

    for (const page of ctx.pages) {
      const forms = extractForms(page.$);
      totalForms += forms.length;

      for (const form of forms) {
        if (form.action && form.action !== '') formsWithAction++;
        /* v8 ignore start */
        if (form.method && form.method !== '') formsWithMethod++;
        if (!firstPageUrl && forms.length > 0) firstPageUrl = page.url;
        /* v8 ignore stop */
      }
    }

    if (totalForms === 0) {
      return this.notApplicable(
        'No forms found on scanned pages — nothing to check.',
        'Forms have action attribute and method defined',
        '0 forms',
      );
    }

    const fullyFunctional = formsWithAction; // action is the critical attribute for no-JS
    const allHaveBoth = formsWithAction === totalForms && formsWithMethod === totalForms;

    if (allHaveBoth) {
      return this.pass(
        `All ${totalForms} form(s) have both action and method attributes.`,
        'Forms have action attribute and method defined',
        `${totalForms}/${totalForms} forms with action and method`,
        firstPageUrl,
      );
    }

    const recommendation = {
      priority: 'medium' as const,
      description: FormsNoJsAudit.meta.description,
      code: `<!-- Use standard HTML form attributes -->\n<form action="/api/contact" method="POST">\n  <input type="text" name="name" required />\n  <input type="email" name="email" required />\n  <textarea name="message" required></textarea>\n  <button type="submit">Send</button>\n</form>`,
    };

    if (fullyFunctional > 0) {
      return this.warn(
        `${formsWithAction}/${totalForms} forms have action, ${formsWithMethod}/${totalForms} have method.`,
        'Forms have action attribute and method defined',
        `${formsWithAction}/${totalForms} action, ${formsWithMethod}/${totalForms} method`,
        recommendation,
        firstPageUrl,
      );
    }

    return this.fail(
      `None of the ${totalForms} form(s) have an action attribute — they require JavaScript to submit.`,
      'Forms have action attribute and method defined',
      `0/${totalForms} forms with action`,
      recommendation,
      firstPageUrl,
    );
  }
}
