import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Landed-Cost and Returns Machine Readability".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade A → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/agentic-commerce/landed-cost-and-returns-machine-readability.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Parse all JSON-LD/microdata on 2 sampled PDPs plus the Organization node on the homepage.
// SHIPPING leg — require offers.shippingDetails (OfferShippingDetails) with: shippingRate as
// MonetaryAmount having numeric value + currency (or doesNotShip:true, which is a legitimate
// explicit answer); shippingDestination.addressCountry present; and traverse deliveryTime (type
// ShippingDeliveryTime) requiring BOTH handlingTime and transitTime as QuantitativeValue with
// numeric minValue and maxValue and unitCode 'DAY' — note handlingTime/transitTime are nested under
// deliveryTime, not direct properties of OfferShippingDetails. RETURNS leg — require
// hasMerchantReturnPolicy (Organization or Offer level) with applicableCountry (ISO 3166-1 alpha-2)
// AND returnPolicyCategory from the 3-value enum; when category is
// MerchantReturnFiniteReturnWindow, merchantReturnDays MUST be a positive integer. Downgrade (do
// not pass) policies that satisfy Google only via merchantReturnLink, because a URL is not a number
// an agent can compare. Recommended sub-scores for returnFees and returnMethod. OUTPUT — synthesise
// and show the merchant the exact feed values this maps to: the positional `shipping` string
// US::standard:5.99:1:3 and return_deadline_in_days=30, so remediation is copy-paste.
export class LandedCostAndReturnsMachineReadabilityAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/agentic-commerce/landed-cost-and-returns-machine-readability',
    category: 'agentic-commerce',
    title: "Landed-Cost and Returns Machine Readability",
    failureTitle: "Landed-Cost and Returns Machine Readability",
    description: "Requires structured, agent-parsable shipping cost, handling and transit times, and a return window expressed as an integer — the exact inputs an agent needs to rank offers and the exact fields the ACP checkout session must compute.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "Falsifiable claim: ACP makes `fulfillment_options` and `totals` REQUIRED on every CheckoutSession, and the seller — not the agent — is responsible for 'calculating all amounts (item prices, discounts, taxes, shipping)'; totals must break down into typed entries including `fulfillment` and `tax` before status can reach `ready_for_payment`. Upstream of that, the OpenAI feed `shipping` field is a rigid positional string country:region:service_class:price:handling_days:transit_days, and the returns fields are accepts_returns, return_deadline_in_days (positive integer) and return_policy URL. Agents rank competing offers on landed cost and delivery date, both of which are numbers. A merchant that publishes shipping and returns only as prose on a /shipping page supplies no number, so it either loses the comparison or forces a headless-browser fallback. Disproof condition: agents consistently ranking offers correctly from prose-only shipping pages.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/agentic-commerce/landed-cost-and-returns-machine-readability.md',
      tags: ['proposed', 'agentic-commerce'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/agentic-commerce/landed-cost-and-returns-machine-readability.md',
      'TODO stub',
    );
  }
}
