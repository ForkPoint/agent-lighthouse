---
check: cart-handoff-reachability
title: "Cart Handoff Reachability"
domain: agentic-commerce
status: proposed
evidence_grade: B
uniqueness: unique
difficulty: multi-page
scoring_tier: scored
reviewed: 2026-08-20
---

# Cart Handoff Reachability

> Proposed check. Evidence grade **B** · unique · implementation: `multi-page`

## What it checks

Tests whether the URL an agent would hand a buyer to — the ACP Cart API's continue_url, or the storefront cart for a computer-use agent — is actually reachable without an account and without a bot challenge.

## Claimed mechanism (falsifiable)

Falsifiable claim: ACP 2026-04-17 adds a seller-hosted Cart API whose response carries a `continue_url` (e.g. https://seller.example.com/cart/cart_abc123) used to hand the buyer off to the seller's own checkout UI; this is the low-lift adoption path that requires no delegated payment. For merchants with no ACP integration at all, a computer-use shopping agent drives that same storefront cart directly. In both cases, if the cart or checkout URL 302s to a login page, or serves a CAPTCHA/bot-challenge on the checkout document, the handoff dead-ends at the final step after every upstream signal worked. ACP even reserves a message code `requires_sign_in` for the sign-in wall case. Disproof condition: agent handoffs completing normally through a login-walled cart.

## Evidence

- **[openapi.cart.yaml (spec version 2026-04-17)](https://raw.githubusercontent.com/agentic-commerce-protocol/agentic-commerce-protocol/main/spec/2026-04-17/openapi/openapi.cart.yaml)** — Agentic Commerce Protocol (spec, URL verified 2026-08-20)
  - Seller-hosted pre-checkout Cart API at https://seller.example.com: POST /carts, GET /carts/{id}, PUT /carts/{id} (full replacement), POST /carts/{id}/cancel. Required headers Authorization (Bearer) and API-Version (e.g. 2026-04-17); Idempotency-Key required on POST; Content-Type application/json on POST/PUT; optional Accept-Language, Request-Id. The cart response carries a `continue_url` (e.g. https://seller.example.com/cart/cart_abc123) used to hand the buyer off to the seller's own checkout UI. No payment configuration in this phase; expired carts return 404. This is the lower-lift adoption path versus full delegated-payment Instant Checkout.
- **[openapi.agentic_checkout.yaml (spec version 2026-04-17)](https://raw.githubusercontent.com/agentic-commerce-protocol/agentic-commerce-protocol/main/spec/2026-04-17/openapi/openapi.agentic_checkout.yaml)** — Agentic Commerce Protocol (spec, URL verified 2026-08-20)
  - CheckoutSession REQUIRED fields (9): id, status, currency, line_items, totals, fulfillment_options, messages, links, capabilities. links[].type enum expanded to 8 values: terms_of_use, privacy_policy, return_policy, shipping_policy, contact_us, about_us, faq, support. status enum (11): incomplete, not_ready_for_payment, requires_escalation, authentication_required, ready_for_payment, pending_approval, complete_in_progress, completed, canceled, in_progress, expired. totals[].type enum (12): items_base_amount, items_discount, subtotal, discount, fulfillment, tax, fee, gift_wrap, tip, store_credit, total, amount_refunded. Message error codes extended with low_stock, quantity_exceeded, coupon_invalid, coupon_expired, minimum_not_met, maximum_exceeded, region_restricted, age_verification_required, approval_required, unsupported, not_found, conflict, rate_limited, expired, intervention_required. API-Version is YYYY-MM-DD, required on all requests. Response headers Idempotency-Key and Request-Id are required echoes.
- **[OpenAI Bots / Crawler documentation](https://developers.openai.com/api/docs/bots)** — OpenAI (vendor-doc, URL verified 2026-08-20)
  - Four distinct user agents with separate robots.txt tokens and separate published IP-range files: OAI-SearchBot (surfaces sites in ChatGPT search — https://openai.com/searchbot.json), OAI-AdsBot (validates ad landing pages — https://openai.com/adsbot.json), GPTBot (model training — https://openai.com/gptbot.json), ChatGPT-User (user-initiated actions: web visits and GPT Actions — https://openai.com/chatgpt-user.json). ChatGPT-User is the agent that fetches on a shopper's behalf. Crucially these are separately controllable: blocking GPTBot does not block OAI-SearchBot or ChatGPT-User, and vice versa.
- **[ACP Concepts: Architecture](https://agenticcommerce.dev/docs/concepts/architecture)** — Agentic Commerce Protocol (spec, URL verified 2026-08-20)
  - Four roles: Buyer, Agent, Seller (merchant of record, implements Checkout API), Payment Provider (tokenizes credentials with allowance constraints). IMPORTANT NEGATIVE RESULT: the architecture documents no seller discovery mechanism — no registry, no .well-known URL, no automatic endpoint discovery. Seller onboarding is out-of-band/manual. This means any 'ACP endpoint discovery' audit check would be speculative today, and endpoint conformance testing must accept an operator-supplied base URL.

## Competitor coverage

Conversion-rate tools measure human checkout friction; none evaluate it from an agent's perspective or under an agent UA. Lighthouse's agentic category checks layout stability and agent accessibility on the rendered page but never navigates a purchase funnel. No AI-visibility vendor touches the cart path.

## Implementation sketch

Fingerprint the platform from response headers and markup (Shopify: x-shopid header, cdn.shopify.com; WooCommerce: wp-content/plugins/woocommerce; BigCommerce: cdn11.bigcommerce.com; Magento: /static/version, Magento_ cookies) and derive candidate paths — Shopify /cart and /cart.js, WooCommerce /cart and /checkout, BigCommerce /cart.php and /checkout, Magento /checkout/cart. GET each with a browser UA and again with the ChatGPT-User UA. FAIL on: (a) redirect whose final path matches /login|/signin|/sign-in|/account\/login|/customer\/account\/login/i, indicating an account wall on the buy path; (b) the cart or checkout DOCUMENT (not a subresource on unrelated pages) referencing a challenge widget — challenges.cloudflare.com/turnstile, www.google.com/recaptcha, hcaptcha.com, or a data-sitekey attribute; (c) 403/429 under either UA; (d) cart path returning 404 under all candidates, meaning no discoverable cart surface. WARN when the checkout document is entirely JS-rendered with an empty <noscript> fallback. Strictly read-only: never POST to add-to-cart, never submit forms, honour robots.txt Disallow on cart paths and report a Disallow there as informational rather than as a fetch. Bound at one request per path per UA.

## Example failure

A store's /cart renders fine but /checkout issues a 302 to /account/login?checkout_url=... because guest checkout is disabled. Feed data, policy links and structured markup all score perfectly; the agent walks the buyer to a login form for an account they do not have and the purchase dies at the last click. Variant: Cloudflare Turnstile is mounted on the checkout document only, so every other page in the audit passes cleanly.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
