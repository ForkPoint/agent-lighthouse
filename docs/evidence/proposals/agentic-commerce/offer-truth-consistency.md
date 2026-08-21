---
check: offer-truth-consistency
title: "Offer Truth Consistency"
domain: agentic-commerce
status: proposed
evidence_grade: B
uniqueness: unique
difficulty: multi-page
scoring_tier: scored
reviewed: 2026-08-20
---

# Offer Truth Consistency

> Proposed check. Evidence grade **B** · unique · implementation: `multi-page`

## What it checks

Hunts for internal contradictions between what a page's structured data claims and what the page actually says about price and stock — the class of defect that makes an agent quote a price it cannot honour.

## Claimed mechanism (falsifiable)

Falsifiable claim: the agent quotes from indexed structured data or the feed, while the ACP checkout session recomputes authoritative amounts seller-side; ACP defines dedicated message codes `invalid`, `out_of_stock` and `low_stock` for exactly this divergence, and totals are recomputed by the seller before status can reach ready_for_payment. A page whose markup says InStock at 49.00 while its DOM says Sold out at 59.00 therefore produces a quote-to-checkout mismatch, which surfaces to the buyer as a price change or a failed purchase. Disproof condition: contradictory pages transacting without a mismatch message.

## Evidence

- **[openapi.agentic_checkout.yaml (spec version 2026-04-17)](https://raw.githubusercontent.com/agentic-commerce-protocol/agentic-commerce-protocol/main/spec/2026-04-17/openapi/openapi.agentic_checkout.yaml)** — Agentic Commerce Protocol (spec, URL verified 2026-08-20)
  - CheckoutSession REQUIRED fields (9): id, status, currency, line_items, totals, fulfillment_options, messages, links, capabilities. links[].type enum expanded to 8 values: terms_of_use, privacy_policy, return_policy, shipping_policy, contact_us, about_us, faq, support. status enum (11): incomplete, not_ready_for_payment, requires_escalation, authentication_required, ready_for_payment, pending_approval, complete_in_progress, completed, canceled, in_progress, expired. totals[].type enum (12): items_base_amount, items_discount, subtotal, discount, fulfillment, tax, fee, gift_wrap, tip, store_credit, total, amount_refunded. Message error codes extended with low_stock, quantity_exceeded, coupon_invalid, coupon_expired, minimum_not_met, maximum_exceeded, region_restricted, age_verification_required, approval_required, unsupported, not_found, conflict, rate_limited, expired, intervention_required. API-Version is YYYY-MM-DD, required on all requests. Response headers Idempotency-Key and Request-Id are required echoes.
- **[OpenAI Product Feed Specification](https://developers.openai.com/commerce/specs/feed/)** — OpenAI (vendor-doc, URL verified 2026-08-20)
  - Required feed fields: item_id (<=100 chars), title (<=150), description (<=5000), brand (<=70), url, image_url, price (number + ISO 4217), availability enum {in_stock,out_of_stock,pre_order,backorder,unknown}, is_eligible_search, is_eligible_checkout, target_countries. CONDITIONAL hard requirements: availability_date required if availability is pre_order/backorder; seller_privacy_policy AND seller_tos required if is_eligible_checkout=true; gtin OR mpn required unless identifier_exists=no. Recommended: group_id, listing_has_variations, variant_dict, size, size_system, color, item_group_title, review_count, star_rating, q_and_a, reviews, age_restriction. Optional fulfillment field `shipping` uses format country:region:service_class:price:handling_days:transit_days. Returns fields: accepts_returns, return_deadline_in_days (positive int), accepts_exchanges, return_policy (URL, HTTPS preferred). sale_price must be less than price. Formats: .txt/.tsv/.csv (+.gz), UTF-8, lowercase underscore header row. Parser auto-selects between OpenAI schema and a Google-compatible profile.
- **[ACP Getting Started: Sellers](https://agenticcommerce.dev/docs/getting-started/sellers)** — Agentic Commerce Protocol (spec, URL verified 2026-08-20)
  - Seller obligations: implement the five HTTPS/JSON checkout endpoints; calculate all amounts (item prices, discounts, taxes, shipping); manage inventory and availability; process payments through their PSP; fulfil orders. Sellers must declare capabilities in EVERY checkout response, including payment handlers (handler id, name, version, PSP reference, configuration) and optional extensions. Sellers must validate payment handler IDs against declared capabilities and manage state transitions to ready_for_payment.
- **[Merchant listing (Product) structured data](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing)** — Google (vendor-doc, URL verified 2026-08-20)
  - Required: name, image, offers; within offers price (or priceSpecification.price) and priceCurrency (3-letter ISO 4217). Recommended: gtin|gtin8|gtin12|gtin13|gtin14, mpn, sku, availability, priceValidUntil (ISO 8601), itemCondition, url, validFrom/validThrough, hasMerchantReturnPolicy, shippingDetails (OfferShippingDetails), aggregateRating, review, description, brand. Policies are recommended at Organization level.

## Competitor coverage

SEO suites flag MISSING schema fields; none of them flag schema that is present and lying. Google Search Console surfaces mismatched-price errors only for Merchant Center feeds already submitted, after the fact, and only to the merchant. Lighthouse has no commerce data model at all. This is genuinely unshipped.

## Implementation sketch

All sub-rules are deterministic and static; run them per PDP and report each independently rather than as one blob. (a) STOCK CONTRADICTION: offers.availability maps to in_stock while raw HTML contains /sold\s*out|out of stock|notify me when|back in stock|currently unavailable/i inside the main product region, or the primary add-to-cart <button> carries the disabled attribute. (b) STALE PRICE WINDOW: priceValidUntil parses to a date earlier than today. (c) PRICE DIVERGENCE: extract currency-formatted numbers from the product region, take the most prominent (largest font-size via inline style/class heuristics, else first occurrence after the <h1>), and fail when it differs from offers.price by more than 1 percent — normalise thousands separators and decimal commas before comparing. (d) CURRENCY MISMATCH: the rendered currency symbol/code disagrees with offers.priceCurrency. (e) SALE INVERSION: a sale price greater than or equal to the regular price, which the feed spec forbids outright. (f) DUPLICATE CONFLICT: two JSON-LD Product nodes sharing a url or @id but carrying different prices or availability. (g) MISSING PRICE: no offers.price at all while the page clearly renders a price. Because (c) and (d) depend on rendered text, run them static-first and mark them INDETERMINATE rather than FAIL when the price node is absent from initial HTML; escalate those pages to the headless tier, which is roadmap.

## Example failure

A seasonal item sells out. The storefront template flips the button to a disabled 'Sold out' state but the JSON-LD block is cached and still emits availability: https://schema.org/InStock with priceValidUntil 2025-12-31. ChatGPT recommends it as available at last year's price; the checkout session returns a message with code out_of_stock and the buyer abandons.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
