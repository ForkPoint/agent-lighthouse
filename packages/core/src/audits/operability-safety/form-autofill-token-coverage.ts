// Graduated from proposal 2026-08-22 (Plan 5, Task 7). Narrowed to credential
// tokens 2026-10-18: only these have a documented agent consumer. Profile,
// address and payment tokens moved to profile-autofill-token-coverage.
// Evidence dossier: docs/evidence/audits/operability-safety/form-autofill-token-coverage.md
//
// Scope note (non-double-counting): `autocomplete` (the axe autocomplete-valid
// rule) checks that a token which is ALREADY present is spelled legally. It
// cannot fire on absence, and it has no notion of which token a field should
// carry. This audit measures the other half — coverage — by inferring the
// concept from the label, name, placeholder and type, then asking whether the
// field declares the matching token. `label` covers accessible naming and
// `form-error-messages` covers error wiring on constrained fields; the two
// side findings here are narrower (asterisk-only required-ness, and an error
// element sitting next to a field that points at nothing). They are counted on
// forms that carry a credential field; the profile audit counts the rest.
import type { AuditMeta } from "#core/types";
import { weightForGrade } from "#core/scorer";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  ScoreDisplayMode,
} from "#core/types";
import { AutofillScope, AutofillTokenAudit } from "./_autofill";

const SAMPLE = `<!-- The token is the contract: a password manager acting for an agent fills by it. -->
<label for="user">Email or username</label>
<input id="user" name="username" type="text" autocomplete="username" required>

<label for="pass">Password</label>
<input id="pass" name="password" type="password"
       autocomplete="current-password" required>

<label for="otp">Verification code</label>
<input id="otp" name="otp" inputmode="numeric" autocomplete="one-time-code">`;

export class FormAutofillTokenCoverageAudit extends AutofillTokenAudit {
  static override meta: AuditMeta = {
    id: "operability-safety/form-autofill-token-coverage",
    category: "operability-safety",
    title: "Form Autofill Token Coverage",
    failureTitle: "Form Autofill Token Coverage",
    description:
      "Whether each sign-in, sign-up and one-time-code field declares the matching WHATWG autocomplete token (username, current-password, new-password, one-time-code), a stable name or id, and the matching input type. These are the tokens a password manager fills when an agent signs in for the user: Gemini in Chrome with Google Password Manager, and Claude with 1Password. Scored as covered fields over credential fields across the scanned forms. Also counts, on those forms, fields marked mandatory only by an asterisk and error elements a field does not reference.",
    scoreDisplayMode: ScoreDisplayMode.Ternary,
    weight: weightForGrade(EvidenceGrade.A, AuditTier.Scored),
    evidenceGrade: EvidenceGrade.A,
    tier: AuditTier.Scored,
    dossier:
      "docs/evidence/audits/operability-safety/form-autofill-token-coverage.md",
    requires: [
      EvidenceKey.OriginReachable,
      EvidenceKey.UnblockedFetches,
      EvidenceKey.RenderedBody,
      EvidenceKey.SampleAdequate,
    ],
    defaultPriority: CheckPriority.High,
    guidance: {
      impact:
        "Agents that sign in for a user do not type the password themselves: Gemini in Chrome asks permission to use Google Password Manager, and Claude fills logins through 1Password, which identifies fields by their autocomplete attribute. A sign-in field without username or current-password, a sign-up field without new-password, or a code field without one-time-code leaves the password manager guessing, and an agent that cannot sign in cannot act.",
      fix: "Give every credential field its WHATWG token: username on the account identifier, current-password on sign-in, new-password on sign-up and password change, one-time-code on verification codes. Add a stable name or id. Express required-ness with the required attribute rather than an asterisk in the label, and point each field at its error element with aria-describedby or aria-errormessage.",
      code: SAMPLE,
      effort: FixEffort.Easy,
      docsUrl:
        "https://forkpoint.github.io/agent-lighthouse/audits/operability-safety/form-autofill-token-coverage/",
      tags: [
        "forms",
        "autocomplete",
        "autofill",
        "credentials",
        "agent-operability",
        "accessibility",
      ],
    },
  };

  protected scope = AutofillScope.Credential;
  protected copy = {
    noun: "credential field",
    expected:
      "Every sign-in, sign-up and one-time-code field declares the matching autocomplete token, a stable name or id, and a consistent input type",
    sample: SAMPLE,
    priority: CheckPriority.High,
  };
}
