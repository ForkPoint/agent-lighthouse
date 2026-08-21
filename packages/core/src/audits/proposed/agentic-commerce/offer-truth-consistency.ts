import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Offer Truth Consistency".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: multi-page.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/agentic-commerce/offer-truth-consistency.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// All sub-rules are deterministic and static; run them per PDP and report each independently rather
// than as one blob. (a) STOCK CONTRADICTION: offers.availability maps to in_stock while raw HTML
// contains /sold\s*out|out of stock|notify me when|back in stock|currently unavailable/i inside the
// main product region, or the primary add-to-cart <button> carries the disabled attribute. (b)
// STALE PRICE WINDOW: priceValidUntil parses to a date earlier than today. (c) PRICE DIVERGENCE:
// extract currency-formatted numbers from the product region, take the most prominent (largest
// font-size via inline style/class heuristics, else first occurrence after the <h1>), and fail when
// it differs from offers.price by more than 1 percent — normalise thousands separators and decimal
// commas before comparing. (d) CURRENCY MISMATCH: the rendered currency symbol/code disagrees with
// offers.priceCurrency. (e) SALE INVERSION: a sale price greater than or equal to the regular
// price, which the feed spec forbids outright. (f) DUPLICATE CONFLICT: two JSON-LD Product nodes
// sharing a url or @id but carrying different prices or availability. (g) MISSING PRICE: no
// offers.price at all while the page clearly renders a price. Because (c) and (d) depend on
// rendered text, run them static-first and mark them INDETERMINATE rather than FAIL when the price
// node is absent from initial HTML; escalate those pages to the headless tier, which is roadmap.
export class OfferTruthConsistencyAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/agentic-commerce/offer-truth-consistency',
    category: 'agentic-commerce',
    title: "Offer Truth Consistency",
    failureTitle: "Offer Truth Consistency",
    description: "Hunts for internal contradictions between what a page's structured data claims and what the page actually says about price and stock — the class of defect that makes an agent quote a price it cannot honour.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "Falsifiable claim: the agent quotes from indexed structured data or the feed, while the ACP checkout session recomputes authoritative amounts seller-side; ACP defines dedicated message codes `invalid`, `out_of_stock` and `low_stock` for exactly this divergence, and totals are recomputed by the seller before status can reach ready_for_payment. A page whose markup says InStock at 49.00 while its DOM says Sold out at 59.00 therefore produces a quote-to-checkout mismatch, which surfaces to the buyer as a price change or a failed purchase. Disproof condition: contradictory pages transacting without a mismatch message.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/agentic-commerce/offer-truth-consistency.md',
      tags: ['proposed', 'agentic-commerce'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/agentic-commerce/offer-truth-consistency.md',
      'TODO stub',
    );
  }
}
