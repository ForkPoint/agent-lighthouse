---
audit: agentic-commerce/landed-cost-and-returns
category: agentic-commerce
source_file: packages/core/src/audits/agentic-commerce/landed-cost-and-returns.ts
slug: landed-cost-and-returns
evidence_grade: A
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-22"
reviewed: 2026-08-20
graduated: 2026-08-22
sources:
  - acp-openapi-checkout
  - acp-sellers
  - openai-feed-spec-confirm
  - google-return-policy
  - schemaorg-shipping
  - google-merchant-listing
---

# Landed-Cost and Returns Machine Readability

> Shipped in v2. Evidence grade **A** · scored tier · partial overlap · implementation: `static-fetch`

## What it checks

Requires structured, agent-parsable shipping cost, handling and transit times, and a return window expressed as an integer — the exact inputs an agent needs to rank offers and the exact fields the ACP checkout session must compute.

## Claimed mechanism (falsifiable)

Falsifiable claim. ACP makes `fulfillment_options` and `totals` REQUIRED on every CheckoutSession. The seller, not the agent, is responsible for 'calculating all amounts (item prices, discounts, taxes, shipping)'. Totals must break down into typed entries, including `fulfillment` and `tax`, before status can reach `ready_for_payment`. Upstream of that, the OpenAI feed `shipping` field is a rigid positional string country:region:service_class:price:handling_days:transit_days, and the returns fields are accepts_returns, return_deadline_in_days (positive integer) and return_policy URL. Agents rank competing offers on landed cost and delivery date, both of which are numbers. A merchant that publishes shipping and returns only as prose on a /shipping page supplies no number, so it either loses the comparison or forces a headless-browser fallback. Disproof condition: agents consistently ranking offers correctly from prose-only shipping pages.

## Evidence

