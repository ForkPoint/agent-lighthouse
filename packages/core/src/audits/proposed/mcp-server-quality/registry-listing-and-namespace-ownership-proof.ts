import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Registry Listing and Namespace Ownership Proof".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: multi-page.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/mcp-server-quality/registry-listing-and-namespace-ownership-proof.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// 1. Query the live public API: GET
// https://registry.modelcontextprotocol.io/v0.1/servers?search=<apex-domain> and again with
// ?search=<brand-token>, paginating on metadata.nextCursor. Response shape is
// {servers:[{server:{...},_meta:{...}}],metadata:{nextCursor,count}}. 2. Select candidate entries
// where any `server.remotes[].url` has a host equal to, or a subdomain of, the audited apex domain
// — this is the reliable join key, since names are attacker-chooseable. 3. Classify each match by
// the namespace prefix of `server.name`: (a) reverse-DNS of the audited domain (com.example/...) =
// FIRST-PARTY, domain-proof required; (b) io.github.<user>/... = GitHub-account-bound, not
// brand-bound; (c) anything else = THIRD-PARTY AGGREGATOR republish. Report (c) explicitly,
// including whether the aggregator's remotes[].url proxies through its own host. 4.
// Freshness/liveness: assert `_meta["io.modelcontextprotocol.registry/official"].status ===
// "active"` and `.isLatest === true`; compare `server.version` and `.updatedAt` against the version
// reported by server/discover's serverInfo, and flag drift. 5. Verify the ownership proof
// independently of the registry: GET https://<apex>/.well-known/mcp-registry-auth expecting a body
// line matching /^v=MCPv1;\s*k=(ed25519|ecdsap384);\s*p=[A-Za-z0-9+\/]+={0,2}\s*$/, and resolve TXT
// at the apex looking for the same grammar. Presence of neither, on a domain claiming a com.*
// namespace, means the proof has been rotated away or was never re-provisioned after a DNS
// migration. 6. Transport hygiene on the listing: assert at least one remotes[] entry has `type:
// "streamable-http"`; flag a listing that offers only the deprecated `type: "sse"`. Then feed each
// remotes[].url through the Modern-Era Reachability probe — the registry requires that a remote
// server 'MUST be publicly accessible at its specified URL', so an unreachable registered URL is a
// listing defect.
export class RegistryListingAndNamespaceOwnershipProofAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/mcp-server-quality/registry-listing-and-namespace-ownership-proof',
    category: 'mcp-server-quality',
    title: "Registry Listing and Namespace Ownership Proof",
    failureTitle: "Registry Listing and Namespace Ownership Proof",
    description: "Checks whether the site's MCP server is discoverable in the official MCP Registry, whether it is listed under a namespace cryptographically bound to the audited domain, and whether the ownership proof that namespace requires is actually being served — distinguishing a first-party listing from a third-party aggregator's republish of the same server.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "The registry grants a `com.example.*` namespace only on proof of domain control, and the proof is externally observable: either an apex DNS TXT record of exact form `v=MCPv1; k=ed25519; p=<base64>` or a file at exactly `/.well-known/mcp-registry-auth` with the same payload. A listing under `io.github.<user>/*` is bound to an individual's GitHub account, and a listing under an aggregator namespace (observed live in the registry as e.g. `ai.smithery/<Org>-<repo>` with `remotes[].url` pointing at server.smithery.ai) is bound to neither the brand nor its infrastructure — the brand cannot update or revoke it, and agents routed through it reach a proxy rather than the origin. The falsifiable claim: a domain with no first-party registry entry is absent from the canonical index clients use to resolve 'the MCP server for example.com', so the only path to the server is a URL the user pastes by hand.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/mcp-server-quality/registry-listing-and-namespace-ownership-proof.md',
      tags: ['proposed', 'mcp-server-quality'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/mcp-server-quality/registry-listing-and-namespace-ownership-proof.md',
      'TODO stub',
    );
  }
}
