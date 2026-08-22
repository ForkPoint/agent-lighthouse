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
---


# Tool Contract Validity and Silent-Drop Risk

> Shipped in v2. Evidence grade **A** · scored tier · unique · implementation: `static-fetch`

## What it checks

Static validation of every tool definition returned by tools/list against the MUST/SHOULD-level structural rules in the 2026-07-28 tools spec — with special weight on x-mcp-header violations, which oblige conforming clients to silently remove the offending tool from the list they show the model.

## Claimed mechanism (falsifiable)

The spec gives clients an explicit deletion instruction: 'Clients using the Streamable HTTP transport MUST reject tool definitions where any x-mcp-header value violates these constraints. Rejection means the client MUST exclude the invalid tool from the result of tools/list.' This makes malformed tool metadata a silent-invisibility bug rather than an error: the server returns the tool, logs a successful tools/list, and the model never sees it. The constraint set is fully machine-checkable with no network calls beyond the one list fetch — token syntax, no CR/LF, case-insensitive uniqueness, primitive types only with `number` explicitly excluded, and static reachability through a chain consisting solely of `properties` keys. Alongside it, `inputSchema` MUST be a valid JSON Schema object and not null; a null or scalar inputSchema breaks argument construction in every SDK.

## Evidence

- **[MCP Specification 2026-07-28 — Streamable HTTP Transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)** — Model Context Protocol (Anthropic / MCP Working Groups) (spec, URL verified 2026-08-20)
  - Revision 2026-07-28 REMOVED the GET stream endpoint and protocol-level sessions (Mcp-Session-Id, Last-Event-ID). Server MUST expose one POST endpoint. Server MUST validate Origin; if Origin is present and invalid it MUST return 403 Forbidden. Every POST MUST carry MCP-Protocol-Version, Mcp-Method, and (for tools/call, resources/read, prompts/get) Mcp-Name headers; these are 'REQUIRED for compliance'. Header value MUST match the _meta body value or server MUST return 400 + JSON-RPC code -32020 HeaderMismatch. Unknown protocol version -> 400 + UnsupportedProtocolVersionError. Unknown method -> 404 + -32601. x-mcp-header constraints defined; clients MUST reject (exclude from tools/list) tools that violate them. Servers SHOULD send X-Accel-Buffering: no on SSE. GET/DELETE to endpoint SHOULD now return 405.
- **[MCP Specification 2026-07-28 — Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - tools/list result set MUST NOT vary per-connection or as a side effect of other requests (MAY vary by authorization). Servers SHOULD return tools in deterministic order — rationale given verbatim: enables client caching and 'improves LLM prompt cache hit rates'. inputSchema MUST be a valid JSON Schema object (not null); defaults to JSON Schema 2020-12. Tool names SHOULD be 1-128 chars, case-sensitive, only [A-Za-z0-9_.-], unique within a server. Full x-mcp-header constraint list including static-reachability rule (chain of only `properties` keys; never through items/oneOf/anyOf/allOf/not/if/then/else/$ref). Clients MUST exclude violating tools from tools/list. If outputSchema present, servers MUST conform. Clients MUST treat annotations as untrusted.

## Competitor coverage

Nothing in the SEO/AEO space parses MCP tool schemas. MCP Inspector displays tool schemas but does not run the x-mcp-header constraint suite or the static-reachability walk; it is a manual inspection UI. Lighthouse's agentic category validates WebMCP tool registration in-page, not remote inputSchema conformance.

## Implementation sketch

POST tools/list (paginating on nextCursor). For each tool assert:
- `inputSchema` exists, is a plain object, is not null, and has `type === "object"` (MUST).
- Every string in `inputSchema.required` is a key of `inputSchema.properties` (dangling required entries make every call fail validation client-side).
- `name`: length 1-128, matches /^[A-Za-z0-9_.\-]+$/, and is unique within the server (all three SHOULD). Additionally flag names outside plain printable ASCII 0x21-0x7E, which force the client into the `=?base64?…?=` sentinel encoding of the Mcp-Name header.
- x-mcp-header sweep: walk the entire inputSchema and collect every occurrence of the `x-mcp-header` key. For each, assert (a) value is a non-empty string; (b) matches RFC 9110 tchar: /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/; (c) contains no \r or \n; (d) is case-insensitively unique among all x-mcp-header values in that same inputSchema; (e) the annotated property's `type` is exactly one of string/integer/boolean — `number` is a violation; (f) the path from the schema root to the annotated property consists ONLY of `properties` keys — any hop through `items`, `oneOf`, `anyOf`, `allOf`, `not`, `if`, `then`, `else` or `$ref` is a violation. Report each violating tool as CRITICAL with the explicit consequence 'conforming Streamable HTTP clients MUST drop this tool from tools/list'.
- If `outputSchema` is present, assert it parses as a JSON Schema object (servers MUST then conform to it at call time).
Score = (tools passing all MUSTs / total tools), with any x-mcp-header violation forcing a failing grade regardless of ratio.

## Example failure

A logistics API exposes `track_shipment` whose inputSchema declares `{"type":"object","properties":{"shipments":{"type":"array","items":{"type":"object","properties":{"region":{"type":"string","x-mcp-header":"Region"}}}}}}`. The annotation sits behind an `items` keyword, so it is not statically reachable from the root. Per spec the annotation — and therefore the whole tool definition — is invalid, and every conforming client excludes `track_shipment` from tools/list. The server's dashboards show tools/list being called thousands of times a day and zero calls to track_shipment, with no error anywhere to explain it.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Implementation deviations

Recorded at graduation (2026-08-22, Plan 5 Task 28).

- **Pass ratio is reported, not scored directly.** The sketch proposed `score = tools passing all MUSTs / total tools`. This audit is ternary, so the ratio appears in `found` and in the failure message while the status is decided by the rules themselves: any MUST-level defect fails, SHOULD-level naming defects warn, otherwise pass. That keeps the sketch's own override — "any `x-mcp-header` violation forces a failing grade regardless of ratio" — true by construction rather than as a special case.
- **Name rules are SHOULD-level, as the sketch classifies them, so they warn.** Length over 128, characters outside `/^[A-Za-z0-9_.\-]+$/`, non-printable-ASCII names and duplicates are reported as warnings. A missing `name` is a MUST and fails.
- **`$ref` is treated as a hop, not resolved.** A schema that reaches an `x-mcp-header` through `$ref` is a violation whatever the reference points at, which is exactly the client's static-reachability rule; no reference resolution is attempted.
- **At most 4 `nextCursor` pages are followed.** A server paginating past that is reported in `found` as stopped at the limit rather than silently truncated.
- **`tools/list` responses are shared per scan**, keyed by endpoint and cursor, so this audit and `agent-interfaces/mcp-modern-era-reachability` do not each pay for the same page. `agent-interfaces/mcp-tools-list-determinism` deliberately bypasses that cache.
- **A server that lists no tools is `notApplicable`.** There is no contract to validate, and whether the endpoint answers at all is scored by `agent-interfaces/mcp-modern-era-reachability`.

## Deferred

- Calling any tool. Every rule checked here is static, which is the point: the whole audit costs one `tools/list` fetch.
- Validating that results conform to a declared `outputSchema`. That needs a call, and a call has side effects.
- Full JSON Schema validation of `inputSchema` beyond the structural MUSTs (object, `type: "object"`, no dangling `required`).
