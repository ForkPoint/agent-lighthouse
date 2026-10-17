---
audit: answer-readiness/section-split-risk-profile
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/section-split-risk-profile.ts
slug: section-split-risk-profile
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - S5
  - S1
---

# Section Split-Risk Profile

> Shipped in v2. Evidence grade **B** · scored tier · unique · implementation: `static-fetch`

## What it checks

Measures every h2 and h3 section against the published default chunk window of 512 tokens, or about 2000 characters. It finds sections that will be mechanically cut into two or more chunks, producing tail chunks that carry no heading. It also finds the inverse: sections too thin to embed meaningfully. Also flags atomic structures (tables, long ordered lists) longer than the window, which get split mid-structure.

## Claimed mechanism (falsifiable)

Fixed-window splitters cut at a character/token budget, not at meaning. When a section exceeds the window, chunk 1 keeps the heading (the strongest query-matching signal on the page) and every subsequent chunk from that section is headless — its embedding loses the topical anchor. Azure publishes 512 tokens / 2000 chars with 25% overlap as the recommended default and explicitly recommends heading-based segmentation as the alternative that avoids this (S5). Falsifiable prediction: for a page with one 2,000-token section versus the same content split into four 500-token h2 sections, the queries that match content in the final quarter of the text retrieve the split version and miss the monolithic one.

## Evidence

- **[MCP Specification 2026-07-28 — Caching](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/caching)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - 'Servers MUST include caching hints on results with resultType: "complete"' for server/discover, tools/list, prompts/list, resources/list, resources/templates/list, resources/read. ttlMs is an integer ms; servers MUST provide ttlMs >= 0. If ttlMs is absent clients SHOULD assume 0 = immediately stale. cacheScope is exactly "public" or "private". Servers MUST apply the same cacheScope to all pages of a paginated list. Public scope on an authenticated endpoint may be shared across access tokens — servers MUST NOT rely on cacheScope for access control.
- **[MCP Specification 2026-07-28 — Streamable HTTP Transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)** — Model Context Protocol (Anthropic / MCP Working Groups) (spec, URL verified 2026-08-20)
  - Revision 2026-07-28 removed the GET stream endpoint and protocol-level sessions (Mcp-Session-Id, Last-Event-ID). Server MUST expose one POST endpoint. Server MUST validate Origin; if Origin is present and invalid it MUST return 403 Forbidden. Every POST MUST carry MCP-Protocol-Version, Mcp-Method, and (for tools/call, resources/read, prompts/get) Mcp-Name headers; these are 'REQUIRED for compliance'. Header value MUST match the _meta body value or server MUST return 400 + JSON-RPC code -32020 HeaderMismatch. Unknown protocol version -> 400 + UnsupportedProtocolVersionError. Unknown method -> 404 + -32601. x-mcp-header constraints defined; clients MUST reject (exclude from tools/list) tools that violate them. Servers SHOULD send X-Accel-Buffering: no on SSE. GET/DELETE to endpoint SHOULD now return 405.

## Example failure

A 3,100-token 'Frequently asked questions' h2 with 22 questions as bold paragraphs rather than h3 headings. Split at 512 tokens it yields six chunks, five of which are headless bare Q&A text with no page or topic anchor. Promoting each question to h3 converts the same content into 22 self-anchored chunks.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Implementation deviations

- Token counts are real `o200k_base` counts from `gpt-tokenizer`, never `chars / 4`.
- `ATOMIC-SPLIT` covers `ul` as well as `table` and `ol`. An unordered list loses its preamble the same way.
- The atomic serializer is a small GFM-shaped renderer written in place. It only needs a length.
- The score is the share of section tokens in sections at or under the window. A `BLOB` page scores 0, because none of its text sits in a headed chunk.
- Below 70% fails. Below 90%, or any `SPLIT`, `ATOMIC-SPLIT` or `BLOB` finding, warns. Both bands are this implementation's own.
- `THIN` is reported in `found` and `details.findings` but never sets the status. A section under the window is never cut.
- A page under 512 tokens is `notApplicable`. A retriever never cuts it.

## Deferred

- The Evidence list names two MCP specification pages that say nothing about chunking. The Azure source the mechanism cites (S5) needs restoring, verifying and stamping before the grade is reviewed.
- Per-page assessment. Only `ctx.pages[0]` is profiled.
- Overlap-aware scoring. It needs pipeline parameters a scanner does not have.
