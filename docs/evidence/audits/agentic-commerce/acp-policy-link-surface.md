---
audit: agentic-commerce/acp-policy-link-surface
category: agentic-commerce
source_file: packages/core/src/audits/agentic-commerce/acp-policy-link-surface.ts
slug: acp-policy-link-surface
evidence_grade: A
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-22"
reviewed: 2026-08-20
graduated: 2026-08-22
sources:
  - acp-openapi-checkout
  - openai-feed-spec-confirm
  - acp-checkout-spec
  - acp-sellers
---


# ACP Link-Surface Completeness (the 8 required policy link types)

> Shipped in v2. Evidence grade **A** · scored tier · unique · implementation: `multi-page`

## What it checks

Verifies the merchant can populate the `links` array that every ACP CheckoutSession response is required to carry, by resolving each of the 8 enum link types to a stable, HTTPS, no-JS-required, non-soft-404 URL on the merchant's own site.

## Claimed mechanism (falsifiable)

Falsifiable claim: ACP spec 2026-04-17 makes `links` one of the 9 REQUIRED fields on every CheckoutSession response, with type enum {terms_of_use, privacy_policy, return_policy, shipping_policy, contact_us, about_us, faq, support}. Independently, the OpenAI product feed spec makes `seller_privacy_policy` and `seller_tos` HARD-REQUIRED whenever `is_eligible_checkout=true`. Therefore a merchant that cannot produce a resolvable HTTPS URL for terms_of_use and privacy_policy CANNOT set is_eligible_checkout=true and its catalogue is excluded from Instant Checkout no matter how good the feed is. Disproof condition: if a merchant with no reachable ToS URL is observed transacting via ACP Instant Checkout, the check is wrong.

## Evidence

- **[openapi.agentic_checkout.yaml (spec version 2026-04-17)](https://raw.githubusercontent.com/agentic-commerce-protocol/agentic-commerce-protocol/main/spec/2026-04-17/openapi/openapi.agentic_checkout.yaml)** — Agentic Commerce Protocol (spec, URL verified 2026-08-20)
  - CheckoutSession REQUIRED fields (9): id, status, currency, line_items, totals, fulfillment_options, messages, links, capabilities. links[].type enum expanded to 8 values: terms_of_use, privacy_policy, return_policy, shipping_policy, contact_us, about_us, faq, support. status enum (11): incomplete, not_ready_for_payment, requires_escalation, authentication_required, ready_for_payment, pending_approval, complete_in_progress, completed, canceled, in_progress, expired. totals[].type enum (12): items_base_amount, items_discount, subtotal, discount, fulfillment, tax, fee, gift_wrap, tip, store_credit, total, amount_refunded. Message error codes extended with low_stock, quantity_exceeded, coupon_invalid, coupon_expired, minimum_not_met, maximum_exceeded, region_restricted, age_verification_required, approval_required, unsupported, not_found, conflict, rate_limited, expired, intervention_required. API-Version is YYYY-MM-DD, required on all requests. Response headers Idempotency-Key and Request-Id are required echoes.
- **[OpenAI Product Feed Specification](https://developers.openai.com/commerce/specs/feed/)** — OpenAI (vendor-doc, URL verified 2026-08-20)
  - Required feed fields: item_id (<=100 chars), title (<=150), description (<=5000), brand (<=70), url, image_url, price (number + ISO 4217), availability enum {in_stock,out_of_stock,pre_order,backorder,unknown}, is_eligible_search, is_eligible_checkout, target_countries. CONDITIONAL hard requirements: availability_date required if availability is pre_order/backorder; seller_privacy_policy AND seller_tos required if is_eligible_checkout=true; gtin OR mpn required unless identifier_exists=no. Recommended: group_id, listing_has_variations, variant_dict, size, size_system, color, item_group_title, review_count, star_rating, q_and_a, reviews, age_restriction. Optional fulfillment field `shipping` uses format country:region:service_class:price:handling_days:transit_days. Returns fields: accepts_returns, return_deadline_in_days (positive int), accepts_exchanges, return_policy (URL, HTTPS preferred). sale_price must be less than price. Formats: .txt/.tsv/.csv (+.gz), UTF-8, lowercase underscore header row. Parser auto-selects between OpenAI schema and a Google-compatible profile.
- **[Agentic Checkout Specification](https://developers.openai.com/commerce/specs/checkout/)** — OpenAI / Stripe (Agentic Commerce Protocol) (spec, URL verified 2026-08-20)
  - Five merchant-hosted HTTPS+JSON endpoints: POST /checkout_sessions (201), POST /checkout_sessions/{checkout_session_id}, POST /checkout_sessions/{id}/complete, POST /checkout_sessions/{id}/cancel (405 if not cancelable), GET /checkout_sessions/{id} (404 if absent). Request headers: Authorization, Accept-Language, User-Agent, Idempotency-Key, Request-Id, Content-Type, Signature, Timestamp (RFC 3339), API-Version. Response MUST echo Idempotency-Key and Request-Id. Session object carries id, status, currency (lowercase ISO 4217), line_items, fulfillment_options, totals, messages, links, payment_provider. Error envelope: {type, code, message, param(JSONPath)}. Message error codes include missing, invalid, out_of_stock, payment_declined, requires_sign_in, requires_3ds. Link types include terms_of_use, privacy_policy, seller_shop_policies.
- **[ACP Getting Started: Sellers](https://agenticcommerce.dev/docs/getting-started/sellers)** — Agentic Commerce Protocol (spec, URL verified 2026-08-20)
  - Seller obligations: implement the five HTTPS/JSON checkout endpoints; calculate all amounts (item prices, discounts, taxes, shipping); manage inventory and availability; process payments through their PSP; fulfil orders. Sellers must declare capabilities in EVERY checkout response, including payment handlers (handler id, name, version, PSP reference, configuration) and optional extensions. Sellers must validate payment handler IDs against declared capabilities and manage state transitions to ready_for_payment.

## Competitor coverage

Lighthouse's Agentic Browsing category covers llms.txt, WebMCP tools, agent accessibility and layout stability — no policy-link surface. Semrush/Ahrefs site audits flag broken links generically but do not classify by ACP link-type enum or gate on the two conditional feed requirements. Profound/Otterly measure answer-engine visibility, not merchant transactability.

## Implementation sketch

1) Fetch homepage + 2 sampled PDPs; extract every <a href> from the RAW HTML (no JS) plus any <link rel> policy hints. 2) Classify each href into the 8 enum types using path and anchor-text regexes: terms_of_use=/terms|/tos|terms-of-(service|use|sale); privacy_policy=/privacy|privacy-(policy|notice); return_policy=/returns?|/refunds?|return-policy|/exchanges; shipping_policy=/shipping|/delivery|shipping-policy; contact_us=/contact; about_us=/about; faq=/faqs?|frequently-asked; support=/support|/help|/customer-(service|care). 3) For each resolved URL: require scheme https, final status 200 after <=3 same-registrable-domain redirects, Content-Type text/html, and a soft-404 guard (raw body must contain >=500 chars of extracted text and must NOT match /page not found|404|doesn.t exist/i in <title> or <h1>). 4) No-JS guard: policy text must be present in the initial HTML, since ACP link targets are opened by agents that may not execute JS. 5) Score = fraction of 8 types resolved; terms_of_use and privacy_policy are hard gates that force the whole check to fail. Emit the resolved URL per type so the merchant can paste them straight into their `links` array and feed rows.

