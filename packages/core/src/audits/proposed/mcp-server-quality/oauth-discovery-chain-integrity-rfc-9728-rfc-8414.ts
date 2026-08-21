import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "OAuth Discovery Chain Integrity (RFC 9728 → RFC 8414)".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade A → scored tier. Implementation difficulty: multi-page.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/mcp-server-quality/oauth-discovery-chain-integrity-rfc-9728-rfc-8414.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// 1. POST the endpoint with no Authorization header. If 401, parse WWW-Authenticate: assert scheme
// `Bearer`, assert a `resource_metadata="…"` parameter is present (else record that the client must
// fall back to probing), and record any `scope="…"` parameter (SHOULD-level). 2. Build the fallback
// PRM URLs per RFC 9728 §3 in the spec's order: for endpoint https://h/p1/p2 ->
// https://h/.well-known/oauth-protected-resource/p1/p2, then
// https://h/.well-known/oauth-protected-resource. Strip any terminating slash after the host before
// insertion. 3. Fetch the PRM. Assert: 200, JSON, `resource` present. Compute the canonical server
// URI (lowercase scheme+host, no fragment, no trailing slash) and assert `resource` is
// string-identical to it — this is the single highest-value assertion in the check. Assert
// `authorization_servers` is a non-empty array (MCP MUST) and every entry is an https:// absolute
// URL. Assert none of the AS URLs resolve to private/loopback/link-local ranges (10/8, 172.16/12,
// 192.168/16, 127/8, 169.254/16, fc00::/7, fe80::/10). 4. Quality assertions on the PRM:
// `scopes_supported` present (RECOMMENDED); does NOT contain `offline_access` (spec SHOULD NOT);
// does NOT contain omnibus values `*`, `all`, `full-access` (named as a common mistake);
// `resource_name` present. 5. For each AS issuer, probe the mandated order — with a path:
// /.well-known/oauth-authorization-server/{path}, /.well-known/openid-configuration/{path},
// {path}/.well-known/openid-configuration; without: /.well-known/oauth-authorization-server,
// /.well-known/openid-configuration. On the first 200, assert `issuer` is string-identical to the
// issuer used to build the URL, and record presence of authorization_endpoint, token_endpoint,
// code_challenge_methods_supported containing "S256", and
// authorization_response_iss_parameter_supported (RFC 9207). 6. If the endpoint returns 200 rather
// than 401 for an unauthenticated server/discover, record that pre-consent capability presentation
// works (a positive signal) and skip to step 3's well-known probing anyway, since PRM may still
// exist for privileged tools.
export class OauthDiscoveryChainIntegrityRfc9728Rfc8414Audit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/mcp-server-quality/oauth-discovery-chain-integrity-rfc-9728-rfc-8414',
    category: 'mcp-server-quality',
    title: "OAuth Discovery Chain Integrity (RFC 9728 → RFC 8414)",
    failureTitle: "OAuth Discovery Chain Integrity (RFC 9728 → RFC 8414)",
    description: "Walks the full credential-free authorization discovery path an MCP client must traverse — 401 challenge, WWW-Authenticate resource_metadata, Protected Resource Metadata document, authorization server metadata — and asserts every MUST-level validation gate the client will apply. Ends before any token is requested, so it needs no credentials.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "The spec makes RFC 9728 mandatory for MCP servers and makes clients apply two hard identity checks: RFC 9728 §3.3 requires the PRM's `resource` value to be string-identical to the resource identifier used to construct the request URL, and the MCP AS-discovery rules require the fetched AS metadata's `issuer` to be string-identical to the issuer used to construct the well-known URL — on either mismatch the client MUST NOT use the metadata. MCP additionally strengthens RFC 9728 by requiring `authorization_servers` to carry at least one entry (it is merely OPTIONAL in the RFC). Each of these is a silent, total blocker: the discovery chain either resolves end to end or the agent never reaches an authorization prompt, so a single character of drift between the deployed endpoint URL and the `resource` claim makes the server unusable to every conforming client while the server's own logs show nothing but 401s.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/mcp-server-quality/oauth-discovery-chain-integrity-rfc-9728-rfc-8414.md',
      tags: ['proposed', 'mcp-server-quality'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/mcp-server-quality/oauth-discovery-chain-integrity-rfc-9728-rfc-8414.md',
      'TODO stub',
    );
  }
}
