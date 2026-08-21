import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Signed-agent (Web Bot Auth) request tolerance".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/bot-auth-access/signed-agent-web-bot-auth-request-tolerance.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Static-fetch, two requests plus optional key hosting. 1) Baseline: GET / with a neutral UA;
// record status, length, and headers. 2) Signed probe: identical request plus `Signature-Input:
// sig1=("@authority" "@method" "@path");created=<now>;expires=<now+300>;keyid="<JWK
// thumbprint>";alg="ed25519";nonce="<b64>";tag="web-bot-auth"`, `Signature: sig1=:<base64 sig>:`,
// and `Signature-Agent: "https://<tool-directory-host>"`. Sign with Ed25519 over the RFC 9421
// signature base — node:crypto covers this natively; the signature base construction is ~80 lines.
// Agent Lighthouse should host its own JWKS at /.well-known/http-message-signatures-directory with
// media type application/http-message-signatures-directory+json so the probe is honest and
// resolvable. 3) Compare: fail when the signed request's status is 400, 403, 421 or 431 while the
// baseline is 2xx, or when signed body length collapses relative to baseline. Report 431 as a
// distinct finding — it means a header-size limit, fixed differently from a WAF rule. 4) Positive
// credit (informational, not scored): if the origin answers 401 or 403 carrying an
// `Accept-Signature` field (RFC 9421 §5.1), it is actively negotiating signatures and is genuinely
// signed-agent ready. 5) Also check `Vary`: if the site varies behaviour on signature headers
// without listing them in Vary, a CDN can serve the rejected variant to everyone. 6) Note in
// guidance that a pass here means 'the door is not nailed shut', not 'signatures are verified' —
// verification is invisible from outside.
export class SignedAgentWebBotAuthRequestToleranceAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/bot-auth-access/signed-agent-web-bot-auth-request-tolerance',
    category: 'bot-auth-access',
    title: "Signed-agent (Web Bot Auth) request tolerance",
    failureTitle: "Signed-agent (Web Bot Auth) request tolerance",
    description: "Probes whether the site's edge and origin tolerate requests carrying RFC 9421 HTTP Message Signature headers at all. Some WAFs and origins reject unknown or oversized request headers outright, which means the entire cryptographically-verifiable-bot ecosystem — the one direction both Cloudflare and Google are building toward — cannot reach the site even when the operator wants it to.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "Web Bot Auth signs outbound requests with three headers: `Signature-Input` (with tag=\"web-bot-auth\", keyid, created, expires, nonce, alg), `Signature`, and `Signature-Agent` pointing at a JWKS directory at /.well-known/http-message-signatures-directory (s1, s3). Cloudflare's verified-bot policy lists 'a cryptographic Web Bot Auth signature' as a first-class self-identification method (s4). Falsifiable claim: if adding well-formed signature headers to an otherwise identical request changes the response adversely — 400 (the draft's own malformed-header code), 403, 421, or 431 Request Header Fields Too Large — the origin path cannot receive signed traffic, and no signed agent can ever be admitted regardless of who signed it. The test is *tolerance*, not acceptance: the site is not expected to validate the auditor's key.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/bot-auth-access/signed-agent-web-bot-auth-request-tolerance.md',
      tags: ['proposed', 'bot-auth-access'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/bot-auth-access/signed-agent-web-bot-auth-request-tolerance.md',
      'TODO stub',
    );
  }
}
