---
check: acp-endpoint-conformance-probe
title: "ACP Endpoint Conformance Probe"
domain: agentic-commerce
status: proposed
evidence_grade: A
uniqueness: unique
difficulty: static-fetch
scoring_tier: informative (weight 0)
reviewed: 2026-08-20
---

# ACP Endpoint Conformance Probe

> Proposed check. Evidence grade **A** · unique · implementation: `static-fetch`

## What it checks

For merchants who have already stood up ACP endpoints, a non-destructive unauthenticated conformance suite against the five checkout paths — error-envelope shape, required header echoes, API-Version handling and status-code contracts.

## Claimed mechanism (falsifiable)

Falsifiable claim: the spec fixes exact contracts that can be tested WITHOUT authenticating. Endpoints must be HTTPS and JSON. Errors must return the envelope {type, code, message, param?} rather than an HTML error page. Responses MUST echo Idempotency-Key and Request-Id. GET /checkout_sessions/{unknown} must return 404; /cancel must return 405 when not cancelable; POST /checkout_sessions returns 201 on success. API-Version is a required YYYY-MM-DD header. A merchant failing these fails silently in production because the agent sees a malformed error and cannot distinguish 'out of stock' from 'your integration is broken'. Disproof condition: agents tolerating HTML error bodies where the envelope is specified.

## Evidence

