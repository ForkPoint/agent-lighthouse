---
audit: agent-tools/openapi-operation-ids
audit_id: "5.3"
category: agent-tools
source_file: packages/core/src/audits/agent-tools/openapi-operation-ids.ts
slug: openapi-operation-ids
review_verdict: fix
severity: medium
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# openapi-operation-ids (`5.3`)

> agent-tools · source `openapi-operation-ids.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

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
