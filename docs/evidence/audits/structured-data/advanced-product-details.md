---
audit: structured-data/advanced-product-details
category: structured-data
source_file: packages/core/src/audits/structured-data/advanced-product-details.ts
slug: advanced-product-details
evidence_grade: A
disposition: "keep — fix required; absorbs the Product half of service-product-schema (3.8) as of 2026-08-22"
reviewed: 2026-08-22
sources:
  - google-merchant-listing
  - google-auto-item-updates
  - google-merchant-structured-data
  - openai-feed-spec-confirm
  - google-product-snippet
  - google-ai-features-trust
  - google-product-variants
---

# advanced-product-details (`3.22`, Product half of `3.8`)

> structured-data · source `advanced-product-details.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**, now also the home of 3.8's Product-shape checks

## What it checks

AI agents use a product's name, brand, category, and availability status to filter search results and answer availability queries. A Product without a `name` cannot be matched to a catalog entry at all; missing brand, category or availability makes it less likely to surface in filtered AI recommendations.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** Google's product data extractors read `brand`, `category` and the Offer's `availability` from a product page's schema.org markup. `availability` is pulled into Merchant Center and used to correct the item's stock state. A page that omits it leaves the stock state to be inferred rather than read.

**Grade: A** — all three measured properties appear in Google's documented merchant-listing property tables, and `availability` specifically is named in the automatic-item-updates extraction path, which is documented consumer behavior rather than convention.

**Evidence:**

- Merchant listing structured data lists `brand.name`, `category` ("Specifies the product's categories", `Text` or `CategoryCode`) and `offers.availability` among the properties Google reads; required are only Product `name`, `image`, `offers` and the Offer's price/priceCurrency pair — https://developers.google.com/search/docs/appearance/structured-data/merchant-listing (verified 2026-08-21)
- Automatic item updates: "We automatically read the structured data markup on your website using our advanced data extractors and directly pull product data from your HTML into Merchant Center". The covered attributes are price, sale price, `availability` (schema.org `ItemAvailability`) and `itemCondition` — https://support.google.com/merchants/answer/3246284 (verified 2026-08-21)
- "Structured data lets Google and other web platforms automatically read your site and directly pull product data from your HTML"; "Structured data must match the values that are shown to the customer" — https://support.google.com/merchants/answer/6069143 (verified 2026-08-21)
- Agent-side shopping indexes model the same fields: OpenAI's product feed spec makes `availability` (`in_stock`/`out_of_stock`/`pre_order`/`backorder`/`unknown`) and `brand` required fields — https://developers.openai.com/commerce/specs/feed (verified 2026-08-21)
- Product snippets list `brand` among recommended properties — https://developers.google.com/search/docs/appearance/structured-data/product-snippet (verified 2026-08-21)

**Counter-evidence:** The three measured properties are not equally proven. `availability` has an explicit documented extraction-and-use path. `brand` and `category` are only listed as recommended, and no vendor documents a feature that `category` powers — Google's own Product Category codes are a Merchant Center feed attribute. Making `category` pass-blocking therefore exceeds the evidence. (This corrects the code-review note above, which said `category` is absent from Google's Product documentation. It is present, as a recommended property.) schema.org places `availability` on `Offer` rather than on `Product`, so crediting `Product.availability` rewards invalid markup (https://developers.google.com/search/docs/appearance/structured-data/merchant-listing). And Google states of its AI features: "There's also no special schema.org structured data that you need to add" (https://developers.google.com/search/docs/appearance/ai-features, verified 2026-08-21), so the "filtered AI recommendations" framing has no documented consumer; the proven consumer is Google's shopping pipeline.

## Implementation deviations

- This audit holds the Product half of the former `service-product-schema`
  check. The Service half is [`structured-data/service-schema`](./service-schema.md).
- `name` is required. Google's merchant-listing table marks it required, so a
  Product without it fails whatever else is present, and `name` is named
  first. Brand, category and availability are recommended: one or two missing
  warns, all three missing fails.
- `description` is not required. Neither schema.org nor Google requires it.
- `brand` or `manufacturer` satisfies the brand check. An `offers` or
  `provider` node does not.
- Products come from the shared `resolveProducts` in
  `packages/core/src/product-schema.ts`. Each `ProductGroup` variant is read
  with the group's shared properties beneath its own. A `ProductGroup` with no
  variants is read as the product.

## Deferred

- The audit judges `products[0]` across all pages. Per-product-page selection
  with an N/M ratio is not implemented.
- `category` is still pass-blocking, though the evidence rates it the weakest
  of the three.
- `Product.availability` is still credited, though schema.org puts
  availability on `Offer`. An `offers` given as an `@id` reference reads as no
  availability.
