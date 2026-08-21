import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "First-Contact Consent Gate Operability".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade C → informative tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/agent-operability/first-contact-consent-gate-operability.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Static tier: fetch with no cookies and no consent signals. Detect a CMP by script host or global
// (__tcfapi, OneTrust/otSDKStub, Cookiebot, Didomi, Quantcast/quantcast choice, Osano,
// Usercentrics, Sourcepoint). Then assert: (a) the page's primary content (article body, product
// data, or main landmark text) is present in the returned HTML rather than replaced by an
// interstitial — compare content length and presence of the JSON-LD main entity against a second
// fetch carrying a consent cookie; (b) the consent dialog's accept and reject controls resolve to
// elements with a button/link role and a non-empty accessible name, in the top document; fail when
// the dialog root is an <iframe> with a cross-origin src; (c) main content is not marked inert or
// aria-hidden=true for the duration; (d) the dialog is dismissible without a scroll-inside-iframe
// or a multi-step 'manage preferences' journey — count the minimum clicks to reject. Headless tier
// verifies (c) and (d) by actually running the dismissal and counting actions. Report as a
// diagnostic with an action-cost number rather than a pass/fail score.
export class FirstContactConsentGateOperabilityAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/agent-operability/first-contact-consent-gate-operability',
    category: 'agent-operability',
    title: "First-Contact Consent Gate Operability",
    failureTitle: "First-Contact Consent Gate Operability",
    description: "Evaluates the cold-session interstitial an agent meets before any task work: whether primary content exists in the DOM behind the consent layer, whether the accept and reject controls have accessible names and live in the main document rather than a cross-origin iframe, and whether the layer traps the agent via inert/aria-hidden on main content.",
    scoreDisplayMode: 'binary',
    weight: 0,
    defaultPriority: 'medium',
    guidance: {
      impact: "Plausible-convention claim: an agent arriving with no cookies must spend its first actions dismissing a consent layer before any task step. Three properties determine whether it can. (1) If the layer is rendered inside a cross-origin third-party iframe, DOM-text extractors that read only the top document return the underlying page text while the screenshot shows a blocker — the agent's two modalities disagree and it acts on stale content. (2) If the accept/reject controls are unroled or unnamed divs, they are unaddressable in the snapshot for the same reason as the Ghost-Clickable check. (3) If main content is set inert or aria-hidden while the layer is open, every subsequent snapshot is empty until the layer is dismissed, and axe's own guidance notes that aria-hidden removes the element and all children from the accessibility API. WebVoyager names pop-up windows among the things real sites throw at agents. Test: load with a clean profile and diff the snapshot against a post-consent load.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/agent-operability/first-contact-consent-gate-operability.md',
      tags: ['proposed', 'agent-operability'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/agent-operability/first-contact-consent-gate-operability.md',
      'TODO stub',
    );
  }
}
