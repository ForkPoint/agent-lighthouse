---
audit: agentic-commerce/cart-handoff-reachability
category: agentic-commerce
source_file: packages/core/src/audits/agentic-commerce/cart-handoff-reachability.ts
slug: cart-handoff-reachability
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - acp-openapi-cart
  - acp-openapi-checkout
  - s18
  - openai-searchbot-ips
  - acp-architecture
---

# Cart Handoff Reachability

> Shipped in v2. Evidence grade **B** · scored tier · unique · implementation: `multi-page`

## What it checks

Tests whether the storefront cart is reachable without an account and without a bot challenge. This is the page a computer-use agent drives, and the kind of page an ACP Cart API `continue_url` hands a buyer to.

The audit reads the platform's cart paths with a browser User-Agent and with ChatGPT-User. A Shopify store gets `/cart`, WooCommerce `/cart` and `/checkout`, BigCommerce `/cart.php`, Magento `/checkout/cart`. An unrecognised store gets `/cart` and `/checkout`. Every request is a GET. Nothing is added to a cart.

It fails on a 403 or 429, a redirect to a login path, a challenge page in place of the cart, or a challenge widget on a document with almost no readable text. It warns when the cart renders nothing without JavaScript. A path that robots.txt disallows for ChatGPT-User is not fetched.

The ACP `continue_url` itself is not probed. The Cart API returns it only from an authenticated `POST /carts`, which a read-only scan cannot make.

## Claimed mechanism (falsifiable)

