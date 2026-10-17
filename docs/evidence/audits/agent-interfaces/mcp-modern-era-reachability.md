---
audit: agent-interfaces/mcp-modern-era-reachability
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/mcp-modern-era-reachability.ts
slug: mcp-modern-era-reachability
evidence_grade: A
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-22"
reviewed: 2026-08-20
graduated: 2026-08-22
sources:
  - S1
  - S2
  - S3
  - S13
  - mcp-spec-2025-06-18-transports
---

# Modern-Era Reachability Probe (server/discover)

> Shipped in v2. Evidence grade **A** · scored tier · unique · implementation: `static-fetch`

## What it checks

Determine, with one unauthenticated stateless POST, whether the site's MCP endpoint can be used at all by a client built on the current protocol revision (2026-07-28). Classifies the endpoint into modern / dual-era / legacy-only / deprecated-HTTP+SSE / unreachable, and extracts supportedVersions, capabilities, instructions and serverInfo from the DiscoverResult.

## Claimed mechanism (falsifiable)

Revision 2026-07-28 abolished the `initialize` handshake and protocol-level sessions: version, client identity and capabilities now travel as per-request `_meta`, and `server/discover` is a MUST-implement RPC. The spec's own compatibility matrix states verbatim that a Modern client against a Legacy server fails, with no fall-forward path. The test follows. Send a single POST of `server/discover` carrying `_meta` and `MCP-Protocol-Version: 2026-07-28`. If it yields neither a DiscoverResult nor a recognized modern JSON-RPC error, then every client that has moved to the current revision cannot invoke a single tool on this server. The failure is total, not degraded. Conversely a 404/-32601 on `server/discover` from a server that otherwise answers modern requests is a direct MUST violation that breaks pre-consent capability presentation.

## Evidence

- **[MCP Specification 2026-07-28 — Streamable HTTP Transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)** — Model Context Protocol (Anthropic / MCP Working Groups) (spec, URL verified 2026-08-20)
  - Revision 2026-07-28 removed the GET stream endpoint and protocol-level sessions (Mcp-Session-Id, Last-Event-ID). Server MUST expose one POST endpoint. Server MUST validate Origin; if Origin is present and invalid it MUST return 403 Forbidden. Every POST MUST carry MCP-Protocol-Version, Mcp-Method, and (for tools/call, resources/read, prompts/get) Mcp-Name headers; these are 'REQUIRED for compliance'. Header value MUST match the _meta body value or server MUST return 400 + JSON-RPC code -32020 HeaderMismatch. Unknown protocol version -> 400 + UnsupportedProtocolVersionError. Unknown method -> 404 + -32601. x-mcp-header constraints defined; clients MUST reject (exclude from tools/list) tools that violate them. Servers SHOULD send X-Accel-Buffering: no on SSE. GET/DELETE to endpoint SHOULD now return 405.
- **[Playwright: Auto-waiting / Actionability checks](https://playwright.dev/docs/actionability)** — Microsoft (vendor-doc, URL verified 2026-08-20)
  - Before click/check/fill/selectOption, Playwright enforces five checks: Visible (non-empty bounding box, not visibility:hidden), Stable (same bounding box over 2 animation frames), Receives Events (element is the hit target at the action point — overlays cause failure), Enabled (not [disabled]/aria-disabled), Editable (not readonly/aria-readonly). Fill requires visible+enabled+editable. This is the exact gate every Playwright-based agent (Playwright-MCP, browser-use, most CUA harnesses) passes through, so each check is a directly testable site-side failure cause.
- **[MCP Specification 2026-07-28 — Versioning and Compatibility](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - 'There is no negotiation handshake.' Terminology: Modern = 2026-07-28+ (per-request _meta); Legacy = 2025-11-25 and earlier (initialize handshake). Unsupported version MUST return error code -32022 with data.supported[] and data.requested. Verbatim compatibility matrix: Modern client + Legacy server = fails. Legacy client + Modern server = fails. Only dual-era implementations bridge. Extensions negotiated via capabilities.extensions map with mandatory reverse-DNS prefix.
- **[MCP Specification (latest) — index](https://modelcontextprotocol.io/specification/latest)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - Confirms the current authoritative revision is 2026-07-28 (schema/2026-07-28/schema.ts). Lists optional extensions negotiated in capabilities: Tasks (io.modelcontextprotocol/tasks), MCP Apps (io.modelcontextprotocol/ui), Skills over MCP. Restates that annotations describing tool behavior 'should be considered untrusted, unless obtained from a trusted server'.
- **[MCP Specification 2025-06-18 — Transports (superseded baseline)](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - The legacy-era shape used for backward-compat detection: Mcp-Session-Id assigned in the InitializeResult, GET opens a standalone SSE stream or returns 405, DELETE terminates a session, Last-Event-ID resumability, and servers SHOULD assume 2025-03-26 when MCP-Protocol-Version is absent. Also documents the deprecated 2024-11-05 HTTP+SSE detection path (GET returns an `endpoint` event as the first SSE event).

## Example failure

A retailer ships `https://shop.example.com/mcp` on an SDK pinned to protocol 2025-06-18. Probing it with a modern request returns `400 Bad Request` with an empty body and no JSON-RPC error, and a legacy `initialize` POST returns 200 with an `Mcp-Session-Id` header. Verdict: legacy-only. Any shopping agent whose client has adopted 2026-07-28 gets a hard failure on first contact. It cannot even enumerate the catalog tools. There is no downgrade signal to act on, because the 400 body carries no recognized modern error.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Implementation deviations

- A `-32022` rejection ("modern era, older revision") is a `warn`. The audit is ternary, so there is no lower passing grade.
- The endpoint comes only from `discoverMcpEndpoint` in `gatherers/mcp.ts`: `servers.json`, `/.well-known/ucp` or `/.well-known/ai-catalog.json`. The audit never probes an undeclared `/mcp`.
- `server/discover`, the GET and the DELETE go through `sharedProbe`, so the MCP audits issue each request once per scan.
- A GET that opens an SSE stream with an `endpoint` event is reported as the deprecated 2024-11-05 transport, whatever the POST returned.
- The legacy `initialize` POST fires only when nothing modern came back. LEGACY-ONLY requires an `Mcp-Session-Id` header on its response.

## Deferred

- Re-probing after a 401 challenge with a token. Acquiring credentials is out of scope for an unauthenticated scanner.
- Judging the quality of `instructions`.
