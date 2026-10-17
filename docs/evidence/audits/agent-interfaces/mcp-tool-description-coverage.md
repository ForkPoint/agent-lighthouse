---
audit: agent-interfaces/mcp-tool-description-coverage
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/mcp-tool-description-coverage.ts
slug: mcp-tool-description-coverage
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - S2
  - S4
---

# Tool Self-Description Coverage

> Shipped in v2. Evidence grade **B** · scored tier · partial overlap · implementation: `static-fetch`

## What it checks

Deterministic coverage metrics over the tool surface. What fraction of tools carry a description. What fraction of every input parameter, walked recursively through properties, carries a description. What fraction declare an outputSchema and a title, and whether the server ships top-level `instructions`. No LLM judging — pure presence and length counting against declared thresholds.

## Claimed mechanism (falsifiable)

A tool description and its parameter descriptions are the entire basis on which a model decides whether and how to call it — they are the only prose the model ever sees about the tool. The spec states the documented purpose of outputSchema directly: 'Guiding clients and LLMs to properly parse and utilize the returned data', and 'Enabling strict schema validation of responses'. It defines `instructions` as 'natural-language guidance for LLMs on how to use this server effectively'. The falsifiable claim is narrow and structural, not aesthetic. A parameter with no `description`, and no `enum`, `format` or `pattern`, gives the model no way to derive a legal value. It must guess, and guessed values surface as tool-execution errors and retry loops. Coverage is measured, not judged; only the pass thresholds are this project's convention, which is why this is graded B rather than A.

## Evidence

- **[Playwright: Auto-waiting / Actionability checks](https://playwright.dev/docs/actionability)** — Microsoft (vendor-doc, URL verified 2026-08-20)
  - Before click/check/fill/selectOption, Playwright enforces five checks: Visible (non-empty bounding box, not visibility:hidden), Stable (same bounding box over 2 animation frames), Receives Events (element is the hit target at the action point — overlays cause failure), Enabled (not [disabled]/aria-disabled), Editable (not readonly/aria-readonly). Fill requires visible+enabled+editable. This is the exact gate every Playwright-based agent (Playwright-MCP, browser-use, most CUA harnesses) passes through, so each check is a directly testable site-side failure cause.
- **[MCP Specification 2026-07-28 — Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - tools/list result set MUST NOT vary per-connection or as a side effect of other requests (MAY vary by authorization). Servers SHOULD return tools in deterministic order — rationale given verbatim: enables client caching and 'improves LLM prompt cache hit rates'. inputSchema MUST be a valid JSON Schema object (not null); defaults to JSON Schema 2020-12. Tool names SHOULD be 1-128 chars, case-sensitive, only [A-Za-z0-9_.-], unique within a server. Full x-mcp-header constraint list including static-reachability rule (chain of only `properties` keys; never through items/oneOf/anyOf/allOf/not/if/then/else/$ref). Clients MUST exclude violating tools from tools/list. If outputSchema present, servers MUST conform. Clients MUST treat annotations as untrusted.

## Example failure

A booking server exposes `create_reservation` with a good tool-level description but declares `required: ["property_id","rate_plan","guest_count"]` where `rate_plan` is `{"type":"string"}` with no description, no enum and no pattern. The model has no way to know that legal values are the four internal codes FLEX/NREF/CORP/GRP, so it invents plausible strings like "flexible" and "non-refundable". Every booking attempt fails validation on the first try; the agent burns two or three retry turns per reservation, and some clients abandon the tool after repeated errors.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Implementation deviations

- The Playwright entry in `## Evidence` does not support this check. The MCP tools specification is the source the mechanism rests on.
- Only leaf parameters count. The walk passes through object and array-of-object containers, so `line_items[].tax_code` counts and `line_items` does not.
- A leaf is required only when its immediate parent names it in `required`.
- Recursion stops at 6 levels. `oneOf`, `anyOf`, `allOf` and `$ref` branches are skipped, since branches may never coexist.
- Tool pages come from the shared `listTools` cache. `instructions` is read from the shared `server/discover` probe.
- A description under 40 characters is counted as a stub but still clears the tool-description gate.
- `constrainedStringRatio` is advisory and never gated. A free-text parameter is legitimate.
- At most four pages are read. `details.pagesTruncated` reports a cut.

## Deferred

- Judging description quality. The audit counts presence and length only.