Falsifiable claim: ACP 2026-04-17 adds a seller-hosted Cart API whose response carries a `continue_url` (e.g. https://seller.example.com/cart/cart_abc123) used to hand the buyer off to the seller's own checkout UI; this is the low-lift adoption path that requires no delegated payment. For merchants with no ACP integration at all, a computer-use shopping agent drives that same storefront cart directly. In both cases, if the cart or checkout URL 302s to a login page, or serves a CAPTCHA/bot-challenge on the checkout document, the handoff dead-ends at the final step after every upstream signal worked. ACP even reserves a message code `requires_sign_in` for the sign-in wall case. Disproof condition: agent handoffs completing normally through a login-walled cart.

## Evidence

- **[openapi.cart.yaml (spec version 2026-04-17)](https://raw.githubusercontent.com/agentic-commerce-protocol/agentic-commerce-protocol/main/spec/2026-04-17/openapi/openapi.cart.yaml)** — Agentic Commerce Protocol (spec, verified 2026-10-17)
  - Seller-hosted pre-checkout Cart API at https://seller.example.com: POST /carts, GET /carts/{id}, PUT /carts/{id} (full replacement), POST /carts/{id}/cancel. Required headers Authorization (Bearer) and API-Version (e.g. 2026-04-17); Idempotency-Key required on POST; Content-Type application/json on POST/PUT; optional Accept-Language, Request-Id. The cart response carries a `continue_url` (e.g. https://seller.example.com/cart/cart_abc123) used to hand the buyer off to the seller's own checkout UI. No payment configuration in this phase; expired carts return 404. This is the lower-lift adoption path versus full delegated-payment Instant Checkout.
- **[openapi.agentic_checkout.yaml (spec version 2026-04-17)](https://raw.githubusercontent.com/agentic-commerce-protocol/agentic-commerce-protocol/main/spec/2026-04-17/openapi/openapi.agentic_checkout.yaml)** — Agentic Commerce Protocol (spec, URL verified 2026-08-20)
  - CheckoutSession carries nine REQUIRED fields and three enums.
  - Required fields: id, status, currency, line_items, totals, fulfillment_options, messages, links, capabilities.
  - `links[].type`, expanded to 8 values: terms_of_use, privacy_policy, return_policy, shipping_policy, contact_us, about_us, faq, support.
  - `status`, 11 values: incomplete, not_ready_for_payment, requires_escalation, authentication_required, ready_for_payment, pending_approval, complete_in_progress, completed, canceled, in_progress, expired.
  - `totals[].type`, 12 values: items_base_amount, items_discount, subtotal, discount, fulfillment, tax, fee, gift_wrap, tip, store_credit, total, amount_refunded. Message error codes extended with low_stock, quantity_exceeded, coupon_invalid, coupon_expired, minimum_not_met, maximum_exceeded, region_restricted, age_verification_required, approval_required, unsupported, not_found, conflict, rate_limited, expired, intervention_required. API-Version is YYYY-MM-DD, required on all requests. Response headers Idempotency-Key and Request-Id are required echoes.
- **[OpenAI Bots / Crawler documentation](https://developers.openai.com/api/docs/bots)** — OpenAI (vendor-doc, URL verified 2026-08-20)
  - Four distinct user agents with separate robots.txt tokens and separate published IP-range files: OAI-SearchBot (surfaces sites in ChatGPT search — https://openai.com/searchbot.json), OAI-AdsBot (validates ad landing pages — https://openai.com/adsbot.json), GPTBot (model training — https://openai.com/gptbot.json), ChatGPT-User (user-initiated actions: web visits and GPT Actions — https://openai.com/chatgpt-user.json). ChatGPT-User is the agent that fetches on a shopper's behalf. Crucially these are separately controllable: blocking GPTBot does not block OAI-SearchBot or ChatGPT-User, and vice versa.
- **[ACP Concepts: Architecture](https://agenticcommerce.dev/docs/concepts/architecture)** — Agentic Commerce Protocol (spec, URL verified 2026-08-20)
  - Four roles: Buyer, Agent, Seller (merchant of record, implements Checkout API), Payment Provider (tokenizes credentials with allowance constraints). A negative result worth stating: the architecture documents no seller discovery mechanism — no registry, no .well-known URL, no automatic endpoint discovery. Seller onboarding is out-of-band/manual. This means any 'ACP endpoint discovery' audit check would be speculative today, and endpoint conformance testing must accept an operator-supplied base URL.

## Example failure

A store's /cart renders fine but /checkout issues a 302 to /account/login?checkout_url=... because guest checkout is disabled. Feed data, policy links and structured markup all score perfectly; the agent walks the buyer to a login form for an account they do not have and the purchase dies at the last click. Variant: Cloudflare Turnstile is mounted on the checkout document only, so every other page in the audit passes cleanly.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Implementation deviations

- Read-only. Every request is a GET. The audit never adds to cart, submits a
  form or follows a checkout button. It measures whether the cart document can
  be read, not whether a purchase completes.
- A robots.txt `Disallow` on a cart path is honoured. The path is listed in
  `details.disallowedByRobots` and never fetched.
- Two user agents, one request per path each: a browser UA and
  `ChatGPT-User`. Both go through the shared per-scan UA cache that
  `agent-ua-commerce-parity` also fills.
- `/cart.js` is not probed. It is a JSON endpoint, not the document a buyer
  is handed.
- BigCommerce and Magento get one candidate path each (`/cart.php`,
  `/checkout/cart`). Their checkout paths need a non-empty cart.
- Without a platform fingerprint, `/cart` and `/checkout` are still probed.
  When neither answers, the result is `notApplicable`. With a fingerprint, no
  answering path is a failure.
- The JS-only warning needs both halves: under 200 characters of visible text
  and no `<noscript>` content.
- A challenge fails only when it is the document. The shared
  `detectWafProtection` verdict reading the response as a challenge page fails.
  So does a widget mounted on a document under 200 characters of visible text.
  A widget on a readable cart passes, because it guards a form on the page.

## Deferred

- The ACP `continue_url` is never probed. Reaching it needs a Cart API
  session, credentials and a POST.
- A store that shows the cart to anonymous buyers but demands an account at
  the payment step reads as reachable.
- Edge blocks keyed on IP rather than UA are invisible to a UA-string probe.
