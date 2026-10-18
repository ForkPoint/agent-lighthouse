---
audit: agentic-commerce/checkout-offer-field-mapping
category: agentic-commerce
source_file: packages/core/src/audits/agentic-commerce/checkout-offer-field-mapping.ts
slug: checkout-offer-field-mapping
evidence_grade: A
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-22"
reviewed: 2026-08-20
graduated: 2026-08-22
sources:
  - openai-feed-spec-confirm
  - google-merchant-listing
  - openai-commerce-index
  - openai-getstarted
  - google-product-variants
---

# Checkout-Eligible Offer Field Mapping

> Shipped in v2. Evidence grade **A** · scored tier · partial overlap · implementation: `multi-page`

## What it checks

Audits one product page against the required fields of the OpenAI product feed spec that a product page can supply, plus the format rules the spec states for those fields. The merchant learns why a row would be rejected or misread before uploading a feed.

The page judged is the first scanned product page that carries `Product` markup. Other product pages are not judged here. `machine-discovery/agent-commerce-feed-parity` reports field coverage across the sampled product pages instead.

The `url` field must be an absolute HTTP or HTTPS URL. It is taken from the `Product` `url`, or from the page address when the markup has none. It is not compared with the page's canonical link. The spec asks for the product page with the variant selected, so a variant URL such as `?variant=123` whose canonical names the parent product is a valid row.

## Claimed mechanism (falsifiable)

The OpenAI format requires nine fields on every row: item_id, title, description, url, brand, seller_name, image_url, availability and price. Price is a decimal amount with an uppercase ISO 4217 code. Availability is one of five enum values. An omitted, empty or unrecognised availability rejects the row. A sale price that is not strictly below the regular price is not used. A GTIN, when supplied, must be 8, 12, 13 or 14 digits with a valid check digit. Validation is row-by-row, so one product can be rejected while the rest of the feed processes. A product page that cannot supply these values forces the merchant to hand-author or scrape them, which is where price mismatch enters. Disproof condition: rows with no availability, or with a price that has no ISO 4217 currency, being accepted into discovery.

## Evidence