- **[openapi.agentic_checkout.yaml (spec version 2026-04-17)](https://raw.githubusercontent.com/agentic-commerce-protocol/agentic-commerce-protocol/main/spec/2026-04-17/openapi/openapi.agentic_checkout.yaml)** — Agentic Commerce Protocol (spec, URL verified 2026-08-20)
  - CheckoutSession REQUIRED fields (9): id, status, currency, line_items, totals, fulfillment_options, messages, links, capabilities. links[].type enum expanded to 8 values: terms_of_use, privacy_policy, return_policy, shipping_policy, contact_us, about_us, faq, support. status enum (11): incomplete, not_ready_for_payment, requires_escalation, authentication_required, ready_for_payment, pending_approval, complete_in_progress, completed, canceled, in_progress, expired. totals[].type enum (12): items_base_amount, items_discount, subtotal, discount, fulfillment, tax, fee, gift_wrap, tip, store_credit, total, amount_refunded. Message error codes extended with low_stock, quantity_exceeded, coupon_invalid, coupon_expired, minimum_not_met, maximum_exceeded, region_restricted, age_verification_required, approval_required, unsupported, not_found, conflict, rate_limited, expired, intervention_required. API-Version is YYYY-MM-DD, required on all requests. Response headers Idempotency-Key and Request-Id are required echoes.
- **[Agentic Checkout Specification](https://developers.openai.com/commerce/specs/checkout/)** — OpenAI / Stripe (Agentic Commerce Protocol) (spec, URL verified 2026-08-20)
  - Five merchant-hosted HTTPS+JSON endpoints: POST /checkout_sessions (201), POST /checkout_sessions/{checkout_session_id}, POST /checkout_sessions/{id}/complete, POST /checkout_sessions/{id}/cancel (405 if not cancelable), GET /checkout_sessions/{id} (404 if absent). Request headers: Authorization, Accept-Language, User-Agent, Idempotency-Key, Request-Id, Content-Type, Signature, Timestamp (RFC 3339), API-Version. Response MUST echo Idempotency-Key and Request-Id. Session object carries id, status, currency (lowercase ISO 4217), line_items, fulfillment_options, totals, messages, links, payment_provider. Error envelope: {type, code, message, param(JSONPath)}. Message error codes include missing, invalid, out_of_stock, payment_declined, requires_sign_in, requires_3ds. Link types include terms_of_use, privacy_policy, seller_shop_policies.
- **[ACP Concepts: Architecture](https://agenticcommerce.dev/docs/concepts/architecture)** — Agentic Commerce Protocol (spec, URL verified 2026-08-20)
  - Four roles: Buyer, Agent, Seller (merchant of record, implements Checkout API), Payment Provider (tokenizes credentials with allowance constraints). IMPORTANT NEGATIVE RESULT: the architecture documents no seller discovery mechanism — no registry, no .well-known URL, no automatic endpoint discovery. Seller onboarding is out-of-band/manual. This means any 'ACP endpoint discovery' audit check would be speculative today, and endpoint conformance testing must accept an operator-supplied base URL.
- **[ACP Concepts: Security](https://agenticcommerce.dev/docs/concepts/security)** — Agentic Commerce Protocol (spec, URL verified 2026-08-20)
  - All ACP endpoints use HTTPS and send/receive JSON. Bearer-token authentication between agent and seller; sellers retrieve tokens through the agent's application. Mandatory headers: Authorization: Bearer <token>, Content-Type: application/json, Accept: application/json.
- **[agentic-commerce-protocol repository](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol)** — Agentic Commerce Protocol (OpenAI + Stripe, Apache 2.0) (repo, URL verified 2026-08-20)
  - Date-versioned spec releases: 2025-09-29 (initial), 2025-12-12 (fulfillment), 2026-01-16 (capability negotiation), 2026-01-30 (extensions, discounts, payment handlers), 2026-04-17 (current stable: cart, feed, orders, authentication, MCP), plus unreleased/. Artifacts under spec/<version>/: openapi/, json-schema/, openrpc/. openapi/ for 2026-04-17 contains openapi.agentic_checkout.yaml, openapi.agentic_checkout_webhook.yaml, openapi.cart.yaml, openapi.delegate_authentication.yaml, openapi.delegate_payment.yaml, openapi.feed.yaml. No .well-known or discovery mechanism anywhere in the repo.
- **[ACP Getting Started: Sellers](https://agenticcommerce.dev/docs/getting-started/sellers)** — Agentic Commerce Protocol (spec, URL verified 2026-08-20)
  - Seller obligations: implement the five HTTPS/JSON checkout endpoints; calculate all amounts (item prices, discounts, taxes, shipping); manage inventory and availability; process payments through their PSP; fulfil orders. Sellers must declare capabilities in EVERY checkout response, including payment handlers (handler id, name, version, PSP reference, configuration) and optional extensions. Sellers must validate payment handler IDs against declared capabilities and manage state transitions to ready_for_payment.

## Competitor coverage

There is no published ACP conformance tester from anyone, including OpenAI and Stripe — the repo ships OpenAPI/JSON-Schema/OpenRPC artifacts but no runner. Lighthouse and every SEO vendor are entirely absent from this layer. This is the strongest pure-differentiation item in the set, at the cost of applying only to merchants who have already integrated.

## Implementation sketch

Requires an operator-supplied base URL, because ACP defines NO discovery mechanism — the architecture docs confirm seller onboarding is out-of-band with no registry and no .well-known path, so nothing can be auto-discovered and it is dishonest to pretend otherwise. Given a base URL, run read-only and unauthenticated probes: (1) TLS validity and HTTPS-only, reject plaintext or invalid chain. (2) POST /checkout_sessions with no Authorization header and a minimal body — expect 401/403, Content-Type application/json, and a body parsing to {type, code, message} with optional param as an RFC 9535 JSONPath string; FAIL on an HTML body, which is the most common real defect. (3) GET /checkout_sessions/acp_probe_nonexistent — expect 404 plus the same envelope. (4) POST /checkout_sessions/acp_probe_nonexistent/cancel — expect 404 or 405, never 500. (5) Header echo: send Idempotency-Key and Request-Id and assert both are echoed in the response headers even on the error path. (6) API-Version: send a well-formed YYYY-MM-DD value and assert it is not rejected; send a malformed one and assert a 400 with the envelope rather than a 500. (7) Assert no CORS wildcard on a credentialed endpoint. OPTIONAL authenticated tier when the merchant supplies a sandbox token: assert the CheckoutSession carries all 9 required fields (id, status, currency, line_items, totals, fulfillment_options, messages, links, capabilities), that status is within the 11-value enum, totals[].type within the 12-value enum, links[].type within the 8-value enum, currency lowercase, and that capabilities.payment.handlers is populated as the seller-declaration requirement demands. Marked scoreable=false because penalising the ~99 percent of merchants with no ACP integration would be meaningless; report it as an informational module that activates on configuration.

## Example failure

A merchant's ACP endpoint sits behind an API gateway that returns the gateway's default HTML 403 page for unauthenticated requests and drops the Request-Id header entirely. Every happy-path integration test the merchant wrote passes, but in production the agent receives unparseable errors, cannot correlate traces, and retries non-idempotently — surfacing to buyers as duplicate charge risk rather than as a clean `invalid` message.

## Scoring

Tier per evidence policy: **informative (weight 0)** — grade A does not meet the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
