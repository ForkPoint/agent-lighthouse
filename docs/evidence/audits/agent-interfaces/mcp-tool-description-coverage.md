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

## Competitor coverage

Partial-overlap: MCP Inspector and several open-source MCP linters surface missing descriptions during development, and Anthropic's tool-design guidance recommends the practice. But none of them run against a live third-party endpoint as a scored site audit with per-parameter path-level findings, and no SEO/AEO tool touches this at all. The differentiation is the audit framing and the recursive required-parameter metric, not the underlying observation.

## Implementation sketch

From the same tools/list fetch used by the contract-validity check, plus the DiscoverResult, compute:
- toolDescriptionCoverage = tools with a non-empty trimmed `description` / total tools. Threshold: 100% to pass; additionally flag descriptions under 40 characters as stubs and report the count separately.
- paramDescriptionCoverage = across all tools, walk inputSchema recursively through `properties` (and into `items.properties` for arrays of objects); count leaf parameters with a non-empty `description` over total leaf parameters. Threshold: >= 90%.
- requiredParamDescriptionCoverage: same metric restricted to parameters named in `required`. Threshold: 100% — an undocumented required parameter is an unavoidable guess on every call.
- constrainedStringRatio = string-typed parameters carrying `enum`, `format`, or `pattern` / total string parameters. Report as an advisory signal, not a pass/fail gate.
- outputSchemaCoverage = tools with an `outputSchema` / total tools. Report; threshold advisory.
- titleCoverage = tools with a `title` distinct from `name` / total tools (drives human-facing consent UI).
- serverInstructions: assert DiscoverResult.instructions is present and non-empty; report its length.
Emit each ratio alongside the specific offending tool/parameter paths (e.g. `create_invoice.line_items[].tax_code`) so the finding is directly actionable.

## Example failure

A booking server exposes `create_reservation` with a good tool-level description but declares `required: ["property_id","rate_plan","guest_count"]` where `rate_plan` is `{"type":"string"}` with no description, no enum and no pattern. The model has no way to know that legal values are the four internal codes FLEX/NREF/CORP/GRP, so it invents plausible strings like "flexible" and "non-refundable". Every booking attempt fails validation on the first try; the agent burns two or three retry turns per reservation, and some clients abandon the tool after repeated errors.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Implementation deviations

- **One of the two Evidence sources does not belong to this check.** The Playwright actionability entry is about browser click gating and says nothing about MCP tool metadata; it was mis-pasted during the proposal pass. The second source — the MCP 2026-07-28 tools specification — is the one the mechanism rests on, and it is accurate. The grade stays **B**: the metrics are counts of directly observable fields, and only the pass thresholds are this project's convention.
- **Slug renamed** from `tool-self-description-coverage` to `mcp-tool-description-coverage`, grouping it with the other MCP audits in `agent-interfaces`.
- **Container parameters are not counted.** The sketch says "leaf parameters"; the implementation counts only leaves and walks through object and array-of-object containers, so `line_items` itself is not a parameter but `line_items[].tax_code` is. Counting containers would let a server raise its coverage by describing wrappers rather than fields.
- **Required-ness is read from the enclosing schema.** A leaf counts as required only when its own immediate parent names it in `required`. A required container whose children are optional does not make those children required.
- **Recursion is capped at 6 levels**, and combinators are not followed. `oneOf`/`anyOf`/`allOf`/`$ref` branches are skipped rather than merged: which branch applies depends on the instance, so a count over all branches would report parameters that never coexist.
- **The tool list is the shared probe.** Pages come from `listTools`, which memoises each page under `tools|<url>|<cursor>` for the scan, so this audit and `agent-interfaces/mcp-tool-contract-validity` split the cost of one `tools/list` read. `instructions` is read off the `server/discover` response `agent-interfaces/mcp-modern-era-reachability` already requests.
- **Stub descriptions warn, they do not fail.** A description under 40 characters is reported and counted, but a described tool clears the 100 % tool-description gate. The threshold that fails is presence, not length.

## Deferred

- **No judgement of description quality.** The audit counts presence and length. Whether a description actually tells a model what the tool does is not measured, and no LLM is asked.
- **`enum` coverage is advisory only.** `constrainedStringRatio` is reported and never gated: a free-text parameter is legitimate, and a threshold would punish it.
- **Pagination beyond 4 pages.** A tool surface wider than four pages is measured on the first four, and `details.pagesTruncated` says so.