- **[openapi.agentic_checkout.yaml (spec version 2026-04-17)](https://raw.githubusercontent.com/agentic-commerce-protocol/agentic-commerce-protocol/main/spec/2026-04-17/openapi/openapi.agentic_checkout.yaml)** — Agentic Commerce Protocol (spec, URL verified 2026-08-20)
  - CheckoutSession carries nine REQUIRED fields and three enums.
  - Required fields: id, status, currency, line_items, totals, fulfillment_options, messages, links, capabilities.
  - `links[].type`, expanded to 8 values: terms_of_use, privacy_policy, return_policy, shipping_policy, contact_us, about_us, faq, support.
  - `status`, 11 values: incomplete, not_ready_for_payment, requires_escalation, authentication_required, ready_for_payment, pending_approval, complete_in_progress, completed, canceled, in_progress, expired.
  - `totals[].type`, 12 values: items_base_amount, items_discount, subtotal, discount, fulfillment, tax, fee, gift_wrap, tip, store_credit, total, amount_refunded. Message error codes extended with low_stock, quantity_exceeded, coupon_invalid, coupon_expired, minimum_not_met, maximum_exceeded, region_restricted, age_verification_required, approval_required, unsupported, not_found, conflict, rate_limited, expired, intervention_required. API-Version is YYYY-MM-DD, required on all requests. Response headers Idempotency-Key and Request-Id are required echoes.
- **[ACP Getting Started: Sellers](https://agenticcommerce.dev/docs/getting-started/sellers)** — Agentic Commerce Protocol (spec, URL verified 2026-08-20)
  - Seller obligations: implement the five HTTPS/JSON checkout endpoints; calculate all amounts (item prices, discounts, taxes, shipping); manage inventory and availability; process payments through their PSP; fulfil orders. Sellers must declare capabilities in every checkout response, including payment handlers (handler id, name, version, PSP reference, configuration) and optional extensions. Sellers must validate payment handler IDs against declared capabilities and manage state transitions to ready_for_payment.
- **[OpenAI Product Feed Specification](https://developers.openai.com/commerce/specs/feed/)** — OpenAI (vendor-doc, URL verified 2026-08-20)
  - Required feed fields: item_id (<=100 chars), title (<=150), description (<=5000), brand (<=70), url, image_url, price (number + ISO 4217), availability enum {in_stock,out_of_stock,pre_order,backorder,unknown}, is_eligible_search, is_eligible_checkout, target_countries. CONDITIONAL hard requirements: availability_date required if availability is pre_order/backorder; seller_privacy_policy and seller_tos required if is_eligible_checkout=true; gtin or mpn required unless identifier_exists=no. Recommended: group_id, listing_has_variations, variant_dict, size, size_system, color, item_group_title, review_count, star_rating, q_and_a, reviews, age_restriction. Optional fulfillment field `shipping` uses format country:region:service_class:price:handling_days:transit_days. Returns fields: accepts_returns, return_deadline_in_days (positive int), accepts_exchanges, return_policy (URL, HTTPS preferred). sale_price must be less than price. Formats: .txt/.tsv/.csv (+.gz), UTF-8, lowercase underscore header row. Parser auto-selects between OpenAI schema and a Google-compatible profile.
- **[Return policy (MerchantReturnPolicy) structured data](https://developers.google.com/search/docs/appearance/structured-data/return-policy)** — Google (vendor-doc, URL verified 2026-08-20)
  - Attachable at Organization level (hasMerchantReturnPolicy) and at Offer level. Required: EITHER applicableCountry (ISO 3166-1 alpha-2, up to 50) + returnPolicyCategory, or merchantReturnLink. returnPolicyCategory enum: MerchantReturnFiniteReturnWindow, MerchantReturnNotPermitted, MerchantReturnUnlimitedWindow. merchantReturnDays (integer) becomes REQUIRED when category is MerchantReturnFiniteReturnWindow. Recommended: returnMethod (ReturnByMail/ReturnInStore/ReturnAtKiosk), returnFees (FreeReturn/ReturnShippingFees/ReturnFeesCustomerResponsibility), refundType (FullRefund/ExchangeRefund/StoreCreditRefund), returnShippingFeesAmount, itemDefectReturnLabelSource, returnPolicyCountry, restockingFee.
- **[schema.org OfferShippingDetails](https://schema.org/OfferShippingDetails)** — schema.org (spec, URL verified 2026-08-20)
  - Properties: deliveryTime (ShippingDeliveryTime — carries handlingTime and transitTime), shippingRate (MonetaryAmount or ShippingRateSettings), shippingDestination (DefinedRegion), shippingOrigin (DefinedRegion), doesNotShip (Boolean), hasShippingService (ShippingService), weight, height, width, depth, validForMemberTier. Note handlingTime/transitTime are nested under deliveryTime, not direct properties — an auditor must traverse offers.shippingDetails.deliveryTime.{handlingTime,transitTime}.
- **[Merchant listing (Product) structured data](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing)** — Google (vendor-doc, URL verified 2026-08-20)
  - Required: name, image, offers; within offers price (or priceSpecification.price) and priceCurrency (3-letter ISO 4217). Recommended: gtin|gtin8|gtin12|gtin13|gtin14, mpn, sku, availability, priceValidUntil (ISO 8601), itemCondition, url, validFrom/validThrough, hasMerchantReturnPolicy, shippingDetails (OfferShippingDetails), aggregateRating, review, description, brand. Policies are recommended at Organization level.

## Competitor coverage

Google's Rich Results Test validates shippingDetails and hasMerchantReturnPolicy syntax, and Merchant Center nags for them — that is the overlap, and I am flagging it honestly. What no tool ships is the agentic framing: requiring both legs simultaneously as a landed-cost precondition, requiring deliveryTime.handlingTime AND deliveryTime.transitTime as bounded QuantitativeValues (not just any shippingDetails node), requiring merchantReturnDays as an integer rather than accepting a merchantReturnLink escape hatch, and emitting the ACP positional `shipping` string. Lighthouse ships none of it.

## Implementation sketch

Parse all JSON-LD/microdata on 2 sampled PDPs plus the Organization node on the homepage. SHIPPING leg — require offers.shippingDetails (OfferShippingDetails) with: shippingRate as MonetaryAmount having numeric value + currency (or doesNotShip:true, which is a legitimate explicit answer); shippingDestination.addressCountry present; and traverse deliveryTime (type ShippingDeliveryTime) requiring both handlingTime and transitTime as QuantitativeValue with numeric minValue and maxValue and unitCode 'DAY' — note handlingTime/transitTime are nested under deliveryTime, not direct properties of OfferShippingDetails. RETURNS leg — require hasMerchantReturnPolicy (Organization or Offer level) with applicableCountry (ISO 3166-1 alpha-2) AND returnPolicyCategory from the 3-value enum; when category is MerchantReturnFiniteReturnWindow, merchantReturnDays MUST be a positive integer. Downgrade (do not pass) policies that satisfy Google only via merchantReturnLink, because a URL is not a number an agent can compare. Recommended sub-scores for returnFees and returnMethod. OUTPUT — synthesise and show the merchant the exact feed values this maps to: the positional `shipping` string US::standard:5.99:1:3 and return_deadline_in_days=30, so remediation is copy-paste.

## Example failure

A PDP carries hasMerchantReturnPolicy with only merchantReturnLink pointing at a prose /returns page, and shippingDetails with a shippingRate but no deliveryTime. An agent asked 'which of these three arrives before Friday and can I send it back' can answer for neither, so it recommends a competitor whose markup carries transitTime maxValue 2 and merchantReturnDays 60.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Implementation deviations

- **Scope is the scan context, not a fresh sample.** The audit reads the product
  pages already in the scan plus any `Organization` node on any scanned page,
  rather than issuing its own two-PDP sample fetch.
- **`unitCode` accepts `DAY` and `D`**; any other unit is treated as absent,
  because the feed's positional string counts days.
- **The feed string uses `maxValue`** for both handling and transit days — the
  worst case is what an agent must plan around. `service_class` comes from the
  `OfferShippingDetails` `name`, defaulting to `standard`; `region` comes from
  `shippingDestination.addressRegion` and is left empty when absent, which is
  what produces the `US::standard:` shape.
- **`merchantReturnLink`-only policies warn and never pass**, and their other
  shape problems are not also reported: reporting "no returnPolicyCategory" next
  to "a URL is not a number" would be the same finding twice.
- **`returnPolicyCategory`** is accepted bare or as a schema.org URL; only the
  final path segment is compared against the three-value enum.

## Deferred

- `returnFees` and `returnMethod` are not scored. They are recommended rather
  than required, and a sub-score would move the total on a field Google itself
  treats as optional.
- Microdata and RDFa offers are read only through the shared JSON-LD-shaped
  normalization; no separate microdata traversal is performed.
