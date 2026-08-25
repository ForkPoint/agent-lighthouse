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
- 2026-08-22 — absorbs the naming rule of 5.23 (Plan 4, Task 9); `webmcp-tool-naming` is deleted and its runtime half is deferred out of v2.0. Registry 149 → 148.

## Evidence (2026-08-21)

**Mechanism claim:** A tool-calling runtime uses `operationId` as the function name it exposes to the model, so duplicate ids collide into one name and ids that violate the runtime's function-name pattern (`^[a-zA-Z0-9_-]{1,64}$`) are rejected at tool-registration time.

**Grade: B** — a named agent is documented to turn operationIds into the functions it calls, and the function-name constraint is published API contract, but the specification makes operationId optional and generators synthesize one from method + path, so absence degrades naming rather than breaking the call.

**Evidence:**
- Microsoft 365 Copilot: "Operation IDs are unique identifiers for an operation in the API and are used by Copilot to create functions that are executed when responding to a user's prompt … Operation IDs are shown during debugging as functions to indicate which operations Copilot is attempting to execute" — https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/openapi-document-guidance (verified 2026-08-21)
- Anthropic tool definitions: `name` "Must match the regex `^[a-zA-Z0-9_-]{1,64}$`" — an operationId carrying spaces, punctuation, or more than 64 characters cannot be registered verbatim as a tool name — https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools (verified 2026-08-21)
- Gemini function calling consumes only "a subset of the OpenAPI schema" and instructs "Use descriptive names without spaces or special characters" for function names — https://ai.google.dev/gemini-api/docs/function-calling (verified 2026-08-21)
- OpenAPI 3.1 on operationId: "Unique string used to identify the operation. The id MUST be unique among all operations described in the API", and "Tools and libraries MAY use the operationId to uniquely identify an operation, therefore, it is RECOMMENDED to follow common programming naming conventions" — https://spec.openapis.org/oas/v3.1.0.html (verified 2026-08-21)

**Counter-evidence:** `operationId` is optional in OpenAPI, and spec-to-tool converters routinely synthesize a name from the method and path when it is absent, so a spec without operationIds is degraded rather than unusable — which weakens the audit's `warn` on missing ids. Conversely the constraint that genuinely breaks registration (character legality and length) is documented at grade A yet is not measured by this audit at all, so the check is graded on a mechanism it only partially exercises. *(That last sentence is no longer true as of 2026-08-22 — see the fold below.)*

## The fold (Plan 4, Task 9, 2026-08-22)

v1 5.23 (`webmcp-tool-naming`) is deleted; its naming rule lands here. 5.23's required fix names this audit as the destination:

> *"Merge the naming principle into 5.3 openapi-operation-ids (which governs names that a real tool-calling stack actually consumes) and into a future MCP tools/list check; drop the English-verb allowlist in favor of a structural rule (legal function-name charset, ≤64 chars, contains a verb-like leading token OR a namespaced separator). Delete this file."*

### What landed: a structural legality check

`operationId` must now match `^[a-zA-Z0-9_-]{1,64}$`. This is simultaneously 5.23's structural rule and the first line of *this* audit's own required fix (*"Add a legality check against `^[a-zA-Z0-9_-]{1,64}$` and fail/warn on violations with the offending ids listed"*) — the two halves of the fold are the same edit, which is why 5.23's naming principle belongs here and nowhere else.

The verdict shape:

| Spec | Verdict |
| :--- | :--- |
| no spec / no operations | `fail` (unchanged) |
| any operationId outside the legal charset or over 64 chars | `fail`, listing every offending id — **new** |
| ids missing or duplicated only | `warn` (unchanged) |
| all present, unique and legal | `pass` (unchanged) |

Illegal is a `fail` while missing is a `warn`, and the asymmetry is the evidence: an id outside the pattern is *rejected at tool-registration time*, so the operation is unreachable, whereas a missing id is synthesized from method + path by every converter — degraded naming, not a broken call. The offending ids are named in `found` rather than counted, because a count gives the operator no way to locate them.

