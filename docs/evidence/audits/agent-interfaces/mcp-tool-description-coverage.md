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
  - S4
  - mcp-instructions-field
  - anthropic-define-tools
---

# Tool Self-Description Coverage

> Shipped in v2. Evidence grade **B** · scored tier · partial overlap · implementation: `static-fetch`

## What it checks

Deterministic coverage metrics over the tool surface. What fraction of tools carry a description. What fraction of every input parameter, walked recursively through properties, carries a description. What fraction declare an outputSchema and a title, and whether the server ships top-level `instructions`. No LLM judging — pure presence and length counting against declared thresholds.

## Claimed mechanism (falsifiable)

A tool description and its parameter descriptions are the entire basis on which a model decides whether and how to call it — they are the only prose the model ever sees about the tool. The spec states the documented purpose of outputSchema directly: 'Guiding clients and LLMs to properly parse and utilize the returned data', and 'Enabling strict schema validation of responses'. It defines `instructions` as 'natural-language guidance for LLMs on how to use this server effectively'. The falsifiable claim is narrow and structural, not aesthetic. A parameter with no `description`, and no `enum`, `format` or `pattern`, gives the model no way to derive a legal value. It must guess, and guessed values surface as tool-execution errors and retry loops. Coverage is measured, not judged; only the pass thresholds are this project's convention, which is why this is graded B rather than A.

## Evidence

- **[MCP Specification 2026-07-28 — Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)** — Model Context Protocol (spec, verified 2026-10-17)
  - A tool carries a `description`, an optional `title`, an `inputSchema` and an optional `outputSchema`. Tools are "model-controlled": the model selects and invokes them from what `tools/list` returns. The spec's own examples give every input property a `description`. It states that an output schema helps "clients and LLMs" by "Guiding clients and LLMs to properly parse and utilize the returned data" and "Enabling strict schema validation of responses".
- **[MCP Specification 2026-07-28 — Discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover.md)** — Model Context Protocol (spec, verified 2026-10-17)
  - `DiscoverResult.instructions` is "Optional natural-language guidance for LLMs on how to use this server effectively".
- **[Anthropic — define tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools)** — Anthropic (vendor-doc, verified 2026-10-17)
  - A documented consumer of tool descriptions. Claude's tool-use system prompt is built from the tool definitions. The best-practice list says: "Provide extremely detailed descriptions. This is by far the most important factor in tool performance." A good description covers "What each parameter means and how it affects the tool's behavior". The page's poor example is a tool whose parameter has no description.

**Grade: B** — the MCP spec defines every field the audit counts, and Anthropic documents that descriptions drive tool performance. The pass thresholds are this project's convention, not a source's, so the grade is B rather than A.

## Example failure

A booking server exposes `create_reservation` with a good tool-level description but declares `required: ["property_id","rate_plan","guest_count"]` where `rate_plan` is `{"type":"string"}` with no description, no enum and no pattern. The model has no way to know that legal values are the four internal codes FLEX/NREF/CORP/GRP, so it invents plausible strings like "flexible" and "non-refundable". Every booking attempt fails validation on the first try; the agent burns two or three retry turns per reservation, and some clients abandon the tool after repeated errors.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Implementation deviations

- Only leaf parameters count. The walk passes through object and array-of-object containers, so `line_items[].tax_code` counts and `line_items` does not.
- A leaf is required only when its immediate parent names it in `required`.
- Recursion stops at 6 levels. `oneOf`, `anyOf`, `allOf` and `$ref` branches are skipped, since branches may never coexist.
- Tool pages come from the shared `listTools` cache. `instructions` is read from the shared `server/discover` probe.
- A description under 40 characters is counted as a stub but still clears the tool-description gate.
- `constrainedStringRatio` is advisory and never gated. A free-text parameter is legitimate.
- At most four pages are read. `details.pagesTruncated` reports a cut.

## Deferred

- Judging description quality. The audit counts presence and length only.
