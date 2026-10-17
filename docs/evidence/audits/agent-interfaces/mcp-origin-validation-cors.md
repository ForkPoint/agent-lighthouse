---
audit: agent-interfaces/mcp-origin-validation-cors
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/mcp-origin-validation-cors.ts
slug: mcp-origin-validation-cors
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - S1
  - S8
---

# Origin Validation and CORS Coherence

> Shipped in v2. Evidence grade **B** · scored tier · unique · implementation: `static-fetch`

## What it checks

Probes whether the endpoint enforces any Origin policy at all, and whether its CORS response headers are coherent with its authentication posture — specifically catching wildcard or reflected Access-Control-Allow-Origin on an endpoint that also accepts bearer credentials.

## Claimed mechanism (falsifiable)

The transport spec is unambiguous: 'Servers MUST validate the Origin header on all incoming connections to prevent DNS rebinding attacks. If the Origin header is present and invalid, servers MUST respond with HTTP 403 Forbidden.' The concrete, unambiguous defect a scanner can prove is the CORS pairing. A server that reflects an arbitrary request Origin into Access-Control-Allow-Origin, while also returning Access-Control-Allow-Credentials: true, has authorized any web page the user visits to make credentialed requests to the MCP endpoint on that user's behalf. That means enumerating the tool surface and invoking tools with the user's session. Wildcard ACAO alone is weaker evidence (it is a legitimate configuration for a deliberately public, unauthenticated server), which is why this is graded B and scored only when the endpoint also presents an authentication challenge or accepts credentials.

## Evidence

- **[MCP Specification 2026-07-28 — Streamable HTTP Transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)** — Model Context Protocol (Anthropic / MCP Working Groups) (spec, URL verified 2026-08-20)
  - Revision 2026-07-28 removed the GET stream endpoint and protocol-level sessions (Mcp-Session-Id, Last-Event-ID). Server MUST expose one POST endpoint. Server MUST validate Origin; if Origin is present and invalid it MUST return 403 Forbidden. Every POST MUST carry MCP-Protocol-Version, Mcp-Method, and (for tools/call, resources/read, prompts/get) Mcp-Name headers; these are 'REQUIRED for compliance'. Header value MUST match the _meta body value or server MUST return 400 + JSON-RPC code -32020 HeaderMismatch. Unknown protocol version -> 400 + UnsupportedProtocolVersionError. Unknown method -> 404 + -32601. x-mcp-header constraints defined; clients MUST reject (exclude from tools/list) tools that violate them. Servers SHOULD send X-Accel-Buffering: no on SSE. GET/DELETE to endpoint SHOULD now return 405.
- **[MCP Security Best Practices (2026-07-28)](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices.md)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - Token passthrough: 'MCP servers MUST NOT accept any tokens that were not explicitly issued for the MCP server.' Scope minimization: 'Common Mistakes' list names publishing all possible scopes in scopes_supported and using wildcard/omnibus scopes (*, all, full-access). State handle hijacking replaces session hijacking now that MCP is stateless: servers MUST NOT treat possession of a state handle as authentication; SHOULD use non-deterministic handles bound server-side to the authenticated user. SSRF section: clients SHOULD require HTTPS for all OAuth-related URLs and block private/link-local ranges (169.254.0.0/16 etc.).

## Example failure

An enterprise MCP endpoint at https://mcp.example.com/mcp returns 401 with a proper WWW-Authenticate challenge, but its edge config was copied from a public API and echoes any request Origin into Access-Control-Allow-Origin with Access-Control-Allow-Credentials: true. A user authenticated to a browser-based MCP client visits an unrelated page; that page can POST tools/list and then tools/call to mcp.example.com with the user's cookies attached, reading the full tool surface and invoking it. The POST probe with a throwaway Origin returns 200 rather than the required 403, confirming no Origin policy exists.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Implementation deviations

- The throwaway origin is `https://al-probe-<12 hex>.example`. RFC 2606 reserves `.example`, so it belongs to no one.
- Credential acceptance is read from the endpoint itself: a 401 with `WWW-Authenticate`, or `Access-Control-Allow-Headers` that admits `authorization`. Audits cannot read each other's results.
- An endpoint with no authentication surface is never scored on missing Origin differentiation or permissive CORS. That case is a note.
- The baseline discover call is the shared probe, so this audit adds two requests.
- `X-Accel-Buffering` is a note and never scored.

## Deferred

- SSE-specific probing. `X-Accel-Buffering` is read from whatever response carries it, not from a held-open stream.
- Checking that an invalid Origin gets exactly 403. The audit scores differentiation, since a 400 or 401 also proves the header is read.
