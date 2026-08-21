import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "ClaimReview investment advisory".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade A → informative tier. Implementation difficulty: multi-page.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/trust-provenance/claimreview-investment-advisory.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// 1) Parse JSON-LD (and microdata) for ClaimReview nodes across crawled pages. 2) If none, emit
// nothing — absence is not a defect. 3) If present, validate required properties: claimReviewed
// (non-empty), url, and reviewRating carrying a human-readable alternateName such as 'True'/'Mostly
// false'; flag reviewRating using only numeric ratingValue with no alternateName. 4) Flag pages
// carrying more than one ClaimReview node, since only one qualifies. 5) Attach the phase-out
// advisory with the Google doc citation and note that the Fact Check Explorer remains a consumer,
// so existing markup is not worthless — just not a Search surface. 6) scoreable=false, weight zero:
// this is a 'know the status before you invest further' signal. Deliberately included as the honest
// negative answer to whether fact-check schema is an AI-readiness lever — it is not.
export class ClaimreviewInvestmentAdvisoryAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/trust-provenance/claimreview-investment-advisory',
    category: 'trust-provenance',
    title: "ClaimReview investment advisory",
    failureTitle: "ClaimReview investment advisory",
    description: "ADVISORY / UNSCORED. Detects ClaimReview markup and tells the operator the truth about its status rather than rewarding coverage: Google is phasing out ClaimReview support in Search, while the Fact Check Explorer still consumes it. Also validates the required shape and the one-per-page constraint for sites that keep it.",
    scoreDisplayMode: 'binary',
    weight: 0,
    defaultPriority: 'medium',
    guidance: {
      impact: "Google's fact check documentation states plainly: 'We're phasing out support for ClaimReview markup in Google Search', with no deprecation date, and notes only one ClaimReview element per page qualifies for rich results. A check that scored ClaimReview coverage as an AI-readiness win would therefore push publishers to invest in a channel its largest documented consumer is actively withdrawing from. FALSIFIABLE and grade A on the evidence, but it measures the state of an external product, not the quality of the site — which is exactly why it must not contribute to a score.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/trust-provenance/claimreview-investment-advisory.md',
      tags: ['proposed', 'trust-provenance'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/trust-provenance/claimreview-investment-advisory.md',
      'TODO stub',
    );
  }
}
