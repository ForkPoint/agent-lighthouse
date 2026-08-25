---
audit: agent-interfaces/openapi-schemas
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/openapi-schemas.ts
slug: openapi-schemas
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - anthropic-define-tools
  - openai-function-calling
  - ms-copilot-openapi-guidance
  - gemini-function-calling
---

# openapi-schemas (`5.6`)

> agent-tools · source `openapi-schemas.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

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
- 2026-08-21 — evidence graded (see below).

## Evidence (2026-08-21)

**Mechanism claim:** The JSON Schema under an operation's `requestBody`/`responses` `content` is what a tool-calling runtime turns into the tool's input schema and what the model uses to interpret the reply, so an operation with no schema forces the model to guess the payload shape.

**Grade: B** — every documented tool-calling runtime defines its parameters as JSON Schema and a named agent (Microsoft 365 Copilot) is documented to read the spec's parameters and responses for exactly this purpose; the response-side half is documented as an aid to interpretation rather than a requirement for the call to succeed.

**Evidence:**
- Anthropic tool definitions take `input_schema`, "A JSON Schema object defining the expected parameters for the tool" — the request-body schema is what becomes that object when a spec is converted — https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools (verified 2026-08-21)
- OpenAI function calling: a function's `parameters` are "defined by a JSON schema", supporting "property types, enums, descriptions, nested objects" — https://developers.openai.com/api/docs/guides/function-calling (verified 2026-08-21)
- Microsoft 365 Copilot states: "Parameters are used by Copilot to get all the required information from a user's prompt for making a request to the API." It also asks authors to "Clearly define all possible responses for each operation … Including examples of responses helps Copilot to understand what to expect from the API" — https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/openapi-document-guidance (verified 2026-08-21)
- Gemini function declarations accept only "a subset of the OpenAPI schema", so schema shape directly determines whether an operation can be exposed at all — https://ai.google.dev/gemini-api/docs/function-calling (verified 2026-08-21)

**Counter-evidence:** Microsoft's own recommended response example is written as `schema: $ref: '#/components/schemas/Repair'` — the reference form this audit's traversal cannot resolve, so the best-documented way to satisfy the mechanism is scored as failing it. No source states that a response schema is required for a call to succeed: the request-side schema carries the documented weight, while response schemas improve interpretation. Operations that legitimately return no body (`204`, `HEAD`, `OPTIONS`) and bodyless `POST`s are normal API design, so the coverage ratio this audit computes overstates the mechanism's reach.
