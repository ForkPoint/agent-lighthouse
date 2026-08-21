import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "AIPREF Content-Usage declaration validity".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/bot-auth-access/aipref-content-usage-declaration-validity.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Static-fetch only. 1) GET /robots.txt; tokenise line-wise, collecting `Content-Usage:`
// (case-insensitive) both at file scope and within each `User-agent` group, and separately
// collecting legacy `Content-Signal:`. 2) Each Content-Usage value may be preceded by a path prefix
// (`Content-Usage: /ai-ok/ train-ai=y`); split the optional leading path token, then parse the
// remainder as an RFC 8941 dictionary (a ~60-line parser, or the `structured-headers` npm package).
// 3) Validate keys against {train-ai, search} plus any newer registered categories, and values
// against tokens y|n. Reject bare strings `yes`/`no` with a distinct 'legacy Content-Signal syntax
// in an AIPREF directive' message. 4) GET the homepage and 2 sampled content pages; read the
// `Content-Usage` response header and parse identically. 5) Apply attach-05 precedence: for each
// declared (path-prefix, category) pair, resolve which User-agent group applies and check the
// longest-matching Allow/Disallow; if the path is disallowed for that group, flag the preference as
// inert. 6) Cross-check the robots.txt directive against the HTTP header for the same path and flag
// disagreement. Verdict: pass when at least one valid, non-inert declaration exists and
// header/robots agree; warn when only legacy `Content-Signal` is present (migration gap); fail on
// structured-field syntax errors, unknown category tokens, or preferences attached only to
// disallowed paths.
export class AiprefContentUsageDeclarationValidityAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/bot-auth-access/aipref-content-usage-declaration-validity',
    category: 'bot-auth-access',
    title: "AIPREF Content-Usage declaration validity",
    failureTitle: "AIPREF Content-Usage declaration validity",
    description: "Checks whether the site expresses AI usage preferences in the IETF AIPREF form that standards-conformant crawlers will actually parse — `Content-Usage` in robots.txt and/or as an HTTP response header — and validates syntax, vocabulary, and whether the declared preferences are attached to paths where they legally have effect.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "draft-ietf-aipref-attach-05 defines the only two attachment points a conformant crawler reads: the `Content-Usage` HTTP response header and the `Content-Usage:` robots.txt directive with optional path prefix (s11). draft-ietf-aipref-vocab-07 fixes the value grammar: an RFC 8941 structured-field dictionary over categories `train-ai` and `search` with token values `y`/`n`; anything absent is *unknown*, which crawlers resolve using their own default rather than yours (s10). Falsifiable consequences: (a) a site publishing only Cloudflare's legacy `Content-Signal: search=yes, ai-train=no` emits zero AIPREF preference — an AIPREF parser sees `unknown` for every category; (b) `yes`/`no` are not valid AIPREF tokens, so `Content-Usage: train-ai=no` fails structured-field parsing; (c) attach-05 states 'Disallowed paths have no associated usage preferences', so a `Content-Usage` scoped to a path the same agent group Disallows is inert by specification.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/bot-auth-access/aipref-content-usage-declaration-validity.md',
      tags: ['proposed', 'bot-auth-access'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/bot-auth-access/aipref-content-usage-declaration-validity.md',
      'TODO stub',
    );
  }
}
