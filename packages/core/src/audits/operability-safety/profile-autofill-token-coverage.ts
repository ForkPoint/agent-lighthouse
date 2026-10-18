// Split from form-autofill-token-coverage 2026-10-18. Profile, address and
// payment tokens have a documented consumer in browser autofill and password
// managers, but no AI agent documents filling them, and ChatGPT Atlas agent
// mode is reported to be excluded from autofill data. Hence C, informative:
// the mechanism is plausible for agents, the consumer path is unproven.
// Evidence dossier: docs/evidence/audits/operability-safety/profile-autofill-token-coverage.md
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

const SAMPLE = `<!-- The token is the contract: autofill maps profile data to it by lookup. -->
<label for="email">Email *</label>
<input id="email" name="email" type="email"
       autocomplete="email" required
       aria-invalid="true" aria-describedby="email-error">
<span id="email-error" role="alert">Enter a valid email address.</span>

<label for="zip">ZIP</label>
<input id="zip" name="zip" type="text" autocomplete="postal-code">`;

export class ProfileAutofillTokenCoverageAudit extends AutofillTokenAudit {
  static override meta: AuditMeta = {
    id: "operability-safety/profile-autofill-token-coverage",
    category: "operability-safety",
    title: "Profile Autofill Token Coverage",
    failureTitle: "Profile Autofill Token Coverage",
    description:
      "Whether each contact, address and payment field declares the matching WHATWG autocomplete token (email, tel, given-name, postal-code, address-level2, cc-number and the rest), a stable name or id, and the matching input type. Browsers and password managers fill by these tokens; no AI agent documents filling them, so the check is informative and does not score. Reported as covered fields over profile fields across the scanned forms. Also counts, on forms with no credential field, fields marked mandatory only by an asterisk and error elements a field does not reference.",
    scoreDisplayMode: ScoreDisplayMode.Informative,
    weight: weightForGrade(EvidenceGrade.C, AuditTier.Informative),
    evidenceGrade: EvidenceGrade.C,
    tier: AuditTier.Informative,
    dossier:
      "docs/evidence/audits/operability-safety/profile-autofill-token-coverage.md",
    requires: [
      EvidenceKey.OriginReachable,
      EvidenceKey.UnblockedFetches,
      EvidenceKey.RenderedBody,
      EvidenceKey.SampleAdequate,
    ],
    defaultPriority: CheckPriority.Low,
    guidance: {
      impact:
        'Browser autofill and password managers map each field to a stored profile value by its autocomplete token. When a field declares autocomplete="postal-code", that mapping is a lookup against a ratified vocabulary; when it declares name="field_7" with a visual-only label, the mapping is a guess that fails on ambiguous cases (address-line2 vs address-level2, cc-exp vs bday). Agents running in the browser inherit the same fields, though no agent vendor documents filling profile data today.',
      fix: "Give every field that maps to a standard autofill concept its WHATWG token (email, tel, given-name, family-name, postal-code, address-level1/2, country-name, cc-number, cc-exp, cc-csc), plus a stable name or id and the matching input type. Express required-ness with the required attribute rather than an asterisk in the label, and point each field at its error element with aria-describedby or aria-errormessage.",
      code: SAMPLE,
      effort: FixEffort.Easy,
      docsUrl:
        "https://forkpoint.github.io/agent-lighthouse/audits/operability-safety/profile-autofill-token-coverage/",
      tags: ["forms", "autocomplete", "autofill", "checkout", "accessibility"],
    },
  };

  protected scope = AutofillScope.Profile;
  protected copy = {
    noun: "profile field",
    expected:
      "Every contact, address and payment field declares the matching autocomplete token, a stable name or id, and a consistent input type",
    sample: SAMPLE,
    priority: CheckPriority.Low,
  };
}
