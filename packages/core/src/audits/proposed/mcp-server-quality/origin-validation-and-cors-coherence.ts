import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Origin Validation and CORS Coherence".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/mcp-server-quality/origin-validation-and-cors-coherence.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Generate a throwaway origin such as https://al-probe-<random>.example (never a real third-party
// domain). - Probe A: POST server/discover with `Origin: https://al-probe-<random>.example`. Record
// the status. Compare against the identical request with no Origin header. If both return 200
// identically, the server applies no Origin policy — report as a MUST-violation finding, scored
// only when the endpoint is credential-accepting (see gating below). - Probe B: OPTIONS preflight
// to the endpoint with `Origin: <throwaway>`, `Access-Control-Request-Method: POST`,
// `Access-Control-Request-Headers: content-type, mcp-protocol-version, authorization`. Record
// Access-Control-Allow-Origin, -Allow-Credentials, -Allow-Headers, -Max-Age. - Findings, in
// descending severity: (1) ACAO reflects the throwaway origin verbatim AND Allow-Credentials: true
// -> CRITICAL, unambiguous defect regardless of auth posture; (2) ACAO: * AND the endpoint returns
// 401/WWW-Authenticate or accepts an Authorization header (Allow-Headers includes authorization) ->
// HIGH; (3) no Origin differentiation on a credential-accepting endpoint -> MEDIUM; (4) permissive
// CORS on an endpoint that is anonymous and read-only by construction -> INFORMATIONAL, explicitly
// not scored. - Gating: determine credential-acceptance from the OAuth Discovery Chain check (did
// the endpoint issue a 401 with WWW-Authenticate?) and from whether Access-Control-Allow-Headers
// admits `authorization`. Never score findings 3 or 4 against an endpoint with no auth surface. -
// Also record whether SSE responses carry `X-Accel-Buffering: no` (SHOULD-level; its absence lets
// reverse proxies buffer streamed tool output and stall progress notifications) — reported as a
// separate advisory line item rather than folded into the CORS score.
export class OriginValidationAndCorsCoherenceAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/mcp-server-quality/origin-validation-and-cors-coherence',
    category: 'mcp-server-quality',
    title: "Origin Validation and CORS Coherence",
    failureTitle: "Origin Validation and CORS Coherence",
    description: "Probes whether the endpoint enforces any Origin policy at all, and whether its CORS response headers are coherent with its authentication posture — specifically catching wildcard or reflected Access-Control-Allow-Origin on an endpoint that also accepts bearer credentials.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "The transport spec is unambiguous: 'Servers MUST validate the Origin header on all incoming connections to prevent DNS rebinding attacks. If the Origin header is present and invalid, servers MUST respond with HTTP 403 Forbidden.' The concrete, non-ambiguous defect a scanner can prove is the CORS pairing: a server that reflects an arbitrary request Origin into Access-Control-Allow-Origin while also returning Access-Control-Allow-Credentials: true has authorized any web page the user visits to make credentialed requests to the MCP endpoint on that user's behalf — enumerating the tool surface and invoking tools with the user's session. Wildcard ACAO alone is weaker evidence (it is a legitimate configuration for a deliberately public, unauthenticated server), which is why this is graded B and scored only when the endpoint also presents an authentication challenge or accepts credentials.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/mcp-server-quality/origin-validation-and-cors-coherence.md',
      tags: ['proposed', 'mcp-server-quality'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/mcp-server-quality/origin-validation-and-cors-coherence.md',
      'TODO stub',
    );
  }
}
