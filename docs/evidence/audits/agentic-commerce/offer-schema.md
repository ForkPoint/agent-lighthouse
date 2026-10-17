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
  - google-product-variants
---

# offer-schema (`3.14`)

> agentic-commerce · source `offer-schema.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

AI agents use Offer schema to answer pricing queries with exact numbers. Without price and priceCurrency in structured data, agents must scrape and guess pricing from page text, which often produces inaccurate or outdated results in AI-generated comparisons.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** Google's product data extractors parse `price` and `priceCurrency` out of the schema.org `Offer` in a product page's markup. They use those exact values for merchant listing eligibility, and for Merchant Center automatic item updates. A page without them cannot supply a machine-read price to that pipeline.

**Grade: A** — `offers.price` and `offers.priceCurrency` are the only _required_ Offer properties in Google's merchant listing structured-data spec, and Google separately documents crawling that markup off the page HTML to correct price data.

**Evidence:**

- Google merchant listing structured data — required properties are Product `name`, `image`, `offers`, and on the Offer `price` (or `priceSpecification.price`) plus `priceCurrency` (or `priceSpecification.priceCurrency`); `availability`, `priceValidUntil`, `hasMerchantReturnPolicy` are recommended — https://developers.google.com/search/docs/appearance/structured-data/merchant-listing (verified 2026-08-21)
- Automatic item updates: "We automatically read the structured data markup on your website using our advanced data extractors and directly pull product data from your HTML into Merchant Center". It names `price` and `priceCurrency` directly on the Offer, or via `priceSpecification` — https://support.google.com/merchants/answer/3246284 (verified 2026-08-21)
- "Structured data lets Google and other web platforms automatically read your site and directly pull product data from your HTML"; markup also powers the website-crawl feed input method — https://support.google.com/merchants/answer/6069143 (verified 2026-08-21)
- Merchant Center price attribute: "Accurately submit the product's price and currency, and match with the price from your landing page, structured data, and at checkout" — https://support.google.com/merchants/answer/7052112 (verified 2026-08-21)
- Product snippets accept `offers` as either `Offer` or `AggregateOffer` — https://developers.google.com/search/docs/appearance/structured-data/product-snippet (verified 2026-08-21)
- schema.org defines `AggregateOffer` with `lowPrice`/`highPrice`/`offerCount` for the multi-offer case; no `price` is mandated — https://schema.org/AggregateOffer (verified 2026-08-21)

**Counter-evidence:** No LLM-assistant vendor documents reading on-page Offer markup. Google states of its AI features: "You don't need to create new machine readable files, AI text files, or markup to appear in these features. There's also no special schema.org structured data that you need to add" (https://developers.google.com/search/docs/appearance/ai-features, verified 2026-08-21). OpenAI's commerce documentation routes product price and availability into ChatGPT through a product feed: "Provide a structured product feed so ChatGPT accurately indexes and displays your products with up-to-date price and availability". It never mentions schema.org page markup (https://developers.openai.com/commerce/ and https://developers.openai.com/commerce/specs/feed, verified 2026-08-21). The proven consumer path is Google's search/shopping pipeline, not a chat agent parsing the page.

## Implementation deviations

- Products come from the shared `resolveProducts` in
  `packages/core/src/product-schema.ts`. Each `ProductGroup` variant is read
  with the group's shared properties beneath its own. A `ProductGroup` with no
  variants is read as the product.
- A page passes when any offer reachable from its products is priced: an
  `Offer` with `price`, or an `AggregateOffer` with `lowPrice`, each with
  `priceCurrency`. An `Offer` whose `itemOffered` is a product also counts.
- A stray `Offer` attached to nothing does not pass a page with product
  markup. A page with no product markup is judged on its standalone `Offer`
  nodes.

## Deferred

- A `/pricing`, `/plans`, `/preise` or `/tarifs` URL fallback. SaaS pricing
  pages are assessed only when the page is typed `product`.