- **[OpenAI Product Feed Specification](https://developers.openai.com/commerce/specs/feed/)** — OpenAI (vendor-doc, URL verified 2026-10-17)
  - The Stable schema, OpenAI format, lists nine required fields: item_id, title, description, url, brand, seller_name, image_url, availability and price.
  - Titles and descriptions: "aim for at most 150 and 5,000 characters, respectively". The Google-compatible profile states the same numbers as limits.
  - item_id and brand carry no character limit.
  - Availability is in_stock, out_of_stock, pre_order, backorder or unknown. "Omitted, empty, or unrecognized values reject the row."
  - Price is written as a decimal amount, a space and an uppercase three-letter ISO 4217 code.
  - sale_price must be "strictly less than price". A higher or equal sale price "is not used".
  - gtin and mpn are optional in the OpenAI format. A supplied gtin must be exactly 8, 12, 13 or 14 digits with a valid check digit.
  - "gtin or mpn unless identifier_exists=no" and "availability_date required for preorder and backorder" apply only to the Google-compatible profile. The OpenAI format says availability dates do not schedule stock changes.
  - target_countries is optional and needs market setup. Standard uploads target the US.
  - seller_privacy_policy and seller_tos are conditionally required for checkout.
  - URLs are absolute HTTP or HTTPS; HTTPS is preferred: "Use UTF-8 text and absolute HTTP or HTTPS URLs; prefer HTTPS."
  - The `url` field reads: "Product detail page for the item, with the variant selected when possible. Keep it stable." Its example carries variant parameters: `https://example.com/products/trail?color=black&size=10`. Each variant row "carries its own price, availability, URL, and images." No rule ties `url` to the page's canonical link (verified 2026-10-17).
  - "A malformed row can be rejected while valid rows continue processing."
- **[Merchant listing (Product) structured data](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing)** — Google (vendor-doc, URL verified 2026-08-20)
  - Required: name, image, offers; within offers price (or priceSpecification.price) and priceCurrency (3-letter ISO 4217). Recommended: gtin|gtin8|gtin12|gtin13|gtin14, mpn, sku, availability, priceValidUntil (ISO 8601), itemCondition, url, validFrom/validThrough, hasMerchantReturnPolicy, shippingDetails (OfferShippingDetails), aggregateRating, review, description, brand. Policies are recommended at Organization level.
- **[OpenAI Agentic Commerce documentation index](https://developers.openai.com/commerce/)** — OpenAI (vendor-doc, URL verified 2026-08-20)
  - Four specs: Product Feed (specs/spec.md), Agentic Checkout (specs/checkout.md), Delegated Payment (specs/payment.md), Feeds API (specs/api/feeds.md). Feed delivery via API (products, promotions endpoints) or File Upload/SFTP. No public feed-URL convention and no discovery file is defined. Feeds let ChatGPT 'accurately index and display your products with up-to-date price and availability'.
- **[OpenAI Commerce: Get Started (feed onboarding)](https://developers.openai.com/commerce/guides/get-started)** — OpenAI (vendor-doc, URL verified 2026-08-20)
  - Product feed onboarding in ChatGPT is currently limited to approved partners via an application form. Confirms feed ingestion is push/upload-based (file upload or API), not a merchant-hosted public URL that OpenAI discovers — reinforcing that site-side audit checks must test the DATA a feed would be built from rather than the feed transport.

## Example failure

A 900-SKU store has clean Product markup but no sku, mpn or productID anywhere, and prices rendered as the string '$1,299.00' inside offers.price. No row has an item_id or a decimal price with its own currency, so the catalogue cannot be derived from the pages. The merchant finds out only when Upload History reports the rejected rows.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

Grade A holds against the spec as re-read on 2026-10-17. OpenAI documents the required fields and the row-level rejection of a missing or unrecognised availability. Every rule this audit applies is stated on that page.

## Implementation deviations

- The overlap with `machine-discovery/agent-commerce-feed-parity` is
  deliberate. This audit judges one product page's offer graph in depth. That
  audit reports per-field pass rates across sitemap-sampled product pages.
- Products come from the shared `resolveProducts` in
  `packages/core/src/product-schema.ts`. Each `ProductGroup` variant is read
  with the group's shared properties beneath its own, as Google's product
  variant documentation describes. A `ProductGroup` with no variants is read
  as the product.
- One GTIN check-digit function covers GTIN-8, 12, 13 and 14.
- An `image` list is read by its first entry.
- Re-read 2026-10-17. The `url`-equals-canonical failure was removed. The
  spec states no canonical rule and asks for the variant-selected page. The
  spec's "publicly accessible" rule is not checked: it would need a fetch of
  a URL the scan may not have read.
- `target_countries` is not evaluated. It is optional in the current spec
  and has no schema.org source on the page.
- `seller_name` is required but not evaluated. A product page has no
  dependable source for it.
- Title over 150 and description over 5,000 characters still fail. The
  OpenAI format frames both as "aim for at most"; the Google-compatible
  profile states them as limits. The existing severity is kept.
- `url` and `image_url` pass as absolute HTTP or HTTPS. The spec prefers
  HTTPS but accepts HTTP.
- Re-read 2026-10-17. Rules removed because the current spec no longer states
  them for the OpenAI format: the 100-character item_id cap, the 70-character
  brand cap, gtin-or-mpn unless identifier_exists=no, and a date for a
  pre-order or backorder.
- Sale-versus-list reads `priceSpecification` with a `ListPrice` `priceType`,
  then falls back to `highPrice` on the offer.
- Field presence comes from the shared `extractProductFieldVerification`.
  This audit adds the length, format and mappability assertions.

## Deferred

- `image_url` is not fetched. Only scheme and extension are checked, so a
  URL that 404s reads as valid.
