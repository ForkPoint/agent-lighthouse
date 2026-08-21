---
check: version-downgrade-recoverability
title: "Version Downgrade Recoverability"
domain: mcp-server-quality
status: proposed
evidence_grade: A
uniqueness: unique
difficulty: static-fetch
scoring_tier: scored
reviewed: 2026-08-20
---

# Version Downgrade Recoverability

> Proposed check. Evidence grade **A** · unique · implementation: `static-fetch`

## What it checks

Negative-path probe that verifies the server fails correctly when handed a protocol version it does not support, and when the MCP-Protocol-Version header disagrees with the body's _meta. Both are MUST-level behaviors whose absence strands otherwise-compatible clients.

## Claimed mechanism (falsifiable)

With the handshake removed, the ONLY mechanism by which a client discovers a mutually supported version mid-flight is the `UnsupportedProtocolVersionError`: the spec requires code -32022 with `data.supported[]` listing the server's versions, and instructs clients to select from that list and retry. A server that instead returns a 500, a generic -32600/-32602, or a 400 with no `supported` array gives the client nothing to downgrade to — so a client whose preferred version is one revision ahead of the server's fails permanently even though a mutually supported version exists on both sides. Separately, the spec requires the header and the `_meta` value to agree, with a 400 + -32020 HeaderMismatch on divergence; a server that silently ignores the mismatch is trusting whichever source of truth its proxy layer did not, which is the exact split-brain the header-validation rules exist to prevent.

## Evidence

- **[MCP Specification 2026-07-28 — Streamable HTTP Transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)** — Model Context Protocol (Anthropic / MCP Working Groups) (spec, URL verified 2026-08-20)
  - Revision 2026-07-28 REMOVED the GET stream endpoint and protocol-level sessions (Mcp-Session-Id, Last-Event-ID). Server MUST expose one POST endpoint. Server MUST validate Origin; if Origin is present and invalid it MUST return 403 Forbidden. Every POST MUST carry MCP-Protocol-Version, Mcp-Method, and (for tools/call, resources/read, prompts/get) Mcp-Name headers; these are 'REQUIRED for compliance'. Header value MUST match the _meta body value or server MUST return 400 + JSON-RPC code -32020 HeaderMismatch. Unknown protocol version -> 400 + UnsupportedProtocolVersionError. Unknown method -> 404 + -32601. x-mcp-header constraints defined; clients MUST reject (exclude from tools/list) tools that violate them. Servers SHOULD send X-Accel-Buffering: no on SSE. GET/DELETE to endpoint SHOULD now return 405.
- **[MCP Specification 2026-07-28 — Versioning and Compatibility](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - 'There is no negotiation handshake.' Terminology: Modern = 2026-07-28+ (per-request _meta); Legacy = 2025-11-25 and earlier (initialize handshake). Unsupported version MUST return error code -32022 with data.supported[] and data.requested. Verbatim compatibility matrix: Modern client + Legacy server = FAILS. Legacy client + Modern server = FAILS. Only dual-era implementations bridge. Extensions negotiated via capabilities.extensions map with mandatory reverse-DNS prefix.

## Competitor coverage

No commercial SEO/AEO tool sends malformed JSON-RPC to a customer's MCP endpoint. MCP Inspector connects with a valid version and has no negative-path suite. The MCP conformance/validator efforts in the ecosystem target server SDK authors, not deployed sites, and none surface this as a site-level score.

## Implementation sketch

Probe A (unsupported version): repeat the server/discover POST with `MCP-Protocol-Version: 1900-01-01` AND `_meta.io.modelcontextprotocol/protocolVersion: "1900-01-01"` (they must agree so the failure is unambiguous). Assert HTTP 400, `error.code === -32022`, `Array.isArray(error.data.supported)`, `error.data.supported.length >= 1`, every entry matching /^\d{4}-\d{2}-\d{2}$/, and `error.data.requested === "1900-01-01"`. Cross-check `data.supported` against the `supportedVersions` returned by server/discover — a mismatch between the two is its own finding.
Probe B (header/body mismatch): POST with header `MCP-Protocol-Version: 2026-07-28` but `_meta` protocolVersion `2025-11-25`. Assert HTTP 400 with `error.code === -32020`. A 200 result here means the server never validates header against body.
Probe C (missing header): POST with no MCP-Protocol-Version header. Per spec the server either treats it as 2025-03-26 (dual-era, acceptable — record it) or rejects it per server validation; a 200 modern result with no header is a validation gap. Scoring: Probe A failure = critical; Probe B failure = high; Probe C = informational.

## Example failure

A SaaS vendor's server supports 2025-11-25 and 2026-07-28. Sent `1900-01-01`, its framework's generic error handler returns `500 Internal Server Error` with an HTML body. A client that prefers a hypothetical future revision receives no `supported` list, cannot downgrade, and marks the server permanently incompatible — despite 2026-07-28 being available on both ends. The same server also returns 200 for Probe B, so a gateway routing on the header while the app executes on the body can be made to disagree.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
