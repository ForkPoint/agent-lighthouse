---
audit: agent-interfaces/mcp-oauth-discovery-chain
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/mcp-oauth-discovery-chain.ts
slug: mcp-oauth-discovery-chain
evidence_grade: A
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-22"
reviewed: 2026-08-20
graduated: 2026-08-22
sources:
  - S6
  - S7
  - S8
  - S9
---

# OAuth Discovery Chain Integrity (RFC 9728 → RFC 8414)

> Shipped in v2. Evidence grade **A** · scored tier · unique · implementation: `multi-page`

## What it checks

Walks the full credential-free authorization discovery path an MCP client must traverse — 401 challenge, WWW-Authenticate resource_metadata, Protected Resource Metadata document, authorization server metadata — and asserts every MUST-level validation gate the client will apply. Ends before any token is requested, so it needs no credentials.

## Claimed mechanism (falsifiable)

The spec makes RFC 9728 mandatory for MCP servers, and makes clients apply two hard identity checks. RFC 9728 §3.3 requires the PRM's `resource` value to be string-identical to the resource identifier used to construct the request URL. The MCP AS-discovery rules require the fetched AS metadata's `issuer` to be string-identical to the issuer used to construct the well-known URL. On either mismatch the client MUST NOT use the metadata. MCP additionally strengthens RFC 9728 by requiring `authorization_servers` to carry at least one entry (it is merely OPTIONAL in the RFC). Each of these is a silent, total blocker. The discovery chain either resolves end to end, or the agent never reaches an authorization prompt. A single character of drift between the deployed endpoint URL and the `resource` claim makes the server unusable to every conforming client — while the server's own logs show nothing but 401s.

## Evidence

- **[MCP Specification 2026-07-28 — Authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - 'MCP servers MUST implement OAuth 2.0 Protected Resource Metadata (RFC9728).' Authorization servers MUST provide RFC8414 or OIDC Discovery. Servers SHOULD include a scope parameter in the WWW-Authenticate challenge. Example verbatim: `WWW-Authenticate: Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource", scope="files:read"`. Insufficient scope -> 403 with error="insufficient_scope". Servers SHOULD NOT include offline_access in WWW-Authenticate scope or in PRM scopes_supported. Canonical server URI rules: no fragment, scheme required, prefer no trailing slash. Servers MUST validate token audience; MUST NOT accept or transit other tokens.
- **[MCP Specification 2026-07-28 — Authorization Server Discovery](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/authorization-server-discovery)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - PRM document returned by the MCP server MUST include authorization_servers with at least one entry (stronger than RFC 9728, where it is OPTIONAL). Two discovery mechanisms, both of which clients MUST support: WWW-Authenticate resource_metadata, then well-known probing in order — path-inserted (https://example.com/public/mcp -> https://example.com/.well-known/oauth-protected-resource/public/mcp) then root. AS metadata probing order for issuers with a path: /.well-known/oauth-authorization-server/{path}, /.well-known/openid-configuration/{path}, {path}/.well-known/openid-configuration; without a path: /.well-known/oauth-authorization-server then /.well-known/openid-configuration. Clients MUST reject a metadata doc whose issuer differs from the issuer used to build the URL.
- **[MCP Security Best Practices (2026-07-28)](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices.md)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - Token passthrough: 'MCP servers MUST NOT accept any tokens that were not explicitly issued for the MCP server.' Scope minimization: 'Common Mistakes' list names publishing all possible scopes in scopes_supported and using wildcard/omnibus scopes (*, all, full-access). State handle hijacking replaces session hijacking now that MCP is stateless: servers MUST NOT treat possession of a state handle as authentication; SHOULD use non-deterministic handles bound server-side to the authenticated user. SSRF section: clients SHOULD require HTTPS for all OAuth-related URLs and block private/link-local ranges (169.254.0.0/16 etc.).
- **[RFC 9728 — OAuth 2.0 Protected Resource Metadata](https://www.rfc-editor.org/rfc/rfc9728.html)** — IETF (spec, URL verified 2026-08-20)
  - `resource` is the only REQUIRED metadata parameter; scopes_supported and resource_name are RECOMMENDED; authorization_servers is OPTIONAL at the RFC level. Section 3 well-known construction: insert /.well-known/oauth-protected-resource between host and path, removing any terminating slash after the host (https://resource.example.com/resource1 -> https://resource.example.com/.well-known/oauth-protected-resource/resource1). Section 3.3 validation: the retrieved `resource` value MUST be identical to the resource identifier used to build the request URL; on mismatch the response data MUST NOT be used. Section 7.7 recommends blocking private/reserved IP ranges.

## Example failure

A company deploys its MCP endpoint at `https://api.example.com/mcp` behind a load balancer, and serves PRM only at the root `https://api.example.com/.well-known/oauth-protected-resource` with `"resource": "https://api.example.com"`. A client canonicalizes the server it is talking to as `https://api.example.com/mcp`, fetches the root PRM as its second fallback, and finds `resource` !== the canonical URI — RFC 9728 §3.3 obliges it to discard the document. No authorization server is ever learned, the OAuth flow never starts, and every agent sees an unresolvable 401 loop. The fix is one line: also serve the document at /.well-known/oauth-protected-resource/mcp with `"resource": "https://api.example.com/mcp"`.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Implementation deviations

- A private, loopback or link-local authorization server is named as a finding. The audit tests the host against the literal ranges itself, because `isSafeUrl` would refuse the fetch silently.
- A hostname that only resolves into those ranges is stopped by the gate. It is reported as unreachable metadata.
- At most two authorization servers are probed. The declared count is always reported in `found`.
- The `server/discover` response comes from the shared per-scan probe cache.
- An unreachable endpoint is `notApplicable`. `mcp-modern-era-reachability` scores reachability.
- An open endpoint with no PRM is `notApplicable`. A server that challenges and then publishes no PRM fails.
- MUST-level breaks fail. RECOMMENDED and SHOULD-level items warn.

## Deferred

- Requesting a token, dynamic client registration, or testing the authorization endpoint. The chain stops before the first authorization request.
