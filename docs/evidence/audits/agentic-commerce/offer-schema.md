---
audit: agentic-commerce/offer-schema
category: agentic-commerce
source_file: packages/core/src/audits/agentic-commerce/offer-schema.ts
slug: offer-schema
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - google-merchant-listing
  - google-auto-item-updates
  - google-merchant-structured-data
  - google-merchant-spec
  - google-product-snippet
  - schema-aggregateoffer
  - google-ai-features-trust
  - openai-commerce-index
  - openai-feed-spec-confirm
---

# offer-schema (`3.14`)

> agentic-commerce · source `offer-schema.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

AI agents use Offer schema to answer pricing queries with exact numbers. Without price and priceCurrency in structured data, agents must scrape and guess pricing from page text, which often produces inaccurate or outdated results in AI-generated comparisons.

## Code review findings (2026-08-20, 11-agent pass)

Price and currency in structured data is one of the few schema signals with clear agentic-commerce value, but a short-circuit bug makes the audit judge a stray hoisted Offer node instead of the product's real offer, and it rejects the schema.org-correct AggregateOffer lowPrice/highPrice form used by every multi-variant product.

**Required fix:** Remove the short-circuit: evaluate whether ANY Offer reachable from the page's primary Product satisfies price+currency, rather than testing only the first hoisted Offer node. Accept `AggregateOffer` with `lowPrice`/`highPrice` as satisfying the price requirement. Add an explicit `/pricing|/plans|/preise|/tarifs` URL fallback so SaaS pricing pages are actually assessed, matching the audit's title.

**False-positive risks:**
- `if (hasOfferSchema) { const first = schemas.find(isOffer); return first['price'] !== undefined && !!first['priceCurrency']; }` short-circuits and never evaluates `hasOfferProp`. Because `flattenJsonLd` hoists nested Offers, `schemas.find(isOffer)` returns whichever Offer appears first in DFS order — commonly a related-products carousel Offer, a `seller`-only Offer stub, or a ProductGroup variant Offer. If that stray offer lacks price/priceCurrency the page is failed even though the primary Product's `offers` block is complete. Concrete, high-frequency false fail on Shopify ProductGroup/hasVariant markup.
- `offerObj['price'] !== undefined && offerObj['priceCurrency']` rejects `AggregateOffer` with `lowPrice`/`highPrice`/`offerCount` and no `price` — the schema.org-canonical form for a variant price range. Multi-variant products marked up correctly are failed.
- The applicability gate `p.pageType === 'product'` inherits `detectPageType`'s loose heuristics: any page with an `[class*="add-to-cart"]` element and a `.price` element is typed 'product' (parser.ts:541-551), so category pages and homepages with product carousels are mis-typed and then failed for lacking Offer schema.
- The audit is titled 'Offer schema on pricing pages' and the inline comment claims the product-type gate 'already covers SaaS pricing pages' — but `detectPageType` has no `/pricing` or `/plans` rule and SaaS pricing pages have no add-to-cart markup, so they are typed 'content' and the audit returns `na`. The audit does not do what its own title says.
- `price: 0` is accepted (`!== undefined`), so a free-tier Offer passes, while `price: "0.00"` on a broken template also passes — no sanity check on the value.

**Test gaps:**
- No test where a stray/nested Offer precedes the product's real offers (the short-circuit bug)
- No test for `AggregateOffer` with `lowPrice`/`highPrice`
- No test for `ProductGroup` + `hasVariant[].offers`
- No test for a SaaS `/pricing` page (which the audit claims to cover but returns `na` on)
- No test for a category page mis-typed as 'product' by detectPageType

**Overlaps with:** `3.24`, `3.22`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** Google's product data extractors parse `price` and `priceCurrency` out of the schema.org `Offer` in a product page's markup. They use those exact values for merchant listing eligibility, and for Merchant Center automatic item updates. A page without them cannot supply a machine-read price to that pipeline.

**Grade: A** — `offers.price` and `offers.priceCurrency` are the only *required* Offer properties in Google's merchant listing structured-data spec, and Google separately documents crawling that markup off the page HTML to correct price data.

**Evidence:**
- Google merchant listing structured data — required properties are Product `name`, `image`, `offers`, and on the Offer `price` (or `priceSpecification.price`) plus `priceCurrency` (or `priceSpecification.priceCurrency`); `availability`, `priceValidUntil`, `hasMerchantReturnPolicy` are recommended — https://developers.google.com/search/docs/appearance/structured-data/merchant-listing (verified 2026-08-21)
- Automatic item updates: "We automatically read the structured data markup on your website using our advanced data extractors and directly pull product data from your HTML into Merchant Center". It names `price` and `priceCurrency` directly on the Offer, or via `priceSpecification` — https://support.google.com/merchants/answer/3246284 (verified 2026-08-21)
- "Structured data lets Google and other web platforms automatically read your site and directly pull product data from your HTML"; markup also powers the website-crawl feed input method — https://support.google.com/merchants/answer/6069143 (verified 2026-08-21)
- Merchant Center price attribute: "Accurately submit the product's price and currency, and match with the price from your landing page, structured data, and at checkout" — https://support.google.com/merchants/answer/7052112 (verified 2026-08-21)
- Product snippets accept `offers` as either `Offer` or `AggregateOffer` — https://developers.google.com/search/docs/appearance/structured-data/product-snippet (verified 2026-08-21)
- schema.org defines `AggregateOffer` with `lowPrice`/`highPrice`/`offerCount` for the multi-offer case; no `price` is mandated — https://schema.org/AggregateOffer (verified 2026-08-21)

**Counter-evidence:** No LLM-assistant vendor documents reading on-page Offer markup. Google states of its AI features: "You don't need to create new machine readable files, AI text files, or markup to appear in these features. There's also no special schema.org structured data that you need to add" (https://developers.google.com/search/docs/appearance/ai-features, verified 2026-08-21). OpenAI's commerce documentation routes product price and availability into ChatGPT through a product feed: "Provide a structured product feed so ChatGPT accurately indexes and displays your products with up-to-date price and availability". It never mentions schema.org page markup (https://developers.openai.com/commerce/ and https://developers.openai.com/commerce/specs/feed, verified 2026-08-21). The proven consumer path is Google's search/shopping pipeline, not a chat agent parsing the page.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
- 2026-08-21 — evidence graded **A** (documented Google extractor behavior for Offer price/priceCurrency).
