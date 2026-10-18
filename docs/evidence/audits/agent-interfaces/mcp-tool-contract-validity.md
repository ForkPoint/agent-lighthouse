---
audit: agent-interfaces/mcp-tool-contract-validity
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/mcp-tool-contract-validity.ts
slug: mcp-tool-contract-validity
evidence_grade: A
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-22"
reviewed: 2026-08-20
graduated: 2026-08-22
sources:
  - S1
  - S4
---

# Tool Contract Validity and Silent-Drop Risk

> Shipped in v2. Evidence grade **A** · scored tier · unique · implementation: `static-fetch`

## What it checks

Static validation of every tool definition returned by tools/list, against the MUST and SHOULD-level structural rules in the 2026-07-28 tools spec. Special weight falls on x-mcp-header violations. Those oblige conforming clients to silently remove the offending tool from the list they show the model.

## Claimed mechanism (falsifiable)

The spec gives clients an explicit deletion instruction: 'Clients using the Streamable HTTP transport MUST reject tool definitions where any x-mcp-header value violates these constraints. Rejection means the client MUST exclude the invalid tool from the result of tools/list.' This makes malformed tool metadata a silent-invisibility bug rather than an error: the server returns the tool, logs a successful tools/list, and the model never sees it. The constraint set is fully machine-checkable with no network calls beyond the one list fetch — token syntax, no CR/LF, case-insensitive uniqueness, primitive types only with `number` explicitly excluded, and static reachability through a chain consisting solely of `properties` keys. Alongside it, `inputSchema` MUST be a valid JSON Schema object and not null; a null or scalar inputSchema breaks argument construction in every SDK.

## Evidence

- **[MCP Specification 2026-07-28 — Streamable HTTP Transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)** — Model Context Protocol (Anthropic / MCP Working Groups) (spec, URL verified 2026-08-20)
  - Revision 2026-07-28 removed the GET stream endpoint and protocol-level sessions (Mcp-Session-Id, Last-Event-ID). Server MUST expose one POST endpoint. Server MUST validate Origin; if Origin is present and invalid it MUST return 403 Forbidden. Every POST MUST carry MCP-Protocol-Version, Mcp-Method, and (for tools/call, resources/read, prompts/get) Mcp-Name headers; these are 'REQUIRED for compliance'. Header value MUST match the _meta body value or server MUST return 400 + JSON-RPC code -32020 HeaderMismatch. Unknown protocol version -> 400 + UnsupportedProtocolVersionError. Unknown method -> 404 + -32601. x-mcp-header constraints defined; clients MUST reject (exclude from tools/list) tools that violate them. Servers SHOULD send X-Accel-Buffering: no on SSE. GET/DELETE to endpoint SHOULD now return 405.
- **[MCP Specification 2026-07-28 — Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - tools/list result set MUST NOT vary per-connection or as a side effect of other requests (MAY vary by authorization). Servers SHOULD return tools in deterministic order — rationale given verbatim: enables client caching and 'improves LLM prompt cache hit rates'. inputSchema MUST be a valid JSON Schema object (not null); defaults to JSON Schema 2020-12. Tool names SHOULD be 1-128 chars, case-sensitive, only [A-Za-z0-9_.-], unique within a server. Full x-mcp-header constraint list including static-reachability rule (chain of only `properties` keys; never through items/oneOf/anyOf/allOf/not/if/then/else/$ref). Clients MUST exclude violating tools from tools/list. If outputSchema present, servers MUST conform. Clients MUST treat annotations as untrusted.

## Example failure

A logistics API exposes `track_shipment` whose inputSchema declares `{"type":"object","properties":{"shipments":{"type":"array","items":{"type":"object","properties":{"region":{"type":"string","x-mcp-header":"Region"}}}}}}`. The annotation sits behind an `items` keyword, so it is not statically reachable from the root. Per spec the annotation — and therefore the whole tool definition — is invalid, and every conforming client excludes `track_shipment` from tools/list. The server's dashboards show tools/list being called thousands of times a day and zero calls to track_shipment, with no error anywhere to explain it.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Implementation deviations

- The pass ratio is reported in `found`, not scored. Any MUST-level defect fails, SHOULD-level naming defects warn, otherwise pass. An `x-mcp-header` violation therefore always fails.
- Name rules warn: length over 128, characters outside `/^[A-Za-z0-9_.\-]+$/`, non-printable ASCII and duplicates. A missing `name` fails.
- `$ref` is treated as a hop and never resolved. That matches the client's static-reachability rule.
- At most four `nextCursor` pages are followed. Stopping at the limit is reported in `found`.
- `tools/list` pages go through the shared per-scan cache, keyed by endpoint and cursor. `mcp-tools-list-determinism` bypasses it on purpose.
- A server that lists no tools is `notApplicable`.
- 2026-10-18: a `tools/list` answered with HTTP 401 or 403 is not applicable, and the message names the sign-in requirement. The verdict was already not applicable; only the message changed.

## Deferred

- Calling any tool. Every rule here is static and costs one `tools/list` fetch.
- Checking results against a declared `outputSchema`. That needs a call, and a call has side effects.
- Full JSON Schema validation of `inputSchema` beyond the structural MUSTs.
