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

Audits each PDP against the exact required-and-conditional field set of the OpenAI product feed spec, including its character caps and its conditional triggers, so the merchant learns which rows will be rejected before uploading a feed.

## Claimed mechanism (falsifiable)

Falsifiable claim. The OpenAI feed spec enumerates a closed set of required fields: item_id (max 100), title (max 150), description (max 5000), brand (max 70), url, image_url, price with an ISO 4217 currency, and availability from a five-value enum, and target_countries. Three conditional triggers reject rows on top of that. gtin or mpn is required unless identifier_exists=no. availability_date is required when availability is pre_order or backorder. seller_privacy_policy and seller_tos are required when is_eligible_checkout=true. Validation is row-by-row, so individual products fail silently while the feed as a whole succeeds. A PDP that cannot supply these values forces the merchant to hand-author or scrape them, which is precisely where price mismatch enters. Disproof condition: rows lacking gtin/mpn and identifier_exists being accepted as checkout-eligible.

## Evidence

- **[OpenAI Product Feed Specification](https://developers.openai.com/commerce/specs/feed/)** — OpenAI (vendor-doc, URL verified 2026-08-20)
  - Required feed fields: item_id (<=100 chars), title (<=150), description (<=5000), brand (<=70), url, image_url, price (number + ISO 4217), availability enum {in_stock,out_of_stock,pre_order,backorder,unknown}, is_eligible_search, is_eligible_checkout, target_countries. CONDITIONAL hard requirements: availability_date required if availability is pre_order/backorder; seller_privacy_policy and seller_tos required if is_eligible_checkout=true; gtin or mpn required unless identifier_exists=no. Recommended: group_id, listing_has_variations, variant_dict, size, size_system, color, item_group_title, review_count, star_rating, q_and_a, reviews, age_restriction. Optional fulfillment field `shipping` uses format country:region:service_class:price:handling_days:transit_days. Returns fields: accepts_returns, return_deadline_in_days (positive int), accepts_exchanges, return_policy (URL, HTTPS preferred). sale_price must be less than price. Formats: .txt/.tsv/.csv (+.gz), UTF-8, lowercase underscore header row. Parser auto-selects between OpenAI schema and a Google-compatible profile.
- **[Merchant listing (Product) structured data](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing)** — Google (vendor-doc, URL verified 2026-08-20)
  - Required: name, image, offers; within offers price (or priceSpecification.price) and priceCurrency (3-letter ISO 4217). Recommended: gtin|gtin8|gtin12|gtin13|gtin14, mpn, sku, availability, priceValidUntil (ISO 8601), itemCondition, url, validFrom/validThrough, hasMerchantReturnPolicy, shippingDetails (OfferShippingDetails), aggregateRating, review, description, brand. Policies are recommended at Organization level.
- **[OpenAI Agentic Commerce documentation index](https://developers.openai.com/commerce/)** — OpenAI (vendor-doc, URL verified 2026-08-20)
  - Four specs: Product Feed (specs/spec.md), Agentic Checkout (specs/checkout.md), Delegated Payment (specs/payment.md), Feeds API (specs/api/feeds.md). Feed delivery via API (products, promotions endpoints) or File Upload/SFTP. No public feed-URL convention and no discovery file is defined. Feeds let ChatGPT 'accurately index and display your products with up-to-date price and availability'.
- **[OpenAI Commerce: Get Started (feed onboarding)](https://developers.openai.com/commerce/guides/get-started)** — OpenAI (vendor-doc, URL verified 2026-08-20)
  - Product feed onboarding in ChatGPT is currently limited to approved partners via an application form. Confirms feed ingestion is push/upload-based (file upload or API), not a merchant-hosted public URL that OpenAI discovers — reinforcing that site-side audit checks must test the DATA a feed would be built from rather than the feed transport.

## Example failure

A 900-SKU store has clean Product markup but no gtin, mpn or sku anywhere, and prices rendered as the string '$1,299.00' inside offers.price. Every row fails the identifier requirement and the numeric-price requirement, so the entire catalogue is ingested as search-eligible-only and never becomes checkout-eligible — a failure mode the merchant currently discovers only after applying for the partner programme.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

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
- Self-canonical is compared only when the `Product` declares its own `url`.
- `target_countries` is not evaluated. It has no schema.org source on the
  page.
- Sale-versus-list reads `priceSpecification` with a `ListPrice` `priceType`,
  then falls back to `highPrice` on the offer.
- Field presence comes from the shared `extractProductFieldVerification`.
  This audit adds the length, format and mappability assertions.

## Deferred

- `image_url` is not fetched. Only scheme and extension are checked, so a
  URL that 404s reads as valid.
- Only the first product page with `Product` markup is judged, not every
  product page in the scan.
- `identifier_exists=no` is named as the escape hatch but cannot be detected
  from the page.
