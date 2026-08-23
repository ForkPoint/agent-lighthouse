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
---


# OAuth Discovery Chain Integrity (RFC 9728 → RFC 8414)

> Shipped in v2. Evidence grade **A** · scored tier · unique · implementation: `multi-page`

## What it checks

Walks the full credential-free authorization discovery path an MCP client must traverse — 401 challenge, WWW-Authenticate resource_metadata, Protected Resource Metadata document, authorization server metadata — and asserts every MUST-level validation gate the client will apply. Ends before any token is requested, so it needs no credentials.

## Claimed mechanism (falsifiable)

The spec makes RFC 9728 mandatory for MCP servers and makes clients apply two hard identity checks: RFC 9728 §3.3 requires the PRM's `resource` value to be string-identical to the resource identifier used to construct the request URL, and the MCP AS-discovery rules require the fetched AS metadata's `issuer` to be string-identical to the issuer used to construct the well-known URL — on either mismatch the client MUST NOT use the metadata. MCP additionally strengthens RFC 9728 by requiring `authorization_servers` to carry at least one entry (it is merely OPTIONAL in the RFC). Each of these is a silent, total blocker: the discovery chain either resolves end to end or the agent never reaches an authorization prompt, so a single character of drift between the deployed endpoint URL and the `resource` claim makes the server unusable to every conforming client while the server's own logs show nothing but 401s.

## Evidence

