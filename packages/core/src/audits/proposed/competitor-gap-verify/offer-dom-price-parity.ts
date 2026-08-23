import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "offer-dom-price-parity".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: multi-page.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/competitor-gap-verify/offer-dom-price-parity.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Static per-page; reuses the JSON-LD parse our structured-data audits already perform and the raw
// HTML the fetcher already holds. New file
// packages/core/src/audits/structured-data/offer-dom-price-parity.ts, sitting alongside
// offer-schema.ts /
// product-details.ts / product-transaction-certainty.ts, which all check PRESENCE of fields and
// must be left alone — this audit checks AGREEMENT of values, an orthogonal axis. False-positive
// controls that matter: restrict extraction to the main product region (nearest common ancestor of
// the h1 and the first Offer-bearing node) so related-product carousels and 'was/now' strikethrough
// prices do not fire; accept a match against any candidate, not the first; treat a
// strikethrough/`<del>`/`.was-price` value as an acceptable non-match; and demote to warn rather
// than fail when raw HTML has no price at all, since that is case (f), a different finding. Grade B
// rather than A: the mechanism is documented Google policy plus documented non-rendering crawlers,
// but no AI vendor has published 'we reject offers whose markup disagrees with the DOM'.
export class OfferDomPriceParityAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/competitor-gap-verify/offer-dom-price-parity',
    category: 'competitor-gap-verify',
    title: "offer-dom-price-parity",
    failureTitle: "offer-dom-price-parity",
    description: "Cross-artifact reconciliation of machine-readable commerce claims against what the raw HTML actually says, for shopping agents. On pages carrying JSON-LD or microdata `@type: Product`/`Offer`, extract offers.price, priceCurrency, availability, priceValidUntil, sku/gtin. Then extract candidate values from the RAW (unrendered) HTML main-content region: prices via a currency-anchored regex built from the declared priceCurrency (symbol and ISO code, tolerant of thousand separators and non-breaking spaces), and availability via phrase matching ('in stock', 'out of stock', 'sold out', 'pre-order', 'backorder', 'discontinued'). Failure classes. (a) PRICE-DISAGREEMENT, critical: at least one price is present in raw HTML and none equals the JSON-LD price after numeric normalisation. (b) AVAILABILITY-DISAGREEMENT, critical: availability is schema:InStock while the main-content region contains an out-of-stock phrase, or vice versa. (c) STALE-OFFER, high: priceValidUntil is in the past. (d) AMBIGUOUS-OFFER, high: two or more Offer nodes carry different price values for the same sku with no AggregateOffer wrapper — the agent has no rule for choosing. (e) UNMACHINE-READABLE, high: a price is visible in raw HTML but no Offer.price exists. (f) JS-ONLY-PRICE, warn not fail: neither the raw HTML nor the JSON-LD contains any price, meaning the number is injected client-side — reported separately because no major AI crawler executes JavaScript.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "Shopping agents read the structured offer, not the pixels, and no major AI crawler runs JS. Causal chain: if Offer.price is stale or contradicts the page, the agent quotes a price the checkout will reject, and the transaction fails after the user has committed — the most expensive possible failure mode in agentic commerce. Google's own structured data guidelines state verbatim 'Your structured data must be a true representation of the page content' and 'Don't mark up content that is not visible to readers of the page', so the disagreement is a documented policy violation as well as an agent failure. Falsifiable per page: the JSON-LD price either appears among the raw-HTML price candidates or it does not.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/competitor-gap-verify/offer-dom-price-parity.md',
      tags: ['proposed', 'competitor-gap-verify'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/competitor-gap-verify/offer-dom-price-parity.md',
      'TODO stub',
    );
  }
}
