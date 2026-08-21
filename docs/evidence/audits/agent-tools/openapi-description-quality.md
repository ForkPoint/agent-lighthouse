---
audit: agent-tools/openapi-description-quality
audit_id: "5.26"
category: agent-tools
source_file: packages/core/src/audits/agent-tools/openapi-description-quality.ts
slug: openapi-description-quality
review_verdict: fix
severity: low
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# openapi-description-quality (`5.26`)

> agent-tools · source `openapi-description-quality.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

## What it checks

When an AI agent converts your OpenAPI spec into callable tools, the description fields become the prompt the LLM uses to decide when and how to call each function. A one-word description like "search" tells the model nothing about what the endpoint does, what the parameter means, or what values are valid — so the agent guesses, calls the wrong tool, or fills parameters with hallucinated values. Every operation and every parameter needs a verbose description (more than 15 characters) that explains purpose, expected input, and behavior.

## Code review findings (2026-08-20, 11-agent pass)

The best-constructed audit in the category — correct `na` semantics, structured `details`, an accurate account of why descriptions matter for tool-calling — but it reads only `description`, ignoring `summary` and unresolved `$ref` parameters, so well-documented specs are marked as thin.

**Required fix:** Accept `description || summary` (preferring description, falling back to summary) as the described text. Resolve local `$ref`s for parameters and merge path-level `parameters` into each operation before grading. Exclude options/head/trace from the denominator. Replace the raw >15 char rule with a slightly richer heuristic (e.g. ≥ 3 words and not identical to the operationId/param name) so padding is not rewarded. Use the shared loader so YAML specs are graded.

**False-positive risks:**
- Only `operation['description']` is examined. A very large share of real specs put the human-readable text in `summary` and omit `description` entirely; OpenAPI→tool converters typically fall back to `summary`. Such a spec is reported as 0% described and FAILS at high priority despite being perfectly usable by an agent.
- `$ref`-ed parameters are not resolved: `{"$ref": "#/components/parameters/PageSize"}` passes `isObject`, has no `name` and no `description`, and is counted as an undescribed param labelled `param '(unnamed)'`. Specs that share parameters (the recommended practice) are systematically penalized.
- Path-level `parameters` (declared once on the pathItem and inherited by every method) are never collected, so shared, well-described parameters are invisible while method-level ones are graded — understating coverage.
- `val.trim().length > MIN_DESCRIPTION_LENGTH` with the constant at 15 is a raw character count: 'Search the catalog' (18 chars) passes, 'Search products' (15) fails on a strict `>` — an arbitrary cliff that measures length rather than informativeness, and rewards padding.
- Requires descriptions on every operation including `options`/`head`/`trace`, which no agent will ever call.
- Reuses the JSON-only `getOpenApiSpec()` copy, so YAML specs are silently `na` while 5.1 passes.

**Test gaps:**
- No fixture using `summary` instead of `description` — the biggest false-fail source
- No `$ref`-ed parameter fixture
- No path-level `parameters` fixture
- No requestBody-schema property-description coverage
- No YAML fixture
- No boundary test at exactly 15 characters

**Overlaps with:** `5.1`, `5.3`, `5.6`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
