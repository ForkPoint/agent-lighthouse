---
check: modern-era-reachability-probe-server-discover
title: "Modern-Era Reachability Probe (server/discover)"
domain: mcp-server-quality
status: proposed
evidence_grade: A
uniqueness: unique
difficulty: static-fetch
scoring_tier: scored
reviewed: 2026-08-20
---

# Modern-Era Reachability Probe (server/discover)

> Proposed check. Evidence grade **A** · unique · implementation: `static-fetch`

## What it checks

Determine, with one unauthenticated stateless POST, whether the site's MCP endpoint can be used at all by a client built on the current protocol revision (2026-07-28). Classifies the endpoint into modern / dual-era / legacy-only / deprecated-HTTP+SSE / unreachable, and extracts supportedVersions, capabilities, instructions and serverInfo from the DiscoverResult.

## Claimed mechanism (falsifiable)

Revision 2026-07-28 abolished the `initialize` handshake and protocol-level sessions: version, client identity and capabilities now travel as per-request `_meta`, and `server/discover` is a MUST-implement RPC. The spec's own compatibility matrix states verbatim that a Modern client against a Legacy server FAILS, with no fall-forward path. Therefore: if a single POST of `server/discover` carrying `_meta` + `MCP-Protocol-Version: 2026-07-28` does not yield either a DiscoverResult or a recognized modern JSON-RPC error, then every client that has moved to the current revision cannot invoke a single tool on this server — the failure is total, not degraded. Conversely a 404/-32601 on `server/discover` from a server that otherwise answers modern requests is a direct MUST violation that breaks pre-consent capability presentation.

## Evidence

- **[MCP Specification 2026-07-28 — Streamable HTTP Transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)** — Model Context Protocol (Anthropic / MCP Working Groups) (spec, URL verified 2026-08-20)
  - Revision 2026-07-28 REMOVED the GET stream endpoint and protocol-level sessions (Mcp-Session-Id, Last-Event-ID). Server MUST expose one POST endpoint. Server MUST validate Origin; if Origin is present and invalid it MUST return 403 Forbidden. Every POST MUST carry MCP-Protocol-Version, Mcp-Method, and (for tools/call, resources/read, prompts/get) Mcp-Name headers; these are 'REQUIRED for compliance'. Header value MUST match the _meta body value or server MUST return 400 + JSON-RPC code -32020 HeaderMismatch. Unknown protocol version -> 400 + UnsupportedProtocolVersionError. Unknown method -> 404 + -32601. x-mcp-header constraints defined; clients MUST reject (exclude from tools/list) tools that violate them. Servers SHOULD send X-Accel-Buffering: no on SSE. GET/DELETE to endpoint SHOULD now return 405.
- **[Playwright: Auto-waiting / Actionability checks](https://playwright.dev/docs/actionability)** — Microsoft (vendor-doc, URL verified 2026-08-20)
  - Before click/check/fill/selectOption, Playwright enforces five checks: Visible (non-empty bounding box, not visibility:hidden), Stable (same bounding box over 2 animation frames), Receives Events (element is the hit target at the action point — overlays cause failure), Enabled (not [disabled]/aria-disabled), Editable (not readonly/aria-readonly). Fill requires visible+enabled+editable. This is the exact gate every Playwright-based agent (Playwright-MCP, browser-use, most CUA harnesses) passes through, so each check is a directly testable site-side failure cause.
- **[MCP Specification 2026-07-28 — Versioning and Compatibility](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - 'There is no negotiation handshake.' Terminology: Modern = 2026-07-28+ (per-request _meta); Legacy = 2025-11-25 and earlier (initialize handshake). Unsupported version MUST return error code -32022 with data.supported[] and data.requested. Verbatim compatibility matrix: Modern client + Legacy server = FAILS. Legacy client + Modern server = FAILS. Only dual-era implementations bridge. Extensions negotiated via capabilities.extensions map with mandatory reverse-DNS prefix.
- **[MCP Specification (latest) — index](https://modelcontextprotocol.io/specification/latest)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - Confirms the current authoritative revision is 2026-07-28 (schema/2026-07-28/schema.ts). Lists optional extensions negotiated in capabilities: Tasks (io.modelcontextprotocol/tasks), MCP Apps (io.modelcontextprotocol/ui), Skills over MCP. Restates that annotations describing tool behavior 'should be considered untrusted, unless obtained from a trusted server'.
- **[MCP Specification 2025-06-18 — Transports (superseded baseline)](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - The legacy-era shape used for backward-compat detection: Mcp-Session-Id assigned in the InitializeResult, GET opens a standalone SSE stream or returns 405, DELETE terminates a session, Last-Event-ID resumability, and servers SHOULD assume 2025-03-26 when MCP-Protocol-Version is absent. Also documents the deprecated 2024-11-05 HTTP+SSE detection path (GET returns an `endpoint` event as the first SSE event).

## Competitor coverage

Lighthouse's Agentic Browsing category audits WebMCP — in-page tools registered via navigator.modelContext — which is a different surface entirely and never opens a socket to a remote MCP endpoint. Profound, Otterly, Semrush and Ahrefs AI toolkits are answer-engine citation/visibility trackers and issue no JSON-RPC at all. MCP Inspector and mcpjam can connect to a server but are interactive developer tools, not scored site audits, and neither classifies protocol era or reports it as a readiness grade.

## Implementation sketch

Resolve the candidate MCP endpoint (from a registry match, an llms.txt reference, a documented /mcp path, or user config). Issue:

POST <endpoint>
Content-Type: application/json
Accept: application/json, text/event-stream
MCP-Protocol-Version: 2026-07-28
Mcp-Method: server/discover

{"jsonrpc":"2.0","id":"al-1","method":"server/discover","params":{"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientInfo":{"name":"AgentLighthouse","version":"1.0.0"},"io.modelcontextprotocol/clientCapabilities":{}}}}

Handle both Content-Type: application/json and text/event-stream (parse the final SSE data: frame). Classify:
- 200 + result.supportedVersions includes "2026-07-28" -> PASS (modern). Record capabilities keys, capabilities.extensions ids, presence of `instructions`, and serverInfo.
- 400 + error.code === -32022 -> modern era but older revision; read error.data.supported[] and report the newest supported.
- 401 + WWW-Authenticate -> auth-gated; hand off to the OAuth Discovery Chain check and re-probe after noting the challenge.
- 404 + error.code === -32601 -> MUST violation: modern server that does not implement server/discover.
- 400/404/405 with an empty or non-JSON-RPC body, or a body demanding `initialize` -> LEGACY-ONLY. Confirm by POSTing a legacy `initialize` and checking for an Mcp-Session-Id response header.
- GET <endpoint> returning text/event-stream whose first event is `endpoint` -> deprecated 2024-11-05 HTTP+SSE only (FAIL, deprecated since 2025-03-26 and eligible for removal).
Also flag legacy residue on a modern server: a GET or DELETE that does not return 405, or a minted/echoed Mcp-Session-Id.

## Example failure

A retailer ships `https://shop.example.com/mcp` on an SDK pinned to protocol 2025-06-18. Probing it with a modern request returns `400 Bad Request` with an empty body and no JSON-RPC error, and a legacy `initialize` POST returns 200 with an `Mcp-Session-Id` header. Verdict: legacy-only. Any shopping agent whose client has adopted 2026-07-28 gets a hard failure on first contact — it cannot even enumerate the catalog tools, and there is no downgrade signal to act on because the 400 body carries no recognized modern error.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
