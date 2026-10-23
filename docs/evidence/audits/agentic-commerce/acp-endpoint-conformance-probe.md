---
audit: agentic-commerce/acp-endpoint-conformance-probe
category: agentic-commerce
source_file: packages/core/src/audits/agentic-commerce/acp-endpoint-conformance-probe.ts
slug: acp-endpoint-conformance-probe
evidence_grade: A
tier: informative
disposition: "new — explicit ACP 2026-04-17 sandbox endpoint checks"
consumers:
  - ChatGPT (OpenAI) — authenticated merchant checkout requests
recommended_tier: informative
reviewed: 2026-10-23
sources:
  - acp-checkout-2026-04-17
  - acp-checkout-openai
  - openai-commerce-production
---

# ACP sandbox checkout conformance

## What it checks

An operator must configure an explicit HTTPS sandbox API base URL, acknowledge sandbox use, name an environment variable for the bearer token, select `2026-04-17`, and supply test items and a currency. The library accepts `acpSandbox`. The CLI reads the same object from its configuration file. Normal scans make no ACP mutation requests.

The probe creates a session, retrieves it, replays the exact create request with its idempotency key, changes the body under that key, retrieves an unknown session, and cancels the created session. It checks the expected HTTP status and validates response bodies with the bundled official Draft 2020-12 schema. It checks replay identity, `idempotency_conflict`, and cancellation state.

An optional `completedSessionId` fixture enables the completed-session cancellation check. The probe first verifies that fixture's identity and completed state with GET. It then expects 405 with the Error schema. It never calls `/complete`.

## Why it matters

Checkout clients need predictable session and idempotency behavior. Sandbox probes can verify operations that read-only website scans cannot assess.

## Evidence

The official [ACP 2026-04-17 checkout OpenAPI contract](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/blob/main/spec/2026-04-17/openapi/openapi.agentic_checkout.yaml) defines the operations, status codes, API version header, and idempotency errors (verified 2026-10-23). The adjacent official [bundled JSON Schema](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/blob/main/spec/2026-04-17/json-schema/schema.agentic_checkout.json) defines nested session and Error fields (verified 2026-10-23).

OpenAI documents ChatGPT calling authenticated merchant checkout endpoints in
its [checkout guide](https://developers.openai.com/commerce/specs/checkout)
(verified 2026-10-23). This establishes the consumer path for grade A. The
selected release's status-code contract differs from OpenAI's
[production guide](https://developers.openai.com/commerce/guides/production),
which uses 409 for parameter mismatch (verified 2026-10-23). This audit explicitly
tests the ACP 2026-04-17 contract with 422; it does not certify compatibility with
every consumer version. The tier remains informative because the test requires explicit sandbox authorization and covers a limited set of operations. Its weight is 0.

## Limits

This is a pinned endpoint probe, not full ACP certification. It does not test payment, completion, updates, webhooks, production access, every error path, or merchant-specific business rules. It validates the published schema as written. It does not repair upstream schema limits. A completed fixture remains explicitly untested when absent.

The token stays in private per-request headers. Redirects never follow. Responses and exceptions never publish raw merchant text. Findings contain fixed labels and bounded paths from the local schema. A refused, unauthorized, redirected, aborted, or unreachable request produces incomplete evidence. It does not prove a merchant defect.

Cleanup uses a separate 5 s signal. It attempts cancellation for every observed safe session ID. An uncertain create outcome or failed cleanup prevents a complete result. Unsafe or token-bearing session IDs cannot enter request URLs. An operator must resolve any unknown creation outcome in the sandbox. The result supplies a scanner-generated `recoveryKey` when cleanup remains uncertain. Merchant request logs can use this create idempotency key to locate the session.

## How it scores

No sandbox configuration returns notApplicable. Complete tested operations with no mismatch return pass. Contract mismatches return an informative warning. Incomplete evidence returns a warning without a merchant conformance verdict. Every result has weight 0.

## Example finding

`create: response schema mismatch` reports a nested field that does not match the pinned schema. The finding does not include the response text, request payload, token, or merchant error message.

## Sources

- [ACP checkout contract and response schemas, 2026-04-17](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/tree/main/spec/2026-04-17) (verified 2026-10-23).

## Implementation deviations

None.

## Deferred

Payment and completion remain outside this probe's scope. No live merchant sandbox scan forms part of deterministic tests.
