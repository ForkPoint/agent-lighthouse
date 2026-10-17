---
audit: agentic-commerce/offer-truth-consistency
category: agentic-commerce
source_file: packages/core/src/audits/agentic-commerce/offer-truth-consistency.ts
slug: offer-truth-consistency
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - acp-openapi-checkout
  - openai-feed-spec-confirm
  - acp-sellers
  - google-merchant-listing
---

# Offer Truth Consistency

> Shipped in v2. Evidence grade **B** · scored tier · unique · implementation: `multi-page`

## What it checks

Hunts for internal contradictions between what a page's structured data claims and what the page actually says about price and stock — the class of defect that makes an agent quote a price it cannot honour.

## Claimed mechanism (falsifiable)

Falsifiable claim. The agent quotes from indexed structured data or the feed, while the ACP checkout session recomputes authoritative amounts seller-side. ACP defines dedicated message codes `invalid`, `out_of_stock` and `low_stock` for exactly this divergence. Totals are recomputed by the seller before status can reach ready_for_payment. A page whose markup says InStock at 49.00 while its DOM says Sold out at 59.00 therefore produces a quote-to-checkout mismatch, which surfaces to the buyer as a price change or a failed purchase. Disproof condition: contradictory pages transacting without a mismatch message.

## Evidence

- **[openapi.agentic_checkout.yaml (spec version 2026-04-17)](https://raw.githubusercontent.com/agentic-commerce-protocol/agentic-commerce-protocol/main/spec/2026-04-17/openapi/openapi.agentic_checkout.yaml)** — Agentic Commerce Protocol (spec, URL verified 2026-08-20)
  - CheckoutSession carries nine REQUIRED fields and three enums.
  - Required fields: id, status, currency, line_items, totals, fulfillment_options, messages, links, capabilities.
  - `links[].type`, expanded to 8 values: terms_of_use, privacy_policy, return_policy, shipping_policy, contact_us, about_us, faq, support.
  - `status`, 11 values: incomplete, not_ready_for_payment, requires_escalation, authentication_required, ready_for_payment, pending_approval, complete_in_progress, completed, canceled, in_progress, expired.
  - `totals[].type`, 12 values: items_base_amount, items_discount, subtotal, discount, fulfillment, tax, fee, gift_wrap, tip, store_credit, total, amount_refunded. Message error codes extended with low_stock, quantity_exceeded, coupon_invalid, coupon_expired, minimum_not_met, maximum_exceeded, region_restricted, age_verification_required, approval_required, unsupported, not_found, conflict, rate_limited, expired, intervention_required. API-Version is YYYY-MM-DD, required on all requests. Response headers Idempotency-Key and Request-Id are required echoes.
- **[OpenAI Product Feed Specification](https://developers.openai.com/commerce/specs/feed/)** — OpenAI (vendor-doc, URL verified 2026-08-20)
  - Required feed fields: item_id (<=100 chars), title (<=150), description (<=5000), brand (<=70), url, image_url, price (number + ISO 4217), availability enum {in_stock,out_of_stock,pre_order,backorder,unknown}, is_eligible_search, is_eligible_checkout, target_countries. CONDITIONAL hard requirements: availability_date required if availability is pre_order/backorder; seller_privacy_policy and seller_tos required if is_eligible_checkout=true; gtin or mpn required unless identifier_exists=no. Recommended: group_id, listing_has_variations, variant_dict, size, size_system, color, item_group_title, review_count, star_rating, q_and_a, reviews, age_restriction. Optional fulfillment field `shipping` uses format country:region:service_class:price:handling_days:transit_days. Returns fields: accepts_returns, return_deadline_in_days (positive int), accepts_exchanges, return_policy (URL, HTTPS preferred). sale_price must be less than price. Formats: .txt/.tsv/.csv (+.gz), UTF-8, lowercase underscore header row. Parser auto-selects between OpenAI schema and a Google-compatible profile.
- **[ACP Getting Started: Sellers](https://agenticcommerce.dev/docs/getting-started/sellers)** — Agentic Commerce Protocol (spec, URL verified 2026-08-20)
  - Seller obligations: implement the five HTTPS/JSON checkout endpoints; calculate all amounts (item prices, discounts, taxes, shipping); manage inventory and availability; process payments through their PSP; fulfil orders. Sellers must declare capabilities in every checkout response, including payment handlers (handler id, name, version, PSP reference, configuration) and optional extensions. Sellers must validate payment handler IDs against declared capabilities and manage state transitions to ready_for_payment.
- **[Merchant listing (Product) structured data](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing)** — Google (vendor-doc, URL verified 2026-08-20)
  - Required: name, image, offers; within offers price (or priceSpecification.price) and priceCurrency (3-letter ISO 4217). Recommended: gtin|gtin8|gtin12|gtin13|gtin14, mpn, sku, availability, priceValidUntil (ISO 8601), itemCondition, url, validFrom/validThrough, hasMerchantReturnPolicy, shippingDetails (OfferShippingDetails), aggregateRating, review, description, brand. Policies are recommended at Organization level.

## Example failure

A seasonal item sells out. The storefront template flips the button to a disabled 'Sold out' state but the JSON-LD block is cached and still emits availability: https://schema.org/InStock with priceValidUntil 2025-12-31. ChatGPT recommends it as available at last year's price; the checkout session returns a message with code out_of_stock and the buyer abandons.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Implementation deviations

- This audit absorbed the `offer-dom-price-parity` proposal. Its record is in
  [`../../merged/agentic-commerce/offer-dom-price-parity.md`](../../merged/agentic-commerce/offer-dom-price-parity.md).
  It added the unmachine-readable class, the JS-only warning, struck-through
  prices as an acceptable non-match, and the any-candidate match rule.
- Sub-rules are independent. The first failure is reported.
  `details.contradictions` counts them all, and `details.failures` lists up
  to eight.
- Markup saying InStock fails when the product region says sold out, or when
  its add-to-cart control is disabled. Markup saying OutOfStock fails only
  when the region says "in stock" or "available now". A disabled buy button
  stays on many sold-out templates.
- No prominence heuristic. A match against any non-struck price in the
  product region is enough. Font size is not knowable from raw HTML.
- No headless tier. A page with neither a rendered nor a declared price takes
  the JS-only warning. A page with no rendered price skips the price
  comparison.
- Currency comparison is symbol-based. A rendered `$` clears USD, CAD, AUD and
  MXN alike.
- Sale inversion compares the lowest live price to the highest struck-through
  price in the page, not to a `listPrice` field.
- At most 3 product pages. The audit sends no request.

## Deferred

- Duplicate conflicts are keyed on `url` or `@id`. Two Offers with different
  prices for the same `sku` under different URLs are not reported.
- Rendered-price extraction on JavaScript-built pages needs a headless tier
  the scanner does not have.
