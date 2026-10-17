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

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

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

- No document, an unparseable 200, or a document with no operations is `notApplicable`. No coverage is measured there. `openapi-endpoints` reports the empty document.
- `paths` is classified by `readOpenApiPaths` in `gatherers/openapi.ts`:
  - nothing readable and something broken is `malformed` and fails, naming the defect;
  - at least one readable operation is graded on what was read. Coverage is a ratio over readable operations only. Defects are named but do not change the verdict;
  - nothing broken and nothing declared is `empty`, and the audit declines.
- `x-` keys are skipped. Inside a path item only the eight method keys are judged.
- A media type's `schema` counts when present, including a `{"$ref": ...}` schema. The reference is not resolved.

## Deferred

- A response object that is itself a `$ref` (to `components/responses`) is counted as schema-less.
- 204, `HEAD` and `OPTIONS` operations stay in the denominator. Bodyless `POST`s count against `writeMethods`.
- The read is JSON-only.
