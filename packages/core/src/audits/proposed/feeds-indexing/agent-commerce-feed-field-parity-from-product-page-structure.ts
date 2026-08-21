import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Agent-commerce feed-field parity from product-page structured data".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade A → scored tier. Implementation difficulty: multi-page.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/feeds-indexing/agent-commerce-feed-field-parity-from-product-page-structure.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Detect PDPs (JSON-LD @type Product/ProductGroup, or og:type=product) from the sitemap sample;
// take up to 20. Per page assert: (1) identity — sku or productID or mpn present, non-empty, <=100
// chars, and stable across two fetches; gtin/gtin13/gtin14 present as 8-14 digits with no dashes or
// spaces if claimed. (2) brand.name present, <=70 chars. (3) description present, <=5000 chars, and
// contains no HTML tags after unescaping (OpenAI requires plain text). (4) image absolute HTTPS,
// extension/Content-Type in {image/jpeg,image/png} — HEAD it; flag WebP/AVIF-only as an OpenAI-spec
// risk. (5) offers.price parses as a positive decimal and offers.priceCurrency is a valid ISO 4217
// code (validate against a bundled list, not a regex). (6) offers.availability is the full
// https://schema.org/InStock-style URL, not a bare token like 'InStock' or 'in stock' — the single
// most common defect; map to the OpenAI enum {in_stock,out_of_stock,pre_order,backorder} and FAIL
// on unmappable values. (7) offers.itemCondition is one of the three schema.org condition URLs. (8)
// offers.seller.name present (maps to seller_name). (9) a country signal exists:
// offers.eligibleRegion, areaServed, availableAtOrFrom.address.addressCountry, or
// shippingDetails.shippingDestination.addressCountry, resolvable to ISO 3166-1 alpha-2. (10)
// variants: if the page exposes sibling variants, isVariantOf/inProductGroupWithID must be present
// and stable (maps to item_group_id, required for BR/FR/DE/JP/UK/US). (11) sale price sanity: when
// both price and a strikethrough/list price exist in markup, assert sale <= list. (12) PRICE PARITY
// — extract currency-formatted numerals from the raw HTML near the offer container and assert the
// JSON-LD price appears among them; FAIL on mismatch and report both values. (13) offers.url, when
// present, must equal rel=canonical. Score = per-field pass rate across the sample, with the
// OpenAI-only fields (brand, seller, target country, plain-text description, JPEG/PNG image)
// reported as a distinct 'agent-commerce gap' sub-score so users can see what Google-oriented
// tooling missed.
export class AgentCommerceFeedFieldParityFromProductPageStructureAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/feeds-indexing/agent-commerce-feed-field-parity-from-product-page-structure',
    category: 'feeds-indexing',
    title: "Agent-commerce feed-field parity from product-page structured data",
    failureTitle: "Agent-commerce feed-field parity from product-page structured data",
    description: "Audits sampled product pages against the union of OpenAI's Product Feed Spec required fields and Google Merchant Center's required attributes, using the PDP's JSON-LD as the auditable proxy for feed eligibility — including the fields that Google's rich-result validator does not require and therefore no SEO tool checks.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "Google's automatic item updates repairs feed/page discrepancies 'using the structured data markup the crawlers find on your website', requires price+priceCurrency, availability as valid ItemAvailability, and itemCondition mapped to New/Refurbished/UsedCondition, and states that when extractors cannot determine those, 'your products will be subject to item-level disapprovals'. Merchant Center separately requires that feed availability 'must match the availability from your landing page' and that price 'must match landing page and checkout prices'. OpenAI's Product Feed Spec requires a strictly larger per-item set than Google's rich-result minimum: stable item_id (<=100 chars), brand (<=70), seller_name, target_countries as ISO 3166-1 alpha-2, plain-text description <=5000, availability from a fixed lowercase enum, price with ISO 4217 currency, and is_eligible_search/is_eligible_checkout. Falsifiable claim: a PDP missing brand, seller, itemCondition-as-URL, a stable SKU, or a country/region signal will pass every Google rich-result test yet cannot be reconciled by automatic item updates and provides no page-side evidence for the fields OpenAI's feed requires — so feed rejections and item-level disapprovals are silent and unattributable. A second, sharply testable claim: when the JSON-LD offers.price disagrees with the price rendered in the page HTML, automatic item updates will overwrite the feed with one of the two values and an agent reading the page will quote the other.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/feeds-indexing/agent-commerce-feed-field-parity-from-product-page-structure.md',
      tags: ['proposed', 'feeds-indexing'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/feeds-indexing/agent-commerce-feed-field-parity-from-product-page-structure.md',
      'TODO stub',
    );
  }
}
