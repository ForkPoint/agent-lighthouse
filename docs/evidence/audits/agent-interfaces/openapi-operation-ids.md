---
audit: agent-interfaces/openapi-operation-ids
audit_id: "5.3"
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/openapi-operation-ids.ts
slug: openapi-operation-ids
review_verdict: fix
severity: medium
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# openapi-operation-ids (`5.3`)

> agent-tools · source `openapi-operation-ids.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

## What it checks

AI agents use operationIds as stable function names when calling your API. Without unique operationIds, agents must guess endpoint names from paths, leading to ambiguity and errors. Use descriptive camelCase names.

## Code review findings (2026-08-20, 11-agent pass)

Genuinely useful signal — LLM tool-calling maps operationId to the function name, and OpenAI/Anthropic function names must match ^[a-zA-Z0-9_-]{1,64}$ — but the audit checks only presence and uniqueness, missing the constraint that actually breaks tool generation, and inherits the JSON-only loader bug.

**Required fix:** Use the shared loader. Add a legality check against `^[a-zA-Z0-9_-]{1,64}$` and fail/warn on violations with the offending ids listed in `details`. Fix duplicate accounting to report the set of colliding ids (`Map<id, count>`) rather than an incremented counter. Return `notApplicable()` rather than `fail` when there is no spec.

**False-positive risks:**
- Same YAML blind spot: local `getOpenApiSpec()` reads only `/openapi.json`, so YAML specs get 'No spec' at `medium` priority despite 5.1 passing.
- Duplicate counting is wrong: `if (ids.has(id)) duplicates++ else ids.add(id)` counts a triplicated id as 2 duplicates and never names which ids collide, so `found` says '2 duplicate(s)' with no way to locate them.
- Does not validate the operationId is a legal LLM function name. `operationId: "Get user's profile (v2)"` is unique and present → PASSES, but breaks OpenAI/Anthropic tool registration on spaces, apostrophes, parens, and >64 chars. The audit's own description promises 'stable function names' and does not check them.
- Missing operationId is a `warn`, but modern converters synthesize `get_pets_petId` from method+path, so a spec without operationIds is degraded, not broken — the fixed `medium` priority overstates it while the real breakage (illegal characters) is unflagged.

**Test gaps:**
- No fixture with an operationId containing spaces/punctuation or exceeding 64 characters
- No fixture with three identical operationIds to expose the off-by-one duplicate count
- No YAML-spec fixture
- No assertion that the offending operationIds are named in `found`/`details`

**Overlaps with:** `5.1`, `5.2`, `5.26`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
- 2026-08-21 — evidence graded (see below).

## Graded evidence (2026-08-21)

**Mechanism claim:** A tool-calling runtime uses `operationId` as the function name it exposes to the model, so duplicate ids collide into one name and ids that violate the runtime's function-name pattern (`^[a-zA-Z0-9_-]{1,64}$`) are rejected at tool-registration time.

**Grade: B** — a named agent is documented to turn operationIds into the functions it calls, and the function-name constraint is published API contract, but the specification makes operationId optional and generators synthesize one from method + path, so absence degrades naming rather than breaking the call.

**Evidence:**
- Microsoft 365 Copilot: "Operation IDs are unique identifiers for an operation in the API and are used by Copilot to create functions that are executed when responding to a user's prompt … Operation IDs are shown during debugging as functions to indicate which operations Copilot is attempting to execute" — https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/openapi-document-guidance (verified 2026-08-21)
- Anthropic tool definitions: `name` "Must match the regex `^[a-zA-Z0-9_-]{1,64}$`" — an operationId carrying spaces, punctuation, or more than 64 characters cannot be registered verbatim as a tool name — https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools (verified 2026-08-21)
- Gemini function calling consumes only "a subset of the OpenAPI schema" and instructs "Use descriptive names without spaces or special characters" for function names — https://ai.google.dev/gemini-api/docs/function-calling (verified 2026-08-21)
- OpenAPI 3.1 on operationId: "Unique string used to identify the operation. The id MUST be unique among all operations described in the API", and "Tools and libraries MAY use the operationId to uniquely identify an operation, therefore, it is RECOMMENDED to follow common programming naming conventions" — https://spec.openapis.org/oas/v3.1.0.html (verified 2026-08-21)

**Counter-evidence:** `operationId` is optional in OpenAPI, and spec-to-tool converters routinely synthesize a name from the method and path when it is absent, so a spec without operationIds is degraded rather than unusable — which weakens the audit's `warn` on missing ids. Conversely the constraint that genuinely breaks registration (character legality and length) is documented at grade A yet is not measured by this audit at all, so the check is graded on a mechanism it only partially exercises.
