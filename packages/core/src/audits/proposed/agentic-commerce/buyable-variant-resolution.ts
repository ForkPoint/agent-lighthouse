import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Buyable Variant Resolution".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: multi-page.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/agentic-commerce/buyable-variant-resolution.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Step 1 — establish that variants EXIST from the raw HTML: any <select> whose name/id/class
// matches /(size|colour|color|variant|option|style|width|length)/i with >=2 non-placeholder
// <option>s; or >=2 elements bearing data-variant-id / data-option-value / data-product-variant; or
// platform fingerprints (Shopify: window.ShopifyAnalytics.meta.product.variants, or a fetchable
// /products/{handle}.js returning variants[]; WooCommerce:
// form.variations_form[data-product_variations]; BigCommerce: productOptions). Step 2 — require the
// JSON-LD to resolve those variants, passing if EITHER (a) a ProductGroup node with productGroupID,
// variesBy, and hasVariant[] where every entry has sku-or-gtin* AND its own offers.price +
// offers.priceCurrency + offers.availability, OR (b) >=2 distinct Product nodes each with a unique
// sku-or-gtin and its own complete Offer. Step 3 — hard fail if the page has N>=2 detected variants
// but exposes exactly one Offer, or an AggregateOffer with lowPrice/highPrice and no per-variant
// offers, since no single price can be quoted. Step 4 — cross-check cardinality: warn when the
// count of variants in markup differs from the count detected in the DOM/platform JSON, which
// signals a partially-generated ProductGroup. Report the exact missing per-variant field so the fix
// is mechanical.
export class BuyableVariantResolutionAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/agentic-commerce/buyable-variant-resolution',
    category: 'agentic-commerce',
    title: "Buyable Variant Resolution",
    failureTitle: "Buyable Variant Resolution",
    description: "Detects PDPs that present variant selectors to humans but expose no per-variant purchasable identifier with its own price and availability — the single most common reason an agent cannot convert 'the blue one in medium' into a line item.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "Falsifiable claim: the ACP Feed API models catalogue variant-first — a Product REQUIRES id plus a variants[] array, and each Variant REQUIRES its own id, with its own price and availability. The OpenAI feed spec mirrors this with group_id, listing_has_variations, variant_dict, size and color. Google's ProductGroup markup requires productGroupID and requires each variant Product to carry sku-or-gtin plus its own offers. Therefore a PDP that shows a size/colour selector but publishes exactly one Offer — or an AggregateOffer with only lowPrice/highPrice — gives the agent no addressable purchasable unit; the row is dropped at feed validation, or the checkout session returns a message with code `invalid` or `out_of_stock`. Disproof condition: an agent successfully completing a variant purchase from a PDP with no per-variant identifier anywhere in the response.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/agentic-commerce/buyable-variant-resolution.md',
      tags: ['proposed', 'agentic-commerce'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/agentic-commerce/buyable-variant-resolution.md',
      'TODO stub',
    );
  }
}
