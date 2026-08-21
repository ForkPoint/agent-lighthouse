import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Modern-Era Reachability Probe (server/discover)".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade A → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/mcp-server-quality/modern-era-reachability-probe-server-discover.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Resolve the candidate MCP endpoint (from a registry match, an llms.txt reference, a documented
// /mcp path, or user config). Issue: POST <endpoint> Content-Type: application/json Accept:
// application/json, text/event-stream MCP-Protocol-Version: 2026-07-28 Mcp-Method: server/discover
// {"jsonrpc":"2.0","id":"al-1","method":"server/discover","params":{"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientInfo":{"name":"AgentLighthouse","version":"1.0.0"},"io.modelcontextprotocol/clientCapabilities":{}}}}
// Handle both Content-Type: application/json and text/event-stream (parse the final SSE data:
// frame). Classify: - 200 + result.supportedVersions includes "2026-07-28" -> PASS (modern). Record
// capabilities keys, capabilities.extensions ids, presence of `instructions`, and serverInfo. - 400
// + error.code === -32022 -> modern era but older revision; read error.data.supported[] and report
// the newest supported. - 401 + WWW-Authenticate -> auth-gated; hand off to the OAuth Discovery
// Chain check and re-probe after noting the challenge. - 404 + error.code === -32601 -> MUST
// violation: modern server that does not implement server/discover. - 400/404/405 with an empty or
// non-JSON-RPC body, or a body demanding `initialize` -> LEGACY-ONLY. Confirm by POSTing a legacy
// `initialize` and checking for an Mcp-Session-Id response header. - GET <endpoint> returning
// text/event-stream whose first event is `endpoint` -> deprecated 2024-11-05 HTTP+SSE only (FAIL,
// deprecated since 2025-03-26 and eligible for removal). Also flag legacy residue on a modern
// server: a GET or DELETE that does not return 405, or a minted/echoed Mcp-Session-Id.
export class ModernEraReachabilityProbeServerDiscoverAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/mcp-server-quality/modern-era-reachability-probe-server-discover',
    category: 'mcp-server-quality',
    title: "Modern-Era Reachability Probe (server/discover)",
    failureTitle: "Modern-Era Reachability Probe (server/discover)",
    description: "Determine, with one unauthenticated stateless POST, whether the site's MCP endpoint can be used at all by a client built on the current protocol revision (2026-07-28). Classifies the endpoint into modern / dual-era / legacy-only / deprecated-HTTP+SSE / unreachable, and extracts supportedVersions, capabilities, instructions and serverInfo from the DiscoverResult.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "Revision 2026-07-28 abolished the `initialize` handshake and protocol-level sessions: version, client identity and capabilities now travel as per-request `_meta`, and `server/discover` is a MUST-implement RPC. The spec's own compatibility matrix states verbatim that a Modern client against a Legacy server FAILS, with no fall-forward path. Therefore: if a single POST of `server/discover` carrying `_meta` + `MCP-Protocol-Version: 2026-07-28` does not yield either a DiscoverResult or a recognized modern JSON-RPC error, then every client that has moved to the current revision cannot invoke a single tool on this server — the failure is total, not degraded. Conversely a 404/-32601 on `server/discover` from a server that otherwise answers modern requests is a direct MUST violation that breaks pre-consent capability presentation.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/mcp-server-quality/modern-era-reachability-probe-server-discover.md',
      tags: ['proposed', 'mcp-server-quality'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/mcp-server-quality/modern-era-reachability-probe-server-discover.md',
      'TODO stub',
    );
  }
}
