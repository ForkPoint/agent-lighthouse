import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Version Downgrade Recoverability".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade A → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/mcp-server-quality/version-downgrade-recoverability.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Probe A (unsupported version): repeat the server/discover POST with `MCP-Protocol-Version:
// 1900-01-01` AND `_meta.io.modelcontextprotocol/protocolVersion: "1900-01-01"` (they must agree so
// the failure is unambiguous). Assert HTTP 400, `error.code === -32022`,
// `Array.isArray(error.data.supported)`, `error.data.supported.length >= 1`, every entry matching
// /^\d{4}-\d{2}-\d{2}$/, and `error.data.requested === "1900-01-01"`. Cross-check `data.supported`
// against the `supportedVersions` returned by server/discover — a mismatch between the two is its
// own finding. Probe B (header/body mismatch): POST with header `MCP-Protocol-Version: 2026-07-28`
// but `_meta` protocolVersion `2025-11-25`. Assert HTTP 400 with `error.code === -32020`. A 200
// result here means the server never validates header against body. Probe C (missing header): POST
// with no MCP-Protocol-Version header. Per spec the server either treats it as 2025-03-26
// (dual-era, acceptable — record it) or rejects it per server validation; a 200 modern result with
// no header is a validation gap. Scoring: Probe A failure = critical; Probe B failure = high; Probe
// C = informational.
export class VersionDowngradeRecoverabilityAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/mcp-server-quality/version-downgrade-recoverability',
    category: 'mcp-server-quality',
    title: "Version Downgrade Recoverability",
    failureTitle: "Version Downgrade Recoverability",
    description: "Negative-path probe that verifies the server fails correctly when handed a protocol version it does not support, and when the MCP-Protocol-Version header disagrees with the body's _meta. Both are MUST-level behaviors whose absence strands otherwise-compatible clients.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "With the handshake removed, the ONLY mechanism by which a client discovers a mutually supported version mid-flight is the `UnsupportedProtocolVersionError`: the spec requires code -32022 with `data.supported[]` listing the server's versions, and instructs clients to select from that list and retry. A server that instead returns a 500, a generic -32600/-32602, or a 400 with no `supported` array gives the client nothing to downgrade to — so a client whose preferred version is one revision ahead of the server's fails permanently even though a mutually supported version exists on both sides. Separately, the spec requires the header and the `_meta` value to agree, with a 400 + -32020 HeaderMismatch on divergence; a server that silently ignores the mismatch is trusting whichever source of truth its proxy layer did not, which is the exact split-brain the header-validation rules exist to prevent.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/mcp-server-quality/version-downgrade-recoverability.md',
      tags: ['proposed', 'mcp-server-quality'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/mcp-server-quality/version-downgrade-recoverability.md',
      'TODO stub',
    );
  }
}
