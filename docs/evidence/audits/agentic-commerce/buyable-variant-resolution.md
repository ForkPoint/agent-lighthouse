---
audit: agentic-commerce/buyable-variant-resolution
category: agentic-commerce
source_file: packages/core/src/audits/agentic-commerce/buyable-variant-resolution.ts
slug: buyable-variant-resolution
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - acp-openapi-feed
  - openai-feed-spec-confirm
  - google-product-variants
  - acp-openapi-checkout
---

# Buyable Variant Resolution

> Shipped in v2. Evidence grade **B** · scored tier · unique · implementation: `multi-page`

## What it checks

Detects PDPs that present variant selectors to humans but expose no per-variant purchasable identifier with its own price and availability — the single most common reason an agent cannot convert 'the blue one in medium' into a line item.

## Claimed mechanism (falsifiable)

Falsifiable claim: the ACP Feed API models catalogue variant-first — a Product REQUIRES id plus a variants[] array, and each Variant REQUIRES its own id, with its own price and availability. The OpenAI feed spec mirrors this with group_id, listing_has_variations, variant_dict, size and color. Google's ProductGroup markup requires productGroupID and requires each variant Product to carry sku-or-gtin plus its own offers. A PDP that shows a size or colour selector, but publishes exactly one Offer — or an AggregateOffer with only lowPrice and highPrice — therefore gives the agent no addressable purchasable unit. The row is dropped at feed validation, or the checkout session returns a message with code `invalid` or `out_of_stock`. Disproof condition: an agent successfully completing a variant purchase from a PDP with no per-variant identifier anywhere in the response.

## Evidence

