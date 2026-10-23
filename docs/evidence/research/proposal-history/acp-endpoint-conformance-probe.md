---
check: acp-endpoint-conformance-probe
title: "ACP Endpoint Conformance Probe"
domain: agentic-commerce
status: graduated
evidence_grade: A
uniqueness: unique
difficulty: operator-credential
scoring_tier: informative (weight 0)
reviewed: 2026-10-19
consumers:
  - ChatGPT (OpenAI) — calls the merchant's checkout endpoints with a bearer token, from published OpenAI IP ranges
---

# ACP Endpoint Conformance Probe

> Historical proposal. The authenticated probe is now registered as
> [agentic-commerce/acp-endpoint-conformance-probe](../../audits/agentic-commerce/acp-endpoint-conformance-probe.md).
> That dossier defines current behavior; the text below records the original plan.

## What it checks

For a merchant that runs Agentic Commerce Protocol (ACP) checkout endpoints, whether those endpoints honour the contracts ChatGPT relies on. With a merchant-issued sandbox token, it checks status codes, the error envelope, header echoes and the `CheckoutSession` shape. Without a token, it checks TLS only.

## Priority

ACP and UCP coverage is a product requirement. This authenticated ACP probe is
the first remaining commerce proposal. Public-site ACP checks already ship;
they do not establish checkout endpoint conformance. The
[proposal index](../../proposals/README.md#acp-and-ucp-coverage) records both protocols' scope.

## Prerequisites

Select a supported `API-Version` and its matching response schemas. Define an
operator-approved API origin, sandbox fixtures, token storage and redaction,
who may supply a token, and cleanup after an interrupted run.

`ScanOptions.headers` already supports HTTP headers, including bearer tokens.
It is not a merchant-token handling contract. The task server accepts `url`,
`snapshot` or `detectionId`; it has no merchant-token input. Public-address
validation does not authorize forwarding a token to another origin.

## Claimed mechanism (falsifiable)

ChatGPT calls five merchant-hosted endpoints, always with an `Authorization: Bearer` header and an `API-Version` header. The spec fixes what each returns: 201 on create, 404 for an unknown session, 405 on a session that cannot be cancelled, and an error object `{type, code, message, param?}` on any 4xx or 5xx. A merchant that returns something else breaks the flow that ChatGPT documents. Disproof: ChatGPT completing checkouts against endpoints that ignore these contracts.

## Evidence

- OpenAI's checkout spec names ChatGPT as the caller: "ChatGPT calls your `POST /checkout_sessions` to start a session". It states "All endpoints must use HTTPS and return JSON" and "All endpoints will be called with the following headers set", including `Authorization` and `API-Version`. Create: "All responses should be returned with a 201 status." Cancel: "the server should send back a response with status 405". Retrieve: "the server should return a response with status 404". Errors: "If the server is unable to return a 201 response, then it should return an error of the following shape with a 4xx/5xx status." — https://developers.openai.com/commerce/specs/checkout (verified 2026-10-19)
- OpenAI's production guide lists launch certification tests, among them error handling (`invalid_request / 400`) and idempotency (`idempotency_conflict with HTTP 409`). It requires "TLS 1.2 or later on port 443 with a valid public certificate". It tells merchants to "Allowlist OpenAI's IP addresses" — https://developers.openai.com/commerce/guides/production (verified 2026-10-19)
- ACP's OpenAPI file for 2026-04-17 applies `bearerAuth` to every operation. `Idempotency-Key` and `API-Version` are `required: true` request headers. The `Error` schema has `type` (enum `invalid_request`, `processing_error`, `service_unavailable`), `code`, `message`, and optional `param` as an "RFC 9535 JSONPath". `Idempotency-Key` and `Request-Id` response headers are described as "Echo of the request" on success responses only, and are not marked required. No 401 or 403 response is defined — https://raw.githubusercontent.com/agentic-commerce-protocol/agentic-commerce-protocol/main/spec/2026-04-17/openapi/openapi.agentic_checkout.yaml (verified 2026-10-19)
- ACP's security page: "All ACP endpoints use HTTPS and receive and respond to requests with JSON." "Authorization is currently managed between the agent and seller directly through bearer tokens." — https://agenticcommerce.dev/docs/concepts/security (verified 2026-10-19)
- ACP's seller guide: "ACP defines five REST endpoints." Since 2026-01-30 sellers "must declare your capabilities in every checkout response" — https://agenticcommerce.dev/docs/getting-started/sellers (verified 2026-10-19)
- ACP 2026-04-17 adds a discovery document at `/.well-known/acp.json`, per the release changelog. Its RFC states the document "MUST be publicly accessible without a Bearer token" and carries `api_base_url`. The RFC's own status line reads "Proposal". The path is not in the IANA Well-Known URIs registry (checked 2026-10-19) — https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/blob/main/rfcs/rfc.discovery.md (verified 2026-10-19)

## What is not proven

- No source says how ChatGPT handles an unauthenticated request, because ChatGPT never sends one. The 2026-08-20 unauthenticated suite (envelope on a 401, 404 and 405 probes without a token, header echo on error paths, malformed `API-Version`, CORS) tested a path the consumer does not take. It is dropped.
- The header-echo rule was overstated. The OpenAPI file describes the echo on success responses and does not mark it required. "MUST echo" appears in neither source.
- Most status-code rules are "should" in OpenAI's text, not "must".
- No consumer documents fetching `/.well-known/acp.json`. OpenAI's commerce docs do not mention it. A check on that document alone would be grade C.
- The live population is unknown. OpenAI's Apps SDK states that "the recommended and generally available approach is to use external checkout", and that checkout with the ChatGPT payment sheet is in "private beta" (https://developers.openai.com/apps-sdk/build/monetization, verified 2026-10-19). Secondary reports say OpenAI scaled back Instant Checkout in March 2026. OpenAI's own post on that change returned HTTP 403 to the fetcher, so it is not verified here.

## Counter-evidence and limits

- OpenAI tells merchants to allowlist its IP ranges. A correctly configured endpoint may refuse a scanner at the network edge. A gateway HTML 403 to an unknown IP is then the intended result, not a defect. The 2026-08-20 example failure described exactly that case as a bug.
- OpenAI runs its own certification before launch. A merchant that is live in ChatGPT has already passed those tests. The probe adds value for merchants before certification, or after a change.

## Competitor coverage

No public ACP conformance runner is known. OpenAI certifies integrations privately. The ACP repository ships OpenAPI, JSON Schema and OpenRPC files, with no runner.

## Implementation sketch

Two tiers remain to be built:

1. **No token.** Check TLS on the operator-approved merchant API host. If a
   discovery document supplies `api_base_url`, validate that URL with
   `isSafeUrl()` and require origin approval before using a credential.
   Without an approved base URL, skip endpoint conformance.
2. **Merchant-issued sandbox token.** Use an explicitly selected protocol
   version, test products and sandbox fixtures. Create a session and validate
   its status and `CheckoutSession` schema. Retrieve an unknown id and validate
   the `404` error. Test cancellation of an operator-supplied completed session;
   skip that branch if no such fixture exists. A second cancellation can test
   the already-canceled branch instead. Never call `/complete`.
3. **Response rules.** Require `capabilities` only where the selected checkout
   response schema requires it. Validate protocol errors against `Error`.
   Check header echoes as observations unless the selected contract requires
   them. Use a new idempotency key per test, then change the body under the same
   key for the conflict test. Do not reuse keys across runs.
4. **Version conflict.** ACP 2026-04-17 specifies `422` for a changed-body
   idempotency conflict and `409` for an in-flight collision. OpenAI's production
   guide specifies `409` for parameter mismatch. Select the intended contract;
   do not accept either status without naming that contract.
5. **Execution safety.** Bind the token to the approved origin. Apply
   `isSafeUrl()` on discovered URLs and redirects. Do not forward credentials
   across origins without explicit authorization. Clean up sessions created by
   the probe, including interrupted runs. Creation writes session state;
   inventory reservation depends on the merchant and is not a universal claim.

The status-code difference is documented in the
[ACP 2026-04-17 changelog](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/blob/main/changelog/2026-04-17.md)
and [OpenAI's production guide](https://developers.openai.com/commerce/guides/production)
(verified 2026-10-23).

## Example failure

With a sandbox token, `GET /checkout_sessions/acp_probe_unknown` returns HTTP 500 and an HTML page. OpenAI's spec says it should return 404 and the error object. ChatGPT cannot tell a missing session from a broken server.

## Scoring

Tier: **informative (weight 0)**. Grade A covers the authenticated tier, but its verdict depends on a credential only some operators can supply. Two scans of the same site would then score differently. That is a design reason, not an evidence reason. Revisit when credential handling exists.

## Implementation deviations

- The unauthenticated probe suite is dropped. Only the TLS check remains without a token.
- `difficulty` changed from `static-fetch` to `operator-credential`. Discovery now exists for sites that publish `acp.json`, so the base URL is no longer the blocker.

## Deferred

- A separate check on `/.well-known/acp.json` itself (grade C, no documented consumer) is not proposed here.
- Primary confirmation of OpenAI's March 2026 checkout change.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
- 2026-10-19 — evidence review. Grade A kept, but only for an authenticated tier. The unauthenticated suite is dropped: ChatGPT always authenticates and calls from allowlisted IPs, and no 401 or 403 contract is defined. The claim that ACP has no discovery mechanism was false: ACP 2026-04-17 defines `/.well-known/acp.json`. The claim that responses "MUST echo" two headers was not in either source. Added OpenAI's production guide (certification, TLS, IP allowlist) and the Apps SDK monetization page. Removed the architecture page, which is silent on discovery, and the repository listing, which no claim needs.

- 2026-10-23 — corrected the existing header transport and task-input description; added version selection, response-specific validation and sandbox prerequisites.

- 2026-10-23 — graduated to a registered informative sandbox audit. Moved this proposal to research history; the registered dossier owns current behavior and limits.