## Example failure

A Shopify store renders its refund policy at /policies/refund-policy but the PDP only links it from a JS-hydrated footer drawer, so raw HTML contains no href to it; return_policy resolves to nothing and the merchant's CheckoutSession `links` array ships incomplete. Worse case: /terms 301-redirects cross-domain to a Zendesk help centre that returns 403 to non-browser clients — terms_of_use fails the hard gate and is_eligible_checkout cannot be set.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Implementation deviations

- **The fetcher's declared `followRedirects` option was inert.** It is now
  honoured (`packages/core/src/fetcher.ts`): `false` selects a dispatcher with
  no redirect interceptor, so this audit can walk the chain one hop at a time
  and count it. Pinned in `packages/core/src/fetcher.test.ts`.
- **Registrable domain uses a short public-suffix list**, not a bundled PSL
  snapshot, because the global constraint forbids new runtime dependencies. It
  covers the common multi-label suffixes (`co.uk`, `com.au`, …); a merchant on
  an exotic suffix may see a same-site link reported as off-domain.
- **The no-JS guard is a text-versus-body-size comparison.** Under 500
  characters of extracted text with a response body over 2,000 characters is
  reported as a client-rendered shell; under 500 characters with a small body is
  reported as a thin page. Scripts, styles and templates are removed before the
  text is measured.
- **Classification is path-first, anchor-text-second**, so an opaque path is
  still classified by its label and a mislabelled link is still classified by
  its path. The first match in document order wins per type.
- `resolvePolicyLinks(ctx)` is exported from the package root so other
  checkout-eligibility audits reuse the resolved `terms_of_use` and
  `privacy_policy` targets rather than re-deriving them.

## Deferred

- The sampled-PDP sweep is implicit: the audit reads every page already in the
  scan context rather than issuing its own PDP fetches.
- `<link rel>` policy hints are not read; every candidate comes from `<a href>`.
