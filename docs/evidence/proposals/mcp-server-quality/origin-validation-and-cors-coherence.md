---
check: origin-validation-and-cors-coherence
title: "Origin Validation and CORS Coherence"
domain: mcp-server-quality
status: proposed
evidence_grade: B
uniqueness: unique
difficulty: static-fetch
scoring_tier: scored
reviewed: 2026-08-20
---

# Origin Validation and CORS Coherence

> Proposed check. Evidence grade **B** · unique · implementation: `static-fetch`

## What it checks

Probes whether the endpoint enforces any Origin policy at all, and whether its CORS response headers are coherent with its authentication posture — specifically catching wildcard or reflected Access-Control-Allow-Origin on an endpoint that also accepts bearer credentials.

## Claimed mechanism (falsifiable)

The transport spec is unambiguous: 'Servers MUST validate the Origin header on all incoming connections to prevent DNS rebinding attacks. If the Origin header is present and invalid, servers MUST respond with HTTP 403 Forbidden.' The concrete, non-ambiguous defect a scanner can prove is the CORS pairing: a server that reflects an arbitrary request Origin into Access-Control-Allow-Origin while also returning Access-Control-Allow-Credentials: true has authorized any web page the user visits to make credentialed requests to the MCP endpoint on that user's behalf — enumerating the tool surface and invoking tools with the user's session. Wildcard ACAO alone is weaker evidence (it is a legitimate configuration for a deliberately public, unauthenticated server), which is why this is graded B and scored only when the endpoint also presents an authentication challenge or accepts credentials.

## Evidence

- **[MCP Specification 2026-07-28 — Streamable HTTP Transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)** — Model Context Protocol (Anthropic / MCP Working Groups) (spec, URL verified 2026-08-20)
  - Revision 2026-07-28 REMOVED the GET stream endpoint and protocol-level sessions (Mcp-Session-Id, Last-Event-ID). Server MUST expose one POST endpoint. Server MUST validate Origin; if Origin is present and invalid it MUST return 403 Forbidden. Every POST MUST carry MCP-Protocol-Version, Mcp-Method, and (for tools/call, resources/read, prompts/get) Mcp-Name headers; these are 'REQUIRED for compliance'. Header value MUST match the _meta body value or server MUST return 400 + JSON-RPC code -32020 HeaderMismatch. Unknown protocol version -> 400 + UnsupportedProtocolVersionError. Unknown method -> 404 + -32601. x-mcp-header constraints defined; clients MUST reject (exclude from tools/list) tools that violate them. Servers SHOULD send X-Accel-Buffering: no on SSE. GET/DELETE to endpoint SHOULD now return 405.
- **[MCP Security Best Practices (2026-07-28)](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices.md)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - Token passthrough: 'MCP servers MUST NOT accept any tokens that were not explicitly issued for the MCP server.' Scope minimization: 'Common Mistakes' list names publishing all possible scopes in scopes_supported and using wildcard/omnibus scopes (*, all, full-access). State handle hijacking replaces session hijacking now that MCP is stateless: servers MUST NOT treat possession of a state handle as authentication; SHOULD use non-deterministic handles bound server-side to the authenticated user. SSRF section: clients SHOULD require HTTPS for all OAuth-related URLs and block private/link-local ranges (169.254.0.0/16 etc.).

## Competitor coverage

Generic web security scanners test CORS, but none start from an MCP endpoint, none know that the MCP transport spec elevates Origin validation to a MUST with a specified 403, and none gate the finding on the endpoint's MCP authentication posture. No SEO/AEO tool or Lighthouse audit covers any of this. Roadmap note: the SSE buffering sub-signal requires holding a streaming response open, so it belongs in a later pass than the pure header probes.

## Implementation sketch

Generate a throwaway origin such as https://al-probe-<random>.example (never a real third-party domain).
- Probe A: POST server/discover with `Origin: https://al-probe-<random>.example`. Record the status. Compare against the identical request with no Origin header. If both return 200 identically, the server applies no Origin policy — report as a MUST-violation finding, scored only when the endpoint is credential-accepting (see gating below).
- Probe B: OPTIONS preflight to the endpoint with `Origin: <throwaway>`, `Access-Control-Request-Method: POST`, `Access-Control-Request-Headers: content-type, mcp-protocol-version, authorization`. Record Access-Control-Allow-Origin, -Allow-Credentials, -Allow-Headers, -Max-Age.
- Findings, in descending severity: (1) ACAO reflects the throwaway origin verbatim AND Allow-Credentials: true -> CRITICAL, unambiguous defect regardless of auth posture; (2) ACAO: * AND the endpoint returns 401/WWW-Authenticate or accepts an Authorization header (Allow-Headers includes authorization) -> HIGH; (3) no Origin differentiation on a credential-accepting endpoint -> MEDIUM; (4) permissive CORS on an endpoint that is anonymous and read-only by construction -> INFORMATIONAL, explicitly not scored.
- Gating: determine credential-acceptance from the OAuth Discovery Chain check (did the endpoint issue a 401 with WWW-Authenticate?) and from whether Access-Control-Allow-Headers admits `authorization`. Never score findings 3 or 4 against an endpoint with no auth surface.
- Also record whether SSE responses carry `X-Accel-Buffering: no` (SHOULD-level; its absence lets reverse proxies buffer streamed tool output and stall progress notifications) — reported as a separate advisory line item rather than folded into the CORS score.

## Example failure

An enterprise MCP endpoint at https://mcp.example.com/mcp returns 401 with a proper WWW-Authenticate challenge, but its edge config was copied from a public API and echoes any request Origin into Access-Control-Allow-Origin with Access-Control-Allow-Credentials: true. A user authenticated to a browser-based MCP client visits an unrelated page; that page can POST tools/list and then tools/call to mcp.example.com with the user's cookies attached, reading the full tool surface and invoking it. The POST probe with a throwaway Origin returns 200 rather than the required 403, confirming no Origin policy exists.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
