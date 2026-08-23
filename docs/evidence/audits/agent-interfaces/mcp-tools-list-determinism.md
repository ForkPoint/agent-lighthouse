---
audit: agent-interfaces/mcp-tools-list-determinism
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/mcp-tools-list-determinism.ts
slug: mcp-tools-list-determinism
evidence_grade: A
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-22"
reviewed: 2026-08-20
graduated: 2026-08-22
---


# tools/list Determinism and Cache-Hint Compliance

> Shipped in v2. Evidence grade **A** · scored tier · unique · implementation: `static-fetch`

## What it checks

Repeatedly fetches tools/list and asserts three things the spec ties directly to agent cost and latency: caching hints are present and well-formed (ttlMs >= 0, cacheScope in {public, private}), tool ordering is stable across calls, and the tool set does not vary per connection.

## Claimed mechanism (falsifiable)

The spec states its own causal rationale verbatim: deterministic ordering 'enables clients to reliably cache the tool list and improves LLM prompt cache hit rates when tools are included in model context.' Tool definitions sit near the front of the model's prompt; if their serialized bytes change between turns, the provider-side prefix cache misses and the full tool block is re-billed at uncached rates on every single turn. Separately, servers MUST include caching hints on complete results, and when ttlMs is absent clients SHOULD assume 0 — immediately stale — so an omitted hint converts one cheap cached read into a network round-trip on every access. Both defects are invisible in functional testing and both are measurable with three identical requests.

## Evidence

- **[MCP Specification 2026-07-28 — Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - tools/list result set MUST NOT vary per-connection or as a side effect of other requests (MAY vary by authorization). Servers SHOULD return tools in deterministic order — rationale given verbatim: enables client caching and 'improves LLM prompt cache hit rates'. inputSchema MUST be a valid JSON Schema object (not null); defaults to JSON Schema 2020-12. Tool names SHOULD be 1-128 chars, case-sensitive, only [A-Za-z0-9_.-], unique within a server. Full x-mcp-header constraint list including static-reachability rule (chain of only `properties` keys; never through items/oneOf/anyOf/allOf/not/if/then/else/$ref). Clients MUST exclude violating tools from tools/list. If outputSchema present, servers MUST conform. Clients MUST treat annotations as untrusted.
- **[MCP Specification 2026-07-28 — Caching](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/caching)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - 'Servers MUST include caching hints on results with resultType: "complete"' for server/discover, tools/list, prompts/list, resources/list, resources/templates/list, resources/read. ttlMs is an integer ms; servers MUST provide ttlMs >= 0. If ttlMs is absent clients SHOULD assume 0 = immediately stale. cacheScope is exactly "public" or "private". Servers MUST apply the same cacheScope to all pages of a paginated list. Public scope on an authenticated endpoint may be shared across access tokens — servers MUST NOT rely on cacheScope for access control.

## Competitor coverage

Unique. This measures a cost/latency property of an API surface rather than a content property, so it falls outside every SEO/AEO tool's model. Lighthouse's layout-stability-for-agents metric is the closest conceptual analogue but applies to rendered DOM, not to JSON-RPC result stability. MCP Inspector issues tools/list once and has no repeat-call differential.

## Implementation sketch

Issue tools/list three times: calls 1 and 2 on the same keep-alive connection ~2s apart, call 3 on a freshly established TCP/TLS connection ~5s later. For each response with `resultType: "complete"` assert:
- `ttlMs` is present (MUST), is an integer, and is >= 0 (MUST). Grade the value: 0 or absent = no caching possible (fail); >0 = pass, and report the value so operators can see their refetch cadence.
- `cacheScope` is present and is exactly "public" or "private". Flag `cacheScope: "public"` on an endpoint that also issues a 401/WWW-Authenticate challenge as a review item — the spec warns such results may be shared across access tokens.
- Ordering: compare the array of tool `name` values across all three calls positionally. Any positional difference with identical set membership = non-deterministic ordering (SHOULD violation). Additionally hash the canonically-serialized tool array (JCS or stable-key JSON) and compare hashes — this catches key-order churn inside inputSchema objects, which breaks byte-level prompt caching even when tool order is stable.
- Set stability: assert set equality of tool names between call 2 (same connection) and call 3 (fresh connection). A difference is a direct MUST violation ('MUST NOT vary per-connection'), unless the two calls presented different authorization, which the scanner controls for by sending identical (or no) credentials.
- Pagination: if nextCursor is returned, fetch all pages and assert every page carries its own ttlMs and that `cacheScope` is identical across all pages of the request (MUST).

## Example failure

A Go-based server builds its tools slice by ranging over a map[string]Tool. Go randomizes map iteration order, so tools/list returns the same 24 tools in a different order on every call. Every agent turn that includes the tool block produces a different prefix, the provider's prompt cache misses 100% of the time, and the customer pays full input-token rates on ~18k tokens of tool schema per turn instead of the cached rate. The same server omits ttlMs entirely, so clients treat the list as immediately stale and refetch it before every turn as well.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Implementation deviations

Recorded at graduation (2026-08-22, Plan 5 Task 29).

- **The three calls are issued back to back, not 2s and 5s apart on separate connections.** The sketch's timing would add roughly 7 seconds to every scan of an MCP-bearing site, inside a 60-second scan budget shared by the whole registry. Because connection reuse is therefore not controlled, a differing tool **set** between calls is reported as a `warn` review item that names the per-connection MUST and states this deviation, rather than the `fail` a timed probe would justify. Every other determinism finding is unaffected: ordering and serialization drift show up regardless of which connection carried the request.
- **These calls deliberately bypass the per-scan probe cache.** `agent-interfaces/mcp-tool-contract-validity` reads `tools/list` through `sharedProbe`; this audit calls `postRpcRaw` directly, because a cache would answer all three calls from one response and make every determinism assertion vacuously true.
- **Two hashes, not one.** The canonical hash (every object key sorted) catches content drift; the raw hash catches key-order churn that the canonical form hides. Both break byte-level prompt caching, and the message says which one happened.
- **Caching hints are read from the result root and from `result._meta`.** Servers place them in either, and rejecting a `_meta` placement would report a compliant server as broken.
- **At most 4 `nextCursor` pages per call**, matching `agent-interfaces/mcp-tool-contract-validity`.
- **Hint checks run against the first call's pages.** Repeating them for all three would triple the finding count without adding information; drift between calls is caught by the determinism comparison instead.

## Deferred

- Timed calls on a controlled connection, which is what would upgrade a per-connection set difference from `warn` to `fail`. That needs a scanner-wide request scheduler and a socket-level API the fetcher does not expose.
- Comparing results across differing authorization. The scanner sends no credentials on any of the three calls, so authorization is held constant by construction rather than varied deliberately.
