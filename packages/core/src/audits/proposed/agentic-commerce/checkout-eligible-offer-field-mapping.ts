import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Checkout-Eligible Offer Field Mapping".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade A → scored tier. Implementation difficulty: multi-page.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/agentic-commerce/checkout-eligible-offer-field-mapping.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// For each sampled PDP, extract the Product/Offer graph and map to feed columns, then assert:
// item_id source exists (sku, mpn, or a stable URL-derived id) and <=100 chars; name present and
// <=150; description present and <=5000 (flag both empty and truncation risk); brand.name present
// and <=70; url is absolute HTTPS and self-canonical; image is an absolute HTTPS JPEG/PNG that
// returns 200 with an image/* Content-Type; offers.price is a single resolvable number (fail on
// AggregateOffer, fail on price-as-string-with-symbol) and offers.priceCurrency is a valid 3-letter
// ISO 4217 code; offers.availability maps cleanly onto {in_stock,out_of_stock,pre_order,backorder}
// — flag unmapped schema values such as LimitedAvailability or SoldOut as ambiguous; at least one
// of gtin/gtin8/gtin12/gtin13/gtin14/mpn present, and when present validate GTIN check-digit and
// length (8/12/13/14). Conditional assertions: if availability maps to pre_order or backorder,
// require an availabilityStarts/availability_date-equivalent date; if a sale price is present
// (offers with both listPrice/highPrice semantics or two prices in markup), assert sale < regular.
// Emit a per-PDP row-rejection verdict plus the synthesised feed row.
export class CheckoutEligibleOfferFieldMappingAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/agentic-commerce/checkout-eligible-offer-field-mapping',
    category: 'agentic-commerce',
    title: "Checkout-Eligible Offer Field Mapping",
    failureTitle: "Checkout-Eligible Offer Field Mapping",
    description: "Audits each PDP against the exact required-and-conditional field set of the OpenAI product feed spec, including its character caps and its conditional triggers, so the merchant learns which rows will be rejected before uploading a feed.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "Falsifiable claim: the OpenAI feed spec enumerates a closed set of required fields (item_id <=100, title <=150, description <=5000, brand <=70, url, image_url, price with ISO 4217 currency, availability from a 5-value enum, target_countries) plus three conditional triggers that reject rows: gtin-or-mpn required unless identifier_exists=no; availability_date required when availability is pre_order or backorder; seller_privacy_policy and seller_tos required when is_eligible_checkout=true. Validation is row-by-row, so individual products fail silently while the feed as a whole succeeds. A PDP that cannot supply these values forces the merchant to hand-author or scrape them, which is precisely where price mismatch enters. Disproof condition: rows lacking gtin/mpn and identifier_exists being accepted as checkout-eligible.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/agentic-commerce/checkout-eligible-offer-field-mapping.md',
      tags: ['proposed', 'agentic-commerce'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/agentic-commerce/checkout-eligible-offer-field-mapping.md',
      'TODO stub',
    );
  }
}
