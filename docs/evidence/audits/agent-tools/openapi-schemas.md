---
audit: agent-tools/openapi-schemas
audit_id: "5.6"
category: agent-tools
source_file: packages/core/src/audits/agent-tools/openapi-schemas.ts
slug: openapi-schemas
review_verdict: fix
severity: medium
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# openapi-schemas (`5.6`)

> agent-tools · source `openapi-schemas.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

## What it checks

Without request/response schemas, AI agents must guess the data format for your endpoints. This leads to malformed requests and failed API calls. Define JSON schemas for all request bodies and responses.

## Code review findings (2026-08-20, 11-agent pass)

Valuable signal — agents need request/response shapes to build valid calls — but the traversal never resolves $ref, so the largest and best-maintained real-world specs (which put everything in components) score near zero, and it demands schemas from operations that correctly have none.

**Required fix:** Resolve local `$ref` pointers (a shallow `#/components/...` walk covers nearly all real specs) before deciding a response or requestBody lacks a schema. Exclude from the denominator: operations whose only declared responses are 204/205/304, plus HEAD/OPTIONS/DELETE. Treat a POST/PUT/PATCH with no `requestBody` key at all as intentionally bodyless rather than as a missing schema, and only flag a `requestBody` that exists but has no schema.

**False-positive risks:**
- No `$ref` resolution anywhere. `"responses": {"200": {"$ref": "#/components/responses/PetList"}}` — the canonical, DRY way to write a spec — is `isObject`, has no `content` key, and is silently counted as having no schema. Large real specs (Stripe, GitHub, Twilio style) would report 'Low schema coverage' at 0%.
- `withResponseSchema` is compared against `totalCheckable = ops.length`, so an operation that legitimately returns no body — `DELETE` returning 204, `HEAD`, `OPTIONS` — can never be satisfied. Any spec with DELETE endpoints is mathematically prevented from passing.
- `writeMethods` counts every POST/PUT/PATCH as needing a requestBody, but bodyless POSTs are normal (`POST /sessions/{id}/logout`, `POST /jobs/{id}/retry`). Each one is an unfixable deduction.
- Non-JSON media types are handled by `Object.values(content)` generically, which is right, but `multipart/form-data` upload endpoints and `text/csv` exports still need a schema under this rule and often don't have one — flagged as a defect when it is not.
- Same JSON-only loader bug: YAML specs report 'No spec'.

**Test gaps:**
- No `$ref` fixture anywhere in the 268-line test file — the single most impactful gap
- No 204/No-Content response fixture
- No bodyless-POST fixture
- No `components/schemas` + `allOf`/`oneOf` composition fixture
- No YAML fixture

**Overlaps with:** `5.2`, `5.26`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
