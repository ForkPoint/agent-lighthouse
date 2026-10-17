---
audit: answer-readiness/chunk-boundary-referent-integrity
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/chunk-boundary-referent-integrity.ts
slug: chunk-boundary-referent-integrity
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - S1
  - S5
---

# Chunk-Boundary Referent Integrity

> Shipped in v2. Evidence grade **B** · scored tier · unique · implementation: `static-fetch`

## What it checks

Splits the page the way a real RAG pipeline does, at h2 and h3, then measures each resulting chunk for whether it still makes sense alone. Does it open with a dangling anaphor? Does it ever name the entity it is about? And does it contain positional cross-references that become nonsense once the surrounding page is gone? Emits a per-section pass/fail list with the exact offending sentence, not a page-level vibe score.

## Claimed mechanism (falsifiable)

Retrieval systems embed and retrieve chunks, not pages. A chunk whose subject is only recoverable from a preceding chunk has an embedding that does not encode the entity, so it fails to match entity-bearing queries, and if retrieved it is unciteable because the generator cannot attribute the claim. Anthropic measured this exact failure and showed that injecting the missing context cut retrieval failure rate by 35-49% (S1). Falsifiable prediction. Take two pages with identical facts. The one whose h2 sections each re-state the primary entity, and avoid chunk-initial anaphora, will be retrieved for entity-plus-attribute queries at a strictly higher rate. The other's tail sections will be retrieved only for generic queries.

## Evidence

- **[MCP Specification 2026-07-28 — Streamable HTTP Transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)** — Model Context Protocol (Anthropic / MCP Working Groups) (spec, URL verified 2026-08-20)
  - Revision 2026-07-28 removed the GET stream endpoint and protocol-level sessions (Mcp-Session-Id, Last-Event-ID). Server MUST expose one POST endpoint. Server MUST validate Origin; if Origin is present and invalid it MUST return 403 Forbidden. Every POST MUST carry MCP-Protocol-Version, Mcp-Method, and (for tools/call, resources/read, prompts/get) Mcp-Name headers; these are 'REQUIRED for compliance'. Header value MUST match the _meta body value or server MUST return 400 + JSON-RPC code -32020 HeaderMismatch. Unknown protocol version -> 400 + UnsupportedProtocolVersionError. Unknown method -> 404 + -32601. x-mcp-header constraints defined; clients MUST reject (exclude from tools/list) tools that violate them. Servers SHOULD send X-Accel-Buffering: no on SSE. GET/DELETE to endpoint SHOULD now return 405.
- **[MCP Specification 2026-07-28 — Caching](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/caching)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - 'Servers MUST include caching hints on results with resultType: "complete"' for server/discover, tools/list, prompts/list, resources/list, resources/templates/list, resources/read. ttlMs is an integer ms; servers MUST provide ttlMs >= 0. If ttlMs is absent clients SHOULD assume 0 = immediately stale. cacheScope is exactly "public" or "private". Servers MUST apply the same cacheScope to all pages of a paginated list. Public scope on an authenticated endpoint may be shared across access tokens — servers MUST NOT rely on cacheScope for access control.

## Example failure

A pricing page with h2 'Enterprise plan'. The section body opens 'It includes SSO, audit logs, and a 99.9% SLA.' — chunk-initial 'It', product name never repeated in the section. Chunked and embedded standalone, this passage does not encode the vendor or the plan; a query 'does <vendor> Enterprise include SSO' misses it, and the competitor page whose section reads '<Vendor> Enterprise includes SSO...' is retrieved instead.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Implementation deviations

- Segmentation walks the first `<main>` or `<article>`, else `<body>`. Every `h2` and `h3` starts a chunk that runs to the next heading of either level.
- No Readability pass isolates the content. The flags read the same DOM the segmentation walks.
- The entity set comes from `h1`, `og:title` and JSON-LD `name`/`headline`. Each multi-word name adds its acronym, its first significant word (four letters or more) and its last word. Stopwords are dropped first.
- Matching is case-insensitive with plural-only stemming (`s`, `es`, `ies`). Fuller stemming would need a dependency.
- Below 80% clean chunks fails. The 80% to 95% warn band is this implementation's own.
- Each failing chunk reports one evidence sentence, the first offending one.

## Deferred

- Coreference resolution. Whether "it" resolves needs a model.
- Sub-chunk boundaries. `section-split-risk-profile` measures them from the token side.
- Per-page assessment. Only `ctx.pages[0]` is segmented.