- **[openapi.feed.yaml (spec version 2026-04-17)](https://raw.githubusercontent.com/agentic-commerce-protocol/agentic-commerce-protocol/main/spec/2026-04-17/openapi/openapi.feed.yaml)** — Agentic Commerce Protocol (spec, URL verified 2026-08-20)
  - Merchant-hosted feed API (server https://merchant.example.com): POST /feeds, GET /feeds/{id}, GET /feeds/{id}/products, PATCH /feeds/{id}/products. Product object REQUIRES id and variants[] (array of Variant). Variant REQUIRES id and title; optional description, url, barcodes, price, list_price, unit_price, availability, categories, condition, variant_options, media, seller, marketplace. Critically, the model is variant-first: every sellable thing is a Variant with its own id, price and availability — a product without resolvable variants has no purchasable unit.
- **[OpenAI Product Feed Specification](https://developers.openai.com/commerce/specs/feed/)** — OpenAI (vendor-doc, URL verified 2026-08-20)
  - Required feed fields: item_id (<=100 chars), title (<=150), description (<=5000), brand (<=70), url, image_url, price (number + ISO 4217), availability enum {in_stock,out_of_stock,pre_order,backorder,unknown}, is_eligible_search, is_eligible_checkout, target_countries. CONDITIONAL hard requirements: availability_date required if availability is pre_order/backorder; seller_privacy_policy and seller_tos required if is_eligible_checkout=true; gtin or mpn required unless identifier_exists=no. Recommended: group_id, listing_has_variations, variant_dict, size, size_system, color, item_group_title, review_count, star_rating, q_and_a, reviews, age_restriction. Optional fulfillment field `shipping` uses format country:region:service_class:price:handling_days:transit_days. Returns fields: accepts_returns, return_deadline_in_days (positive int), accepts_exchanges, return_policy (URL, HTTPS preferred). sale_price must be less than price. Formats: .txt/.tsv/.csv (+.gz), UTF-8, lowercase underscore header row. Parser auto-selects between OpenAI schema and a Google-compatible profile.
- **[Product variant (ProductGroup) structured data](https://developers.google.com/search/docs/appearance/structured-data/product-variants)** — Google (vendor-doc, URL verified 2026-08-20)
  - ProductGroup REQUIRED: name, productGroupID (parent SKU, must align with inProductGroupWithID on variants). RECOMMENDED: variesBy (schema.org URLs — color, size, suggestedAge, suggestedGender, material, pattern), hasVariant (nested variant Products, or variants point back with isVariantOf). Each variant Product must carry sku or gtin (unique per variant), offers (price + availability), and the color/size values matching variesBy.
- **[openapi.agentic_checkout.yaml (spec version 2026-04-17)](https://raw.githubusercontent.com/agentic-commerce-protocol/agentic-commerce-protocol/main/spec/2026-04-17/openapi/openapi.agentic_checkout.yaml)** — Agentic Commerce Protocol (spec, URL verified 2026-08-20)
  - CheckoutSession carries nine REQUIRED fields and three enums.
  - Required fields: id, status, currency, line_items, totals, fulfillment_options, messages, links, capabilities.
  - `links[].type`, expanded to 8 values: terms_of_use, privacy_policy, return_policy, shipping_policy, contact_us, about_us, faq, support.
  - `status`, 11 values: incomplete, not_ready_for_payment, requires_escalation, authentication_required, ready_for_payment, pending_approval, complete_in_progress, completed, canceled, in_progress, expired.
  - `totals[].type`, 12 values: items_base_amount, items_discount, subtotal, discount, fulfillment, tax, fee, gift_wrap, tip, store_credit, total, amount_refunded. Message error codes extended with low_stock, quantity_exceeded, coupon_invalid, coupon_expired, minimum_not_met, maximum_exceeded, region_restricted, age_verification_required, approval_required, unsupported, not_found, conflict, rate_limited, expired, intervention_required. API-Version is YYYY-MM-DD, required on all requests. Response headers Idempotency-Key and Request-Id are required echoes.

## Competitor coverage

Google's Rich Results Test validates ProductGroup syntax when present but never flags the mismatch between visible variant UI and absent variant markup — it has no notion of 'this page has a selector'. Lighthouse's agentic category does not read commerce structured data. No AI-visibility tool models variant addressability.

## Implementation sketch

Step 1 — establish that variants EXIST from the raw HTML: any <select> whose name/id/class matches /(size|colour|color|variant|option|style|width|length)/i with >=2 non-placeholder <option>s; or >=2 elements bearing data-variant-id / data-option-value / data-product-variant; or platform fingerprints (Shopify: window.ShopifyAnalytics.meta.product.variants, or a fetchable /products/{handle}.js returning variants[]; WooCommerce: form.variations_form[data-product_variations]; BigCommerce: productOptions). Step 2 — require the JSON-LD to resolve those variants, passing if EITHER (a) a ProductGroup node with productGroupID, variesBy, and hasVariant[] where every entry has sku-or-gtin* AND its own offers.price + offers.priceCurrency + offers.availability, OR (b) >=2 distinct Product nodes each with a unique sku-or-gtin and its own complete Offer. Step 3 — hard fail if the page has N>=2 detected variants but exposes exactly one Offer, or an AggregateOffer with lowPrice/highPrice and no per-variant offers, since no single price can be quoted. Step 4 — cross-check cardinality: warn when the count of variants in markup differs from the count detected in the DOM/platform JSON, which signals a partially-generated ProductGroup. Report the exact missing per-variant field so the fix is mechanical.

## Example failure

A clothing PDP offers 5 sizes x 3 colours via <select> menus. Its JSON-LD contains one Product with offers as an AggregateOffer lowPrice 49 highPrice 79. The agent can describe the product but cannot name a purchasable item_id or quote a price, so ChatGPT either omits it from a comparison or the checkout session comes back with code `invalid` on $.line_items[0].

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Implementation deviations

- **No network calls.** The sketch mentions fetching `/products/{handle}.js` for Shopify variant JSON. The audit reads only pages the scan already fetched: the Shopify variant array is counted out of the inline `window.ShopifyAnalytics` script, and WooCommerce out of `data-product_variations` on the variations form. BigCommerce `productOptions` and Magento are covered only through the `<select>` and data-attribute arms.
- **Variant counts come from the strongest signal, not from all of them summed.** A page carrying both a size `<select>` and per-swatch `data-variant-id` attributes would double-count if the arms were added; the audit takes the largest single count instead. That undercounts a true size × colour matrix — a 5 × 3 page reports 5 — so the cardinality warning fires only when the markup resolves fewer variants than the single largest selector shows. Undercounting is the safe direction: it never invents a mismatch that is not there.
- **At most 3 product pages** are examined, and the failure reported is the first one found. The details block carries up to 5 of each finding kind.
- **Reachability of variant URLs is not probed.** The audit checks that each variant is addressable in the markup, not that its URL answers.
- **A ProductGroup that exists but does not resolve outranks the offer-shape arms.** When a page carries a `ProductGroup` with problems, the finding names the missing per-variant fields rather than saying "exactly one Offer": the field list is what a developer acts on.
- **`mpn` is accepted as a variant identifier** alongside `sku` and the `gtin` family. Google's guidance names sku-or-gtin; a unique `mpn` addresses the variant just as well, and rejecting it would fail pages that are in fact resolvable.

## Deferred

- **The DOM-versus-markup cardinality check is partial.** Step 4 of the sketch compares the variant count in markup against the count "in the DOM/platform JSON". Without a rendered DOM the audit compares against the largest static selector it can see, so a page that builds its selectors in JavaScript reports no variants at all and is treated as single-variant.
- **`variesBy` values are not cross-checked against the variants.** The audit requires `variesBy` to be present; it does not verify that every variant carries the colour/size properties `variesBy` names.
- **Feed-side validation.** Whether the merchant's ACP or OpenAI feed actually carries the variants is out of scope: the audit reads the page, not the feed.