- **[MCP Specification 2026-07-28 — Authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - 'MCP servers MUST implement OAuth 2.0 Protected Resource Metadata (RFC9728).' Authorization servers MUST provide RFC8414 or OIDC Discovery. Servers SHOULD include a scope parameter in the WWW-Authenticate challenge. Example verbatim: `WWW-Authenticate: Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource", scope="files:read"`. Insufficient scope -> 403 with error="insufficient_scope". Servers SHOULD NOT include offline_access in WWW-Authenticate scope or in PRM scopes_supported. Canonical server URI rules: no fragment, scheme required, prefer no trailing slash. Servers MUST validate token audience; MUST NOT accept or transit other tokens.
- **[MCP Specification 2026-07-28 — Authorization Server Discovery](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/authorization-server-discovery)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - PRM document returned by the MCP server MUST include authorization_servers with at least one entry (stronger than RFC 9728, where it is OPTIONAL). Two discovery mechanisms, both of which clients MUST support: WWW-Authenticate resource_metadata, then well-known probing in order — path-inserted (https://example.com/public/mcp -> https://example.com/.well-known/oauth-protected-resource/public/mcp) then root. AS metadata probing order for issuers with a path: /.well-known/oauth-authorization-server/{path}, /.well-known/openid-configuration/{path}, {path}/.well-known/openid-configuration; without a path: /.well-known/oauth-authorization-server then /.well-known/openid-configuration. Clients MUST reject a metadata doc whose issuer differs from the issuer used to build the URL.
- **[MCP Security Best Practices (2026-07-28)](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices.md)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - Token passthrough: 'MCP servers MUST NOT accept any tokens that were not explicitly issued for the MCP server.' Scope minimization: 'Common Mistakes' list names publishing all possible scopes in scopes_supported and using wildcard/omnibus scopes (*, all, full-access). State handle hijacking replaces session hijacking now that MCP is stateless: servers MUST NOT treat possession of a state handle as authentication; SHOULD use non-deterministic handles bound server-side to the authenticated user. SSRF section: clients SHOULD require HTTPS for all OAuth-related URLs and block private/link-local ranges (169.254.0.0/16 etc.).
- **[RFC 9728 — OAuth 2.0 Protected Resource Metadata](https://www.rfc-editor.org/rfc/rfc9728.html)** — IETF (spec, URL verified 2026-08-20)
  - `resource` is the only REQUIRED metadata parameter; scopes_supported and resource_name are RECOMMENDED; authorization_servers is OPTIONAL at the RFC level. Section 3 well-known construction: insert /.well-known/oauth-protected-resource between host and path, removing any terminating slash after the host (https://resource.example.com/resource1 -> https://resource.example.com/.well-known/oauth-protected-resource/resource1). Section 3.3 validation: the retrieved `resource` value MUST be identical to the resource identifier used to build the request URL; on mismatch the response data MUST NOT be used. Section 7.7 recommends blocking private/reserved IP ranges.

## Competitor coverage

Entirely absent from SEO/AEO tooling — Profound, Otterly, Semrush and Ahrefs do not model OAuth resource servers. Lighthouse's agentic category has no network-auth dimension. Generic OAuth scanners exist but do not know MCP's canonical-URI rules or MCP's strengthening of authorization_servers from OPTIONAL to MUST, and do not start from an MCP endpoint.

## Implementation sketch

1. POST the endpoint with no Authorization header. If 401, parse WWW-Authenticate: assert scheme `Bearer`, assert a `resource_metadata="…"` parameter is present (else record that the client must fall back to probing), and record any `scope="…"` parameter (SHOULD-level).
2. Build the fallback PRM URLs per RFC 9728 §3 in the spec's order: for endpoint https://h/p1/p2 -> https://h/.well-known/oauth-protected-resource/p1/p2, then https://h/.well-known/oauth-protected-resource. Strip any terminating slash after the host before insertion.
3. Fetch the PRM. Assert: 200, JSON, `resource` present. Compute the canonical server URI (lowercase scheme+host, no fragment, no trailing slash) and assert `resource` is string-identical to it — this is the single highest-value assertion in the check. Assert `authorization_servers` is a non-empty array (MCP MUST) and every entry is an https:// absolute URL. Assert none of the AS URLs resolve to private/loopback/link-local ranges (10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, fc00::/7, fe80::/10).
4. Quality assertions on the PRM: `scopes_supported` present (RECOMMENDED); does NOT contain `offline_access` (spec SHOULD NOT); does NOT contain omnibus values `*`, `all`, `full-access` (named as a common mistake); `resource_name` present.
5. For each AS issuer, probe the mandated order — with a path: /.well-known/oauth-authorization-server/{path}, /.well-known/openid-configuration/{path}, {path}/.well-known/openid-configuration; without: /.well-known/oauth-authorization-server, /.well-known/openid-configuration. On the first 200, assert `issuer` is string-identical to the issuer used to build the URL, and record presence of authorization_endpoint, token_endpoint, code_challenge_methods_supported containing "S256", and authorization_response_iss_parameter_supported (RFC 9207).
6. If the endpoint returns 200 rather than 401 for an unauthenticated server/discover, record that pre-consent capability presentation works (a positive signal) and skip to step 3's well-known probing anyway, since PRM may still exist for privileged tools.

## Example failure

A company deploys its MCP endpoint at `https://api.example.com/mcp` behind a load balancer, and serves PRM only at the root `https://api.example.com/.well-known/oauth-protected-resource` with `"resource": "https://api.example.com"`. A client canonicalizes the server it is talking to as `https://api.example.com/mcp`, fetches the root PRM as its second fallback, and finds `resource` !== the canonical URI — RFC 9728 §3.3 obliges it to discard the document. No authorization server is ever learned, the OAuth flow never starts, and every agent sees an unresolvable 401 loop. The fix is one line: also serve the document at /.well-known/oauth-protected-resource/mcp with `"resource": "https://api.example.com/mcp"`.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Implementation deviations

Recorded at graduation (2026-08-22, Plan 5 Task 27).

- **Private, loopback and link-local authorization servers are named as a finding, not skipped.** `isSafeUrl` refuses to fetch them, which on its own would produce a silent "no metadata" result. The audit therefore tests the `authorization_servers` host against the literal ranges (10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, ::1, fc00::/7, fe80::/10, `localhost`) itself and reports the address as the cause. A hostname that merely *resolves* into one of those ranges is still stopped by the gate and reported as unreachable metadata, since the audit cannot see the resolution result.
- **At most 2 authorization servers are probed.** A PRM may list more; each one costs up to three well-known requests. The count of declared servers is always reported, so a list longer than the probe budget is visible in `found`.
- **The endpoint probe is shared.** The `server/discover` response comes from the same per-scan cache `agent-interfaces/mcp-modern-era-reachability` uses, so the 401 challenge is read once per scan rather than once per audit.
- **An unreachable endpoint is `notApplicable` here, not a failure.** Reachability is what `agent-interfaces/mcp-modern-era-reachability` scores; failing both would charge a site twice for one defect.
- **An open endpoint that publishes no PRM is `notApplicable`.** A fully public MCP server with no protected surface has no authorization chain to walk, and absence is not a defect. A server that *challenges* and then publishes no PRM is a `fail`, because the client is told to authenticate and given nowhere to go.
- **The audit is ternary.** MUST-level breaks (resource drift, missing or empty `authorization_servers`, private AS, issuer mismatch, missing AS metadata, missing endpoints, a non-Bearer scheme) fail. RECOMMENDED and SHOULD-level items (`resource_name`, `scopes_supported`, `offline_access`, omnibus scopes, `S256`, RFC 9207 `iss`) warn.

## Deferred

- Requesting a token, exercising dynamic client registration, or validating the authorization endpoint's behaviour. The chain is walked credential-free and stops before the first authorization request, exactly as the sketch specified.
- Following `authorization_servers` beyond the first two entries.
