import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "ACP Endpoint Conformance Probe".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade A → informative tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/agentic-commerce/acp-endpoint-conformance-probe.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Requires an operator-supplied base URL, because ACP defines NO discovery mechanism — the
// architecture docs confirm seller onboarding is out-of-band with no registry and no .well-known
// path, so nothing can be auto-discovered and it is dishonest to pretend otherwise. Given a base
// URL, run read-only and unauthenticated probes: (1) TLS validity and HTTPS-only, reject plaintext
// or invalid chain. (2) POST /checkout_sessions with no Authorization header and a minimal body —
// expect 401/403, Content-Type application/json, and a body parsing to {type, code, message} with
// optional param as an RFC 9535 JSONPath string; FAIL on an HTML body, which is the most common
// real defect. (3) GET /checkout_sessions/acp_probe_nonexistent — expect 404 plus the same
// envelope. (4) POST /checkout_sessions/acp_probe_nonexistent/cancel — expect 404 or 405, never
// 500. (5) Header echo: send Idempotency-Key and Request-Id and assert both are echoed in the
// response headers even on the error path. (6) API-Version: send a well-formed YYYY-MM-DD value and
// assert it is not rejected; send a malformed one and assert a 400 with the envelope rather than a
// 500. (7) Assert no CORS wildcard on a credentialed endpoint. OPTIONAL authenticated tier when the
// merchant supplies a sandbox token: assert the CheckoutSession carries all 9 required fields (id,
// status, currency, line_items, totals, fulfillment_options, messages, links, capabilities), that
// status is within the 11-value enum, totals[].type within the 12-value enum, links[].type within
// the 8-value enum, currency lowercase, and that capabilities.payment.handlers is populated as the
// seller-declaration requirement demands. Marked scoreable=false because penalising the ~99 percent
// of merchants with no ACP integration would be meaningless; report it as an informational module
// that activates on configuration.
export class AcpEndpointConformanceProbeAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/agentic-commerce/acp-endpoint-conformance-probe',
    category: 'agentic-commerce',
    title: "ACP Endpoint Conformance Probe",
    failureTitle: "ACP Endpoint Conformance Probe",
    description: "For merchants who have already stood up ACP endpoints, a non-destructive unauthenticated conformance suite against the five checkout paths — error-envelope shape, required header echoes, API-Version handling and status-code contracts.",
    scoreDisplayMode: 'binary',
    weight: 0,
    defaultPriority: 'medium',
    guidance: {
      impact: "Falsifiable claim: the spec fixes exact contracts that can be tested WITHOUT authenticating. Endpoints must be HTTPS and JSON. Errors must return the envelope {type, code, message, param?} rather than an HTML error page. Responses MUST echo Idempotency-Key and Request-Id. GET /checkout_sessions/{unknown} must return 404; /cancel must return 405 when not cancelable; POST /checkout_sessions returns 201 on success. API-Version is a required YYYY-MM-DD header. A merchant failing these fails silently in production because the agent sees a malformed error and cannot distinguish 'out of stock' from 'your integration is broken'. Disproof condition: agents tolerating HTML error bodies where the envelope is specified.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/agentic-commerce/acp-endpoint-conformance-probe.md',
      tags: ['proposed', 'agentic-commerce'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/agentic-commerce/acp-endpoint-conformance-probe.md',
      'TODO stub',
    );
  }
}
