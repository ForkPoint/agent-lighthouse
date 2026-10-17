---
audit: agent-interfaces/openapi-operation-ids
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/openapi-operation-ids.ts
slug: openapi-operation-ids
evidence_grade: B
disposition: "keep — fix required; absorbs the naming rule of webmcp-tool-naming (5.23) as of 2026-08-22"
reviewed: 2026-08-22
sources:
  - ms-copilot-openapi-guidance
  - anthropic-define-tools
  - gemini-function-calling
  - openapi-31-spec
---

# openapi-operation-ids (`5.3`, naming rule of `5.23`)

> agent-interfaces · source `openapi-operation-ids.ts` · review verdict **fix** · evidence grade **B** · tier **scored** (weight 0.6) · now also the home of 5.23's naming rule

## What it checks

AI agents use operationIds as stable function names when calling your API. Without unique operationIds, agents must guess endpoint names from paths, leading to ambiguity and errors. An operationId that is not a legal function name — spaces, punctuation, or more than 64 characters — cannot be registered as a tool at all.

## Example failure

A site publishes `/openapi.json` whose operations carry
`operationId: "Get user's profile (v2)"`. The spaces, apostrophe and
parentheses put it outside `^[a-zA-Z0-9_-]{1,64}$`, so a tool-calling runtime
cannot register the name and the operation is unreachable.

A site that publishes no OpenAPI document — or one that declares no operations
— is **not** a failure here. There are no operationIds to judge, so the audit
returns "not applicable" and takes no weight off the score.

A document whose `paths` is present and yields nothing readable is a different
case. That document exists and is broken — `"paths": ["get","post"]` puts a
string where a path item belongs, `{"/x": {"get": "yes"}}` puts one where an
operation belongs — so it still fails, and the report names the defect. Absent
means absent; present-and-broken is a finding.

One broken entry does not erase the operations beside it. The ids that can be
read are checked, and any entry that could not be read is named in the report
rather than counted as a missing id.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** A tool-calling runtime uses `operationId` as the function name it exposes to the model, so duplicate ids collide into one name and ids that violate the runtime's function-name pattern (`^[a-zA-Z0-9_-]{1,64}$`) are rejected at tool-registration time.

**Grade: B** — a named agent is documented to turn operationIds into the functions it calls, and the function-name constraint is published API contract. But the specification makes operationId optional, and generators synthesize one from the method and path. Absence therefore degrades naming rather than breaking the call.

**Evidence:**

- Microsoft 365 Copilot states: "Operation IDs are unique identifiers for an operation in the API and are used by Copilot to create functions that are executed when responding to a user's prompt". It adds that "Operation IDs are shown during debugging as functions to indicate which operations Copilot is attempting to execute" — https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/openapi-document-guidance (verified 2026-08-21)
- Anthropic tool definitions: `name` "Must match the regex `^[a-zA-Z0-9_-]{1,64}$`" — an operationId carrying spaces, punctuation, or more than 64 characters cannot be registered verbatim as a tool name — https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools (verified 2026-08-21)
- Gemini function calling consumes only "a subset of the OpenAPI schema" and instructs "Use descriptive names without spaces or special characters" for function names — https://ai.google.dev/gemini-api/docs/function-calling (verified 2026-08-21)
- OpenAPI 3.1 on operationId: "Unique string used to identify the operation. The id MUST be unique among all operations described in the API", and "Tools and libraries MAY use the operationId to uniquely identify an operation, therefore, it is RECOMMENDED to follow common programming naming conventions" — https://spec.openapis.org/oas/v3.1.0.html (verified 2026-08-21)

**Counter-evidence:** `operationId` is optional in OpenAPI, and spec-to-tool converters routinely synthesize a name from the method and path when it is absent. A spec without operationIds is therefore degraded rather than unusable. That weakens the audit's `warn` on missing ids. Conversely the constraint that genuinely breaks registration (character legality and length) is documented at grade A yet is not measured by this audit at all, so the check is graded on a mechanism it only partially exercises. _(That last sentence is no longer true as of 2026-08-22 — see the fold below.)_

## Implementation deviations

- The audit absorbs the naming rule of `webmcp-tool-naming` (5.23) as a structural check: `operationId` must match `^[a-zA-Z0-9_-]{1,64}$`.
- An illegal id fails and is named in `found`. A runtime rejects it at registration. A missing or duplicate id only warns, since converters synthesize a name.
- No English-verb allowlist and no description-length floor. No source constrains naming style; `openapi-description-quality` owns descriptions.
- A dotted name such as `products.search` fails. `.` is outside the documented runtime pattern.
- No document, an unparseable 200, or a document with no operations is `notApplicable`. `openapi-endpoints` reports the empty document.
- `paths` is classified by `readOpenApiPaths` in `gatherers/openapi.ts`:
  - nothing readable and something broken is `malformed` and fails, naming the defect;
  - at least one readable operation is graded on what was read. An unwalkable entry is not counted as a missing id. Defects are named but do not change the verdict;
  - nothing broken and nothing declared is `empty`, and the audit declines.
- `x-` keys are skipped. Inside a path item only the eight method keys are judged.

## Deferred

- The shared read is JSON-only, so a YAML-only spec is invisible here.
- Duplicates are a counter. The colliding ids are not named.
- A naming check over a live MCP `tools/list` response.
