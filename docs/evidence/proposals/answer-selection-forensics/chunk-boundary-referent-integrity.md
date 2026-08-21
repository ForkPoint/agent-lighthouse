---
check: chunk-boundary-referent-integrity
title: "Chunk-Boundary Referent Integrity"
domain: answer-selection-forensics
status: proposed
evidence_grade: B
uniqueness: unique
difficulty: static-fetch
scoring_tier: scored
reviewed: 2026-08-20
---

# Chunk-Boundary Referent Integrity

> Proposed check. Evidence grade **B** · unique · implementation: `static-fetch`

## What it checks

Splits the page the way a real RAG pipeline does (at h2/h3) and measures, per resulting chunk, whether the chunk still makes sense alone: does it open with a dangling anaphor, does it ever name the entity it is about, and does it contain positional cross-references that become nonsense once the surrounding page is gone. Emits a per-section pass/fail list with the exact offending sentence, not a page-level vibe score.

## Claimed mechanism (falsifiable)

Retrieval systems embed and retrieve chunks, not pages. A chunk whose subject is only recoverable from a preceding chunk has an embedding that does not encode the entity, so it fails to match entity-bearing queries, and if retrieved it is unciteable because the generator cannot attribute the claim. Anthropic measured this exact failure and showed that injecting the missing context cut retrieval failure rate by 35-49% (S1). Falsifiable prediction: for two pages with identical facts, the one whose h2 sections each re-state the primary entity and avoid chunk-initial anaphora will be retrieved for entity+attribute queries at a strictly higher rate; the other's tail sections will be retrieved only for generic queries.

## Evidence

- **[MCP Specification 2026-07-28 — Streamable HTTP Transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)** — Model Context Protocol (Anthropic / MCP Working Groups) (spec, URL verified 2026-08-20)
  - Revision 2026-07-28 REMOVED the GET stream endpoint and protocol-level sessions (Mcp-Session-Id, Last-Event-ID). Server MUST expose one POST endpoint. Server MUST validate Origin; if Origin is present and invalid it MUST return 403 Forbidden. Every POST MUST carry MCP-Protocol-Version, Mcp-Method, and (for tools/call, resources/read, prompts/get) Mcp-Name headers; these are 'REQUIRED for compliance'. Header value MUST match the _meta body value or server MUST return 400 + JSON-RPC code -32020 HeaderMismatch. Unknown protocol version -> 400 + UnsupportedProtocolVersionError. Unknown method -> 404 + -32601. x-mcp-header constraints defined; clients MUST reject (exclude from tools/list) tools that violate them. Servers SHOULD send X-Accel-Buffering: no on SSE. GET/DELETE to endpoint SHOULD now return 405.
- **[MCP Specification 2026-07-28 — Caching](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/caching)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - 'Servers MUST include caching hints on results with resultType: "complete"' for server/discover, tools/list, prompts/list, resources/list, resources/templates/list, resources/read. ttlMs is an integer ms; servers MUST provide ttlMs >= 0. If ttlMs is absent clients SHOULD assume 0 = immediately stale. cacheScope is exactly "public" or "private". Servers MUST apply the same cacheScope to all pages of a paginated list. Public scope on an authenticated endpoint may be shared across access tokens — servers MUST NOT rely on cacheScope for access control.

## Competitor coverage

Lighthouse 13.3 agentic category covers llms.txt quality, WebMCP tools, agent a11y and layout stability — nothing at passage level. Profound and Otterly measure brand mentions in model answers (outcome monitoring), never page mechanics. Semrush AI toolkit / Ahrefs Brand Radar are visibility trackers plus AI-crawler robots checks. Readability-grade tools (Flesch) measure sentence length, which is orthogonal to referent resolution. No shipping tool segments a page into chunks and audits referent survival.

## Implementation sketch

Static fetch of HTML. 1) Isolate main content (<main>/<article>, else Readability). 2) Segment: walk h2/h3; chunk_i = heading_i plus all nodes until the next heading of level <= level_i. 3) Build entity set E from h1 text, og:title, and JSON-LD name/headline, plus derived aliases (longest shared noun phrase, acronym form, first token). 4) Per chunk compute three deterministic flags: (a) anaphoraOpen — first sentence matches /^(This|That|These|Those|It|They|He|She|Such|Here|There|Both|Either)\b/ AND the demonstrative is not followed within 3 tokens by a content word that also appears in heading_i; (b) entityAbsent — chunk body >= 40 words and no member of E appears (case-insensitive, light stemming); (c) positionalRefs — count matches of /\b(as (mentioned|described|noted|shown) (above|below|earlier|previously)|see (above|below|the previous|the next)|the (table|figure|image|list|section|chart) (above|below)|in the previous section|as we saw|click here|read more here|the former|the latter)\b/gi. 5) Chunk passes if all three are clean. Score = passing chunks / total chunks; audit fails below 0.8. 6) Report the failing heading, the flag, and the offending sentence verbatim so the fix is a one-line edit.

## Example failure

A pricing page with h2 'Enterprise plan'. The section body opens 'It includes SSO, audit logs, and a 99.9% SLA.' — chunk-initial 'It', product name never repeated in the section. Chunked and embedded standalone, this passage does not encode the vendor or the plan; a query 'does <vendor> Enterprise include SSO' misses it, and the competitor page whose section reads '<Vendor> Enterprise includes SSO...' is retrieved instead.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
