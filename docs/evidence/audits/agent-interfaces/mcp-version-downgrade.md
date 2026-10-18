---
audit: agent-interfaces/mcp-version-downgrade
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/mcp-version-downgrade.ts
slug: mcp-version-downgrade
evidence_grade: A
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-22"
reviewed: 2026-08-20
graduated: 2026-08-22
sources:
  - S1
  - S3
---

# Version Downgrade Recoverability

> Shipped in v2. Evidence grade **A** · scored tier · unique · implementation: `static-fetch`

## What it checks

Negative-path probe that verifies the server fails correctly when handed a protocol version it does not support, and when the MCP-Protocol-Version header disagrees with the body's _meta. Both are MUST-level behaviors whose absence strands otherwise-compatible clients.

## Claimed mechanism (falsifiable)

With the handshake removed, one mechanism is left for a client to discover a mutually supported version mid-flight: the `UnsupportedProtocolVersionError`. The spec requires code -32022, with `data.supported[]` listing the server's versions, and instructs clients to select from that list and retry. A server that instead returns a 500, a generic -32600 or -32602, or a 400 with no `supported` array, gives the client nothing to downgrade to. A client whose preferred version is one revision ahead of the server's then fails permanently — even though a mutually supported version exists on both sides. Separately, the spec requires the header and the `_meta` value to agree, with a 400 and -32020 HeaderMismatch on divergence. A server that silently ignores the mismatch is trusting whichever source of truth its proxy layer did not. That is the exact split-brain the header-validation rules exist to prevent.

## Evidence

- **[MCP Specification 2026-07-28 — Streamable HTTP Transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)** — Model Context Protocol (Anthropic / MCP Working Groups) (spec, URL verified 2026-08-20)
  - Revision 2026-07-28 removed the GET stream endpoint and protocol-level sessions (Mcp-Session-Id, Last-Event-ID). Server MUST expose one POST endpoint. Server MUST validate Origin; if Origin is present and invalid it MUST return 403 Forbidden. Every POST MUST carry MCP-Protocol-Version, Mcp-Method, and (for tools/call, resources/read, prompts/get) Mcp-Name headers; these are 'REQUIRED for compliance'. Header value MUST match the _meta body value or server MUST return 400 + JSON-RPC code -32020 HeaderMismatch. Unknown protocol version -> 400 + UnsupportedProtocolVersionError. Unknown method -> 404 + -32601. x-mcp-header constraints defined; clients MUST reject (exclude from tools/list) tools that violate them. Servers SHOULD send X-Accel-Buffering: no on SSE. GET/DELETE to endpoint SHOULD now return 405.
- **[MCP Specification 2026-07-28 — Versioning and Compatibility](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - 'There is no negotiation handshake.' Terminology: Modern = 2026-07-28+ (per-request _meta); Legacy = 2025-11-25 and earlier (initialize handshake). Unsupported version MUST return error code -32022 with data.supported[] and data.requested. Verbatim compatibility matrix: Modern client + Legacy server = fails. Legacy client + Modern server = fails. Only dual-era implementations bridge. Extensions negotiated via capabilities.extensions map with mandatory reverse-DNS prefix.

## Example failure

A SaaS vendor's server supports 2025-11-25 and 2026-07-28. Sent `1900-01-01`, its framework's generic error handler returns `500 Internal Server Error` with an HTML body. A client that prefers a hypothetical future revision receives no `supported` list, cannot downgrade, and marks the server permanently incompatible — despite 2026-07-28 being available on both ends. The same server also answers 200 to a request whose `MCP-Protocol-Version` header and `_meta` version disagree, so a gateway routing on the header while the app executes on the body can be made to disagree.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Implementation deviations

- A headerless request answered with a modern result is a `warn`. A headerless rejection, or a 2025-03-26 answer, is recorded and changes nothing.
- Unsupported-version defects (probe A) fail at `critical`. Silent acceptance of a header/body mismatch (probe B) fails at `high`. A probe B rejection with the wrong error code warns.
- The headerless probe keeps `_meta` at 2025-03-26, so its result is not confused with a header/body mismatch.
- `server/discover` comes from the shared per-scan cache.
- An unreachable endpoint is `notApplicable`. `mcp-modern-era-reachability` scores reachability.
- The audit does not retry with a revision from `data.supported`. Being told how to recover is the MUST it checks.
- 2026-10-18: an unauthenticated probe answered with HTTP 401 or 403 is not applicable. The server requires sign-in, so its version negotiation cannot be judged without credentials. It used to fail at critical. Reachability and the 401 challenge are judged by `mcp-modern-era-reachability` and `mcp-oauth-discovery-chain`.
