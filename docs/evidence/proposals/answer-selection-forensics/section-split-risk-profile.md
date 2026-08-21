---
check: section-split-risk-profile
title: "Section Split-Risk Profile"
domain: answer-selection-forensics
status: proposed
evidence_grade: B
uniqueness: unique
difficulty: static-fetch
scoring_tier: scored
reviewed: 2026-08-20
---

# Section Split-Risk Profile

> Proposed check. Evidence grade **B** · unique · implementation: `static-fetch`

## What it checks

Measures every h2/h3 section against the published default chunk window (512 tokens / ~2000 characters) to find sections that will be mechanically cut into two or more chunks, producing tail chunks that carry no heading — and the inverse, sections too thin to embed meaningfully. Also flags atomic structures (tables, long ordered lists) longer than the window, which get split mid-structure.

## Claimed mechanism (falsifiable)

Fixed-window splitters cut at a character/token budget, not at meaning. When a section exceeds the window, chunk 1 keeps the heading (the strongest query-matching signal on the page) and every subsequent chunk from that section is headless — its embedding loses the topical anchor. Azure publishes 512 tokens / 2000 chars with 25% overlap as the recommended default and explicitly recommends heading-based segmentation as the alternative that avoids this (S5). Falsifiable prediction: for a page with one 2,000-token section versus the same content split into four 500-token h2 sections, the queries that match content in the final quarter of the text retrieve the split version and miss the monolithic one.

## Evidence

- **[MCP Specification 2026-07-28 — Caching](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/caching)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - 'Servers MUST include caching hints on results with resultType: "complete"' for server/discover, tools/list, prompts/list, resources/list, resources/templates/list, resources/read. ttlMs is an integer ms; servers MUST provide ttlMs >= 0. If ttlMs is absent clients SHOULD assume 0 = immediately stale. cacheScope is exactly "public" or "private". Servers MUST apply the same cacheScope to all pages of a paginated list. Public scope on an authenticated endpoint may be shared across access tokens — servers MUST NOT rely on cacheScope for access control.
- **[MCP Specification 2026-07-28 — Streamable HTTP Transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)** — Model Context Protocol (Anthropic / MCP Working Groups) (spec, URL verified 2026-08-20)
  - Revision 2026-07-28 REMOVED the GET stream endpoint and protocol-level sessions (Mcp-Session-Id, Last-Event-ID). Server MUST expose one POST endpoint. Server MUST validate Origin; if Origin is present and invalid it MUST return 403 Forbidden. Every POST MUST carry MCP-Protocol-Version, Mcp-Method, and (for tools/call, resources/read, prompts/get) Mcp-Name headers; these are 'REQUIRED for compliance'. Header value MUST match the _meta body value or server MUST return 400 + JSON-RPC code -32020 HeaderMismatch. Unknown protocol version -> 400 + UnsupportedProtocolVersionError. Unknown method -> 404 + -32601. x-mcp-header constraints defined; clients MUST reject (exclude from tools/list) tools that violate them. Servers SHOULD send X-Accel-Buffering: no on SSE. GET/DELETE to endpoint SHOULD now return 405.

## Competitor coverage

SEO crawlers report word count and heading counts; none compute per-section token budgets against a retrieval chunk window. Lighthouse's agentic category has no content-segmentation audit. This is a fundamentally different metric from 'H1 present' or 'heading hierarchy valid' — a page can have perfect heading hierarchy and still be one 3,000-token h2.

## Implementation sketch

Static fetch. 1) Same h2/h3 segmentation as the referent-integrity check. 2) Token-count each section with a real BPE tokenizer (gpt-tokenizer npm) rather than chars/4. 3) Emit findings: (a) SPLIT — section tokens > 512; severity = ceil(tokens/512)-1 = number of headless tail chunks produced; (b) BLOB — body > 512 tokens with fewer than 2 h2 elements, meaning the entire page is cut at arbitrary offsets; (c) THIN — section < 25 tokens, too sparse to produce a discriminative embedding (common in nav-like h3 stubs); (d) ATOMIC-SPLIT — a single <table> or <ol> whose markdown serialization exceeds 512 tokens, so the header row / list preamble is lost from the tail. 4) Also report headingDistance: max characters between a heading and the end of its section, as the single actionable number. 5) Score = share of body tokens living in sections at or under the window.

## Example failure

A 3,100-token 'Frequently asked questions' h2 with 22 questions as bold paragraphs rather than h3 headings. Split at 512 tokens it yields six chunks, five of which are headless bare Q&A text with no page or topic anchor. Promoting each question to h3 converts the same content into 22 self-anchored chunks.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
