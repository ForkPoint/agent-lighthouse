import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Form Autofill Token Coverage".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade A → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/agent-operability/form-autofill-token-coverage.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Static parse of every <form>. For each control, infer the intended concept from label text,
// name/id, placeholder and type using a keyword→token map (email→email,
// zip|postcode|postal→postal-code, phone|tel|mobile→tel, card number|cc-num→cc-number, expiry|exp
// date→cc-exp, cvv|cvc|security code→cc-csc, address line 2|apt|suite→address-line2,
// city|town→address-level2, state|province|region→address-level1, first name→given-name, last
// name|surname→family-name, dob|birth→bday, otp|verification code→one-time-code, password on a
// login form→current-password, on a signup form→new-password). A field is COVERED when it has an
// autocomplete attribute whose token equals the inferred token (or is a valid token from the spec
// list when inference is ambiguous), plus a non-empty name or id, plus a type consistent with the
// concept (email→type=email, tel→type=tel, otp→inputmode=numeric + autocomplete=one-time-code).
// Separately flag: required-ness expressed only by a visual asterisk with no required attribute or
// aria-required; validation constraints expressed only in JS with no pattern/min/max/minlength;
// error messages rendered as adjacent text with no aria-describedby link and no aria-invalid on the
// field. Emit form-level score plus a per-field diff table showing expected vs actual token.
export class FormAutofillTokenCoverageAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/agent-operability/form-autofill-token-coverage',
    category: 'agent-operability',
    title: "Form Autofill Token Coverage",
    failureTitle: "Form Autofill Token Coverage",
    description: "Per-form score for whether every field an agent must populate carries the machine-readable identity an agent needs: a stable name/id, a correct input type, a WHATWG autocomplete token when the field maps to a standard autofill concept, programmatic constraints, and error wiring via aria-invalid/aria-describedby. Scored as covered-fields / autofillable-fields per form.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "Falsifiable claim: an agent filling a checkout must map each field to a value from user profile data. When the field declares autocomplete=\"postal-code\", that mapping is a table lookup against a ratified vocabulary; when it declares name=\"field_7\" with a visual-only label, the mapping is an inference that fails on ambiguous cases (address-line2 vs address-level2, cc-exp vs bday, tel-national vs tel). WebSuite measures the consequence directly: complex form filling succeeds 12.5% and 0% for the two agents tested, against 85%/76% for simple operational clicks. Test: add correct autocomplete tokens to a failing form and re-run the same fill task.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/agent-operability/form-autofill-token-coverage.md',
      tags: ['proposed', 'agent-operability'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/agent-operability/form-autofill-token-coverage.md',
      'TODO stub',
    );
  }
}
