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

## Absorbed proposal

`competitor-gap-verify/offer-dom-price-parity` was folded into this audit rather than shipped beside it. Both proposals reconcile the same two artifacts — the Offer in the markup and the price and stock the raw HTML renders — and shipping both would have reported one cached-catalogue bug twice, under two names, with two remediations. The absorbed dossier is kept verbatim at [`../../merged/agentic-commerce/offer-dom-price-parity.md`](../../merged/agentic-commerce/offer-dom-price-parity.md); it carries the Google structured-data policy quotation ("Your structured data must be a true representation of the page content") and the Vercel/Merj crawler study showing that no major AI crawler executes JavaScript, which is why the JS-only arm is reported at all.

What the fold added to the rules below: the UNMACHINE-READABLE class (a price rendered with no `offers.price`), the JS-ONLY-PRICE class as a warning rather than a failure, the struck-through candidate as an acceptable non-match, and the rule that a match against *any* candidate is enough rather than against the first.

## Implementation deviations

- **Sub-rules are independent, and the failure reported is the first one found.** Every contradiction is counted in `details.contradictions` and the first eight are listed in `details.failures`, so a page with three defects reports three.
- **The reverse stock contradiction is narrower than the forward one.** Markup that says InStock while the page says sold out fails on the phrase list alone. Markup that says OutOfStock fails only when the page says "in stock" or "available now" — not merely because an add-to-cart button is present, since sold-out templates routinely keep a disabled one.
- **The prominence heuristic in the sketch is not implemented.** Rather than pick the largest-font price and compare against that one, the audit accepts a match against any non-struck candidate in the product region. Font size is not reliably knowable from raw HTML, and accepting any candidate is the conservative direction: it can miss a divergence, never invent one.
- **`INDETERMINATE` is not a status.** The sketch escalates pages whose price is absent from the initial HTML to a headless tier. There is no headless tier, so those pages take the JS-only warning and are excluded from the price and currency comparisons entirely.
- **Currency comparison is symbol-based and permissive.** A rendered `$` clears USD, CAD, AUD and MXN alike; the mismatch fires only when nothing rendered in the product region can stand for the declared code.
- **Sale inversion is read from the DOM,** as the lowest live candidate against the highest struck-through one, not from a `listPrice` field. The feed spec's rule is about the feed; the page is what this audit reads.
- **At most 3 product pages**, and the audit sends no request: everything comes from pages the scan already fetched.

## Deferred

- **AMBIGUOUS-OFFER across sku rather than url.** Duplicate conflicts are keyed on `url` or `@id`. Two Offer nodes carrying different prices for the same `sku` under different URLs are not reported.
- **Microdata and RDFa prices in the rendered text.** Structured data is read through the union parse, so a microdata Offer is compared like a JSON-LD one; the rendered-price extraction is still text-based and currency-anchored.
- **Rendered-price extraction on JavaScript-built pages**, which is the headless tier the sketch names and this scanner does not have.
