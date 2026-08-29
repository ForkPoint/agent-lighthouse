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

## Example failure

A site publishes `/openapi.json` whose `POST /contact` operation declares no
`requestBody` schema and whose responses declare no `content` schema. An agent
must guess the field names and types to send, and cannot tell what came back.

A site that publishes no OpenAPI document — or one that declares no operations
— is **not** a failure here. Schema coverage was never measured, so the audit
returns "not applicable" and takes no weight off the score.

A document whose `paths` is present and yields nothing readable is a different
case. That document exists and is broken — `"paths": ["get","post"]` puts a
string where a path item belongs, `{"/x": {"get": "yes"}}` puts one where an
operation belongs — so it still fails, and the report names the defect. Absent
means absent; present-and-broken is a finding.

One broken entry does not erase the operations beside it. Coverage is measured
over the operations that can be read, and any entry that could not be read is
named in the report rather than counted against the ones that could.

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

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
- 2026-08-21 — evidence graded (see below).

## Evidence (2026-08-21)

**Mechanism claim:** The JSON Schema under an operation's `requestBody` and `responses` `content` is what a tool-calling runtime turns into the tool's input schema, and what the model uses to interpret the reply. An operation with no schema therefore forces the model to guess the payload shape.

**Grade: B** — every documented tool-calling runtime defines its parameters as JSON Schema, and one named agent, Microsoft 365 Copilot, is documented to read the spec's parameters and responses for exactly this purpose. The response-side half is documented as an aid to interpretation, rather than a requirement for the call to succeed.

**Evidence:**
- Anthropic tool definitions take `input_schema`, "A JSON Schema object defining the expected parameters for the tool" — the request-body schema is what becomes that object when a spec is converted — https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools (verified 2026-08-21)
- OpenAI function calling: a function's `parameters` are "defined by a JSON schema", supporting "property types, enums, descriptions, nested objects" — https://developers.openai.com/api/docs/guides/function-calling (verified 2026-08-21)
- Microsoft 365 Copilot states: "Parameters are used by Copilot to get all the required information from a user's prompt for making a request to the API." It also asks authors to "Clearly define all possible responses for each operation … Including examples of responses helps Copilot to understand what to expect from the API" — https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/openapi-document-guidance (verified 2026-08-21)
- Gemini function declarations accept only "a subset of the OpenAPI schema", so schema shape directly determines whether an operation can be exposed at all — https://ai.google.dev/gemini-api/docs/function-calling (verified 2026-08-21)

**Counter-evidence:** Microsoft's own recommended response example is written as `schema: $ref: '#/components/schemas/Repair'` — the reference form this audit's traversal cannot resolve, so the best-documented way to satisfy the mechanism is scored as failing it. No source states that a response schema is required for a call to succeed: the request-side schema carries the documented weight, while response schemas improve interpretation. Operations that legitimately return no body (`204`, `HEAD`, `OPTIONS`) and bodyless `POST`s are normal API design, so the coverage ratio this audit computes overstates the mechanism's reach.

## Implementation deviations

**2026-08-29 — absence is `notApplicable`, not `fail`.** The audit returned
`fail` at `priority: 'medium'` on a site with no OpenAPI document, and again on
a document declaring no operations. Neither is a schema-coverage finding: no
coverage was ever measured. Both now return `notApplicable`. Nothing in this
dossier's evidence documents a consumer that is worse off for the absence of a
document, and `agent-interfaces/openapi-endpoints` is the audit that reports an
empty one.

Every coverage verdict on a document with operations is unchanged. Low
coverage still `fail`s, partial coverage still `warn`s, and full coverage still
passes. That is what carries the grade B.

**The read moved to `packages/core/src/gatherers/openapi.ts`**, shared with the
six other audits that had a byte-identical copy of it, along with the `paths`
traversal. The precondition lives beside the read; `gatherers/openapi.ts`
records why it is not a runner precondition and not an `EvidenceKey`.

**A 200 with an unparseable body is treated as an absence**, because it is a
document this audit never read.

**Present and broken is not absent.** `paths` is classified in one place,
`readOpenApiPaths` in `gatherers/openapi.ts`. It separates what it could read
from what was defective, and the verdict follows what survives:

- Nothing readable and something broken — `paths` is not a Paths Object, or
  every entry under it is defective — is `malformed`, and it `fail`s with the
  defect named in `found`. The message ("no operation's schemas can be read") is literally
  true in that state and only in that state.
- At least one readable operation is graded on the operations it read. Coverage is a ratio over the readable operations; an entry no agent can walk declares no schemas and is not in the denominator.
  The defects are named in the message and counted in `found`; they do not
  change the verdict, because no source says a broken sibling entry costs a
  site the operations it does publish. Released `main` graded such a document
  on its readable operations and so does this audit.
- Nothing broken and nothing declared is `empty`, and this audit declines.
  `{"/x": {}}` is legal OpenAPI that lands there.

A defect counts at either level: a non-object where a Path Item Object belongs
and a non-object where an Operation Object belongs are the same error one level
apart, so `{"/x": {"get": "yes"}}` is a broken document. Specification-extension
keys (`x-`) are skipped rather than judged — OpenAPI 3.1 §4.8.8 lets them hold
any value — and inside a path item only the eight method keys are judged,
because `summary`, `parameters`, `servers` and `$ref` are legal members that
are not Operation Objects.

## Deferred

The standing required fix is untouched: `$ref` responses are still counted as
schema-less, 204/HEAD/OPTIONS operations are still in the denominator, bodyless
`POST`s still count against `writeMethods`, and the read is still JSON-only.