### What did not land, and why

- **The English-verb allowlist.** 5.23's `VERB_PATTERN` was a ~100-word hardcoded allowlist that rejected `search_products`, `search-products`, `products.search`, and any non-English or domain verb (`provision`, `ingest`, `annotate`). 5.23's own graded evidence rates the style rule **C** and states plainly that *"no spec or vendor doc constrains the naming style"* — MCP's own example tool is `get_weather`, snake_case, which the allowlist rejected. Porting it would import a false positive with no consumer. Tests lock snake_case, kebab-case and domain verbs as passing.
- **The 20-character description floor.** Same reasoning (*"sets any description length … this project's own convention"*), and OpenAPI description quality is already a separate audit (`agent-interfaces/openapi-description-quality`), so there was nowhere for it to land that is not already occupied.
- **5.23's "OR a namespaced separator" escape hatch.** Deliberate deviation: a dotted name like `products.search` is exactly what a runtime cannot register — `.` is outside Anthropic's `^[a-zA-Z0-9_-]{1,64}$` and Gemini asks for names "without spaces or special characters". Where 5.23's suggested rule and the documented consumer contract disagree, the contract wins; a test pins `products.search` as a failure.

### Deferred: the runtime half

5.23 collected tools from two sources — a `/.well-known/webmcp` manifest and `form[toolname]` attributes. The manifest **does not exist in any specification** (5.23's evidence records that it appears nowhere in the WebMCP proposal), and the declarative-forms source is already covered by `agent-interfaces/webmcp-declarative-forms`. The only readable version of "are this site's *tools* well named" runs over a live MCP `tools/list` response after a successful `initialize` — a runtime probe, not a static crawl.

**That check is deferred out of v2.0.** It is not an audit in this release, and it is not represented by any registered id. It belongs with the MCP endpoint work (`agent-interfaces/mcp-endpoint`), which is the same destination 5.24's fold recorded for the annotations signal — a future `tools/list` check would evaluate names and annotations off one response. Until it exists, the naming signal is measured only where there is a documented consumer for it: over an OpenAPI spec, here. The migration-map row for 5.23 records the deferral so a v1 consumer of that id is not left guessing.

### Grade decision: stays **B**, tier `scored`, weight 0.6

5.23 was graded **C**, `tier: informative`, weight 0 — a naming *style* rule with no consumer. This audit is graded **B** on a documented one: Microsoft 365 Copilot turning operationIds into the functions it executes, over Anthropic's published `^[a-zA-Z0-9_-]{1,64}$` contract. A merged audit is graded on the strongest **proven** consumer path among its sources, so absorbing a C signal into a B audit leaves the B untouched; there is no evidence here that would raise it to A, because `operationId` remains optional in OpenAPI and converters synthesize a name when it is absent.

What the fold does change is the counter-evidence above: the A-grade constraint that genuinely breaks registration is no longer unmeasured. The audit still ships at B rather than A because its *headline* requirement — that every operation carry an operationId at all — is the part the counter-evidence weakens, and that requirement is unchanged.

The tier stays `scored`. It was never `experimental`, and nothing in this fold argues for moving it: the weight law makes weight a pure function of grade and tier, so `weightForGrade('B', 'scored')` = **0.6** both before and after.

### Deviations — standing required-fix items not addressed by this fold

- **The YAML blind spot.** `getOpenApiSpec()` still reads only `/openapi.json`, so a YAML spec still reports "No spec" while 5.1 passes. Adopting the shared loader is this audit's standing fix and touches the whole `openapi-*` family, not this fold.
- **Duplicate accounting is still a counter.** A triplicated id still counts as 2 duplicates and the colliding ids are still not named. The fold names the *illegal* ids because that is what it introduced; converting the duplicate counter to a `Map<id, count>` is the separate half of the required fix.
- **"No spec" is still a `fail`, not `notApplicable`.** Unchanged by this fold.
