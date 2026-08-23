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
---


# Checkout-Eligible Offer Field Mapping

> Shipped in v2. Evidence grade **A** · scored tier · partial overlap · implementation: `multi-page`

## What it checks

Audits each PDP against the exact required-and-conditional field set of the OpenAI product feed spec, including its character caps and its conditional triggers, so the merchant learns which rows will be rejected before uploading a feed.

## Claimed mechanism (falsifiable)

Falsifiable claim: the OpenAI feed spec enumerates a closed set of required fields (item_id <=100, title <=150, description <=5000, brand <=70, url, image_url, price with ISO 4217 currency, availability from a 5-value enum, target_countries) plus three conditional triggers that reject rows: gtin-or-mpn required unless identifier_exists=no; availability_date required when availability is pre_order or backorder; seller_privacy_policy and seller_tos required when is_eligible_checkout=true. Validation is row-by-row, so individual products fail silently while the feed as a whole succeeds. A PDP that cannot supply these values forces the merchant to hand-author or scrape them, which is precisely where price mismatch enters. Disproof condition: rows lacking gtin/mpn and identifier_exists being accepted as checkout-eligible.

## Evidence

- **[OpenAI Product Feed Specification](https://developers.openai.com/commerce/specs/feed/)** — OpenAI (vendor-doc, URL verified 2026-08-20)
  - Required feed fields: item_id (<=100 chars), title (<=150), description (<=5000), brand (<=70), url, image_url, price (number + ISO 4217), availability enum {in_stock,out_of_stock,pre_order,backorder,unknown}, is_eligible_search, is_eligible_checkout, target_countries. CONDITIONAL hard requirements: availability_date required if availability is pre_order/backorder; seller_privacy_policy AND seller_tos required if is_eligible_checkout=true; gtin OR mpn required unless identifier_exists=no. Recommended: group_id, listing_has_variations, variant_dict, size, size_system, color, item_group_title, review_count, star_rating, q_and_a, reviews, age_restriction. Optional fulfillment field `shipping` uses format country:region:service_class:price:handling_days:transit_days. Returns fields: accepts_returns, return_deadline_in_days (positive int), accepts_exchanges, return_policy (URL, HTTPS preferred). sale_price must be less than price. Formats: .txt/.tsv/.csv (+.gz), UTF-8, lowercase underscore header row. Parser auto-selects between OpenAI schema and a Google-compatible profile.
- **[Merchant listing (Product) structured data](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing)** — Google (vendor-doc, URL verified 2026-08-20)
  - Required: name, image, offers; within offers price (or priceSpecification.price) and priceCurrency (3-letter ISO 4217). Recommended: gtin|gtin8|gtin12|gtin13|gtin14, mpn, sku, availability, priceValidUntil (ISO 8601), itemCondition, url, validFrom/validThrough, hasMerchantReturnPolicy, shippingDetails (OfferShippingDetails), aggregateRating, review, description, brand. Policies are recommended at Organization level.
- **[OpenAI Agentic Commerce documentation index](https://developers.openai.com/commerce/)** — OpenAI (vendor-doc, URL verified 2026-08-20)
  - Four specs: Product Feed (specs/spec.md), Agentic Checkout (specs/checkout.md), Delegated Payment (specs/payment.md), Feeds API (specs/api/feeds.md). Feed delivery via API (products, promotions endpoints) or File Upload/SFTP. No public feed-URL convention and no discovery file is defined. Feeds let ChatGPT 'accurately index and display your products with up-to-date price and availability'.
- **[OpenAI Commerce: Get Started (feed onboarding)](https://developers.openai.com/commerce/guides/get-started)** — OpenAI (vendor-doc, URL verified 2026-08-20)
  - Product feed onboarding in ChatGPT is currently limited to approved partners via an application form. Confirms feed ingestion is push/upload-based (file upload or API), not a merchant-hosted public URL that OpenAI discovers — reinforcing that site-side audit checks must test the DATA a feed would be built from rather than the feed transport.

## Competitor coverage

Generic schema validators check that a Product node is well-formed; Merchant Center checks Google's own feed. The overlap is real and I am not hiding it. The differentiator is the OpenAI-specific constraint set that no other tool encodes: the 150/5000/70/100 character caps, the availability enum mapping from schema.org URLs to OpenAI's 5 tokens, the pre_order-implies-availability_date rule, the sale_price<price rule, and the checkout-eligibility policy trigger. Lighthouse ships nothing here.

## Implementation sketch

For each sampled PDP, extract the Product/Offer graph and map to feed columns, then assert: item_id source exists (sku, mpn, or a stable URL-derived id) and <=100 chars; name present and <=150; description present and <=5000 (flag both empty and truncation risk); brand.name present and <=70; url is absolute HTTPS and self-canonical; image is an absolute HTTPS JPEG/PNG that returns 200 with an image/* Content-Type; offers.price is a single resolvable number (fail on AggregateOffer, fail on price-as-string-with-symbol) and offers.priceCurrency is a valid 3-letter ISO 4217 code; offers.availability maps cleanly onto {in_stock,out_of_stock,pre_order,backorder} — flag unmapped schema values such as LimitedAvailability or SoldOut as ambiguous; at least one of gtin/gtin8/gtin12/gtin13/gtin14/mpn present, and when present validate GTIN check-digit and length (8/12/13/14). Conditional assertions: if availability maps to pre_order or backorder, require an availabilityStarts/availability_date-equivalent date; if a sale price is present (offers with both listPrice/highPrice semantics or two prices in markup), assert sale < regular. Emit a per-PDP row-rejection verdict plus the synthesised feed row.

## Example failure

A 900-SKU store has clean Product markup but no gtin, mpn or sku anywhere, and prices rendered as the string '$1,299.00' inside offers.price. Every row fails the identifier requirement and the numeric-price requirement, so the entire catalogue is ingested as search-eligible-only and never becomes checkout-eligible — a failure mode the merchant currently discovers only after applying for the partner programme.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Relationship to `machine-discovery/agent-commerce-feed-parity`

The overlap is deliberate. This audit judges the offer graph of the scanned
product page in depth, including the conditional feed triggers
(`availability_date`, `identifier_exists`, checkout-eligibility policy links).
`machine-discovery/agent-commerce-feed-parity` samples product pages
from the sitemap and reports a per-field pass rate plus a separate
agent-commerce gap for the fields Google's rich-result validator never asks
for. A site can pass one and fail the other: a single bad template shows up
across the sample there while the scanned PDP passes here.

## Implementation deviations

- **The plan sheet's GTIN example was wrong.** It names `gtin13: '1234567890128'`
  as a *wrong* check digit; 8 is in fact the correct check digit for that body.
  The test pins both directions instead: `1234567890128` is accepted and
  `1234567890123` is rejected with the digit it should have ended in. The check
  digit is computed the same way for GTIN-8/12/13/14 — alternating 3/1 weights
  from the right — so one function covers all four lengths.
- **`image_url` is not fetched.** Extension and scheme are checked; a HEAD
  request per PDP to confirm `200` and an `image/*` content type is deferred, so
  a URL that looks right but 404s is reported as valid here.
- **Self-canonical is compared only when the `Product` declares its own `url`.**
  When it does not, the page URL is used and there is nothing to disagree with.
- **`target_countries` is not evaluated.** It has no schema.org source on the
  PDP, so requiring it would fail every page for a reason the page cannot fix.
- **Sale-versus-list** is read from `priceSpecification` with a `ListPrice`
  `priceType`, falling back to `highPrice` on the offer.
- Presence per field comes from the shared
  `extractProductFieldVerification(pages)`; this audit adds only the length,
  format and mappability assertions on top of it.

## Deferred

- Per-PDP row verdicts across a sampled set: the audit reports the first product
  page with `Product` markup rather than every PDP in the scan.
- `identifier_exists=no` is named in the finding as the escape hatch but is not
  detectable from the PDP, so it cannot be verified.
