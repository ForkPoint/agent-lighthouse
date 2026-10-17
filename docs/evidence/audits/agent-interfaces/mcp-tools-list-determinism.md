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
sources:
  - S4
  - S5
---

# tools/list Determinism and Cache-Hint Compliance

> Shipped in v2. Evidence grade **A** · scored tier · unique · implementation: `static-fetch`

## What it checks

Repeatedly fetches tools/list, and asserts three things the spec ties directly to agent cost and latency:

- caching hints are present and well-formed — ttlMs >= 0, cacheScope in {public, private};
- tool ordering is stable across calls;
- the tool set does not vary per connection.

## Claimed mechanism (falsifiable)

The spec states its own causal rationale verbatim: deterministic ordering 'enables clients to reliably cache the tool list and improves LLM prompt cache hit rates when tools are included in model context.' Tool definitions sit near the front of the model's prompt. If their serialized bytes change between turns, the provider-side prefix cache misses, and the full tool block is re-billed at uncached rates on every single turn. Separately, servers MUST include caching hints on complete results, and when ttlMs is absent clients SHOULD assume 0 — immediately stale — so an omitted hint converts one cheap cached read into a network round-trip on every access. Both defects are invisible in functional testing and both are measurable with three identical requests.

## Evidence

- **[MCP Specification 2026-07-28 — Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - tools/list result set MUST NOT vary per-connection or as a side effect of other requests (MAY vary by authorization). Servers SHOULD return tools in deterministic order — rationale given verbatim: enables client caching and 'improves LLM prompt cache hit rates'. inputSchema MUST be a valid JSON Schema object (not null); defaults to JSON Schema 2020-12. Tool names SHOULD be 1-128 chars, case-sensitive, only [A-Za-z0-9_.-], unique within a server. Full x-mcp-header constraint list including static-reachability rule (chain of only `properties` keys; never through items/oneOf/anyOf/allOf/not/if/then/else/$ref). Clients MUST exclude violating tools from tools/list. If outputSchema present, servers MUST conform. Clients MUST treat annotations as untrusted.
- **[MCP Specification 2026-07-28 — Caching](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/caching)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - 'Servers MUST include caching hints on results with resultType: "complete"' for server/discover, tools/list, prompts/list, resources/list, resources/templates/list, resources/read. ttlMs is an integer ms; servers MUST provide ttlMs >= 0. If ttlMs is absent clients SHOULD assume 0 = immediately stale. cacheScope is exactly "public" or "private". Servers MUST apply the same cacheScope to all pages of a paginated list. Public scope on an authenticated endpoint may be shared across access tokens — servers MUST NOT rely on cacheScope for access control.

## Example failure

A Go-based server builds its tools slice by ranging over a map[string]Tool. Go randomizes map iteration order, so tools/list returns the same 24 tools in a different order on every call. Every agent turn that includes the tool block produces a different prefix. The provider's prompt cache misses 100% of the time. The customer pays full input-token rates on about 18k tokens of tool schema per turn, instead of the cached rate. The same server omits ttlMs entirely, so clients treat the list as immediately stale and refetch it before every turn as well.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Implementation deviations

- The three calls run back to back, with no delay and no controlled fresh connection. Timed calls would add about 7 seconds to a scan.
- Because connection reuse is not controlled, a differing tool set is a `warn`, not a `fail`. Ordering and serialization drift are unaffected.
- The calls bypass the per-scan probe cache and use `postRpcRaw`. A cache would answer all three from one response.
- Two hashes are compared. The canonical hash catches content drift; the raw hash catches key-order churn.
- Caching hints are read from the result root and from `result._meta`.
- At most four `nextCursor` pages per call.
- Hint checks run on the first call's pages only.

## Deferred

- Timed calls on a controlled connection, which would justify a `fail` for a per-connection set difference. The fetcher exposes no socket-level control.
