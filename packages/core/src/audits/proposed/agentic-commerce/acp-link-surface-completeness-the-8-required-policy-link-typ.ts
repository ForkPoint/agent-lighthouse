import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "ACP Link-Surface Completeness (the 8 required policy link types)".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade A → scored tier. Implementation difficulty: multi-page.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/agentic-commerce/acp-link-surface-completeness-the-8-required-policy-link-typ.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// 1) Fetch homepage + 2 sampled PDPs; extract every <a href> from the RAW HTML (no JS) plus any
// <link rel> policy hints. 2) Classify each href into the 8 enum types using path and anchor-text
// regexes: terms_of_use=/terms|/tos|terms-of-(service|use|sale);
// privacy_policy=/privacy|privacy-(policy|notice);
// return_policy=/returns?|/refunds?|return-policy|/exchanges;
// shipping_policy=/shipping|/delivery|shipping-policy; contact_us=/contact; about_us=/about;
// faq=/faqs?|frequently-asked; support=/support|/help|/customer-(service|care). 3) For each
// resolved URL: require scheme https, final status 200 after <=3 same-registrable-domain redirects,
// Content-Type text/html, and a soft-404 guard (raw body must contain >=500 chars of extracted text
// and must NOT match /page not found|404|doesn.t exist/i in <title> or <h1>). 4) No-JS guard:
// policy text must be present in the initial HTML, since ACP link targets are opened by agents that
// may not execute JS. 5) Score = fraction of 8 types resolved; terms_of_use and privacy_policy are
// hard gates that force the whole check to fail. Emit the resolved URL per type so the merchant can
// paste them straight into their `links` array and feed rows.
export class AcpLinkSurfaceCompletenessThe8RequiredPolicyLinkTypAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/agentic-commerce/acp-link-surface-completeness-the-8-required-policy-link-typ',
    category: 'agentic-commerce',
    title: "ACP Link-Surface Completeness (the 8 required policy link types)",
    failureTitle: "ACP Link-Surface Completeness (the 8 required policy link types)",
    description: "Verifies the merchant can populate the `links` array that every ACP CheckoutSession response is required to carry, by resolving each of the 8 enum link types to a stable, HTTPS, no-JS-required, non-soft-404 URL on the merchant's own site.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "Falsifiable claim: ACP spec 2026-04-17 makes `links` one of the 9 REQUIRED fields on every CheckoutSession response, with type enum {terms_of_use, privacy_policy, return_policy, shipping_policy, contact_us, about_us, faq, support}. Independently, the OpenAI product feed spec makes `seller_privacy_policy` and `seller_tos` HARD-REQUIRED whenever `is_eligible_checkout=true`. Therefore a merchant that cannot produce a resolvable HTTPS URL for terms_of_use and privacy_policy CANNOT set is_eligible_checkout=true and its catalogue is excluded from Instant Checkout no matter how good the feed is. Disproof condition: if a merchant with no reachable ToS URL is observed transacting via ACP Instant Checkout, the check is wrong.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/agentic-commerce/acp-link-surface-completeness-the-8-required-policy-link-typ.md',
      tags: ['proposed', 'agentic-commerce'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/agentic-commerce/acp-link-surface-completeness-the-8-required-policy-link-typ.md',
      'TODO stub',
    );
  }
}
