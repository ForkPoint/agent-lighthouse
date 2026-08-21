import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "AI usage signal coherence across channels".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/bot-auth-access/ai-usage-signal-coherence-across-channels.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Static-fetch, reusing artefacts already fetched by the other checks. 1) Gather: /robots.txt
// (per-agent Allow/Disallow, Content-Usage, Content-Signal, License); homepage + sampled pages'
// response headers (Content-Usage, tdm-reservation, tdm-policy, X-Robots-Tag incl. the
// noai/noimageai convention); HTML meta tdm-reservation / tdm-policy and `<meta name="robots"
// content="noai">`; /.well-known/tdmrep.json (validate it is an ARRAY of {location,
// tdm-reservation, tdm-policy} — a bare object is non-conformant per s17); the discovered RSL
// document's permits/prohibits. 2) Map each into the AIPREF category space: TDMRep
// `tdm-reservation: 1` → train-ai=n site-wide (or for `location`); RSL `<prohibits
// type="usage">ai-input</prohibits>` → ai-input=n; Content-Signal `ai-train=no` → train-ai=n; a
// blanket `Disallow: /` for GPTBot → train-ai=n for that agent; noai → train-ai=n. 3) For each
// (category, overlapping path scope) emit a contradiction finding when two channels disagree,
// naming both channels and the exact conflicting lines. 4) Emit a separate 'edge override' finding
// when robots.txt contains a Content-Signal/Content-Usage block above the operator's own directives
// that disagrees with a signal they publish elsewhere — the managed-robots.txt trap. 5) Emit a
// distinct 'no signal in any channel' warning, which is a different remediation from a
// contradiction. 6) Verdict: fail on contradiction, warn on total silence, pass on coherent (or
// coherently silent-plus-one-declaration).
export class AiUsageSignalCoherenceAcrossChannelsAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/bot-auth-access/ai-usage-signal-coherence-across-channels',
    category: 'bot-auth-access',
    title: "AI usage signal coherence across channels",
    failureTitle: "AI usage signal coherence across channels",
    description: "Normalises every AI-usage signal the site emits — robots.txt Allow/Disallow, AIPREF Content-Usage, legacy Content-Signal, TDMRep in its three transports, RSL permits/prohibits, and noai robots directives — into one comparable model and reports where they contradict each other. Different crawlers read different channels, so contradictory signals mean different AI systems reach opposite conclusions about the same content.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "There is no defined precedence *between* these standards; each specifies only its own parsing. TDMRep is carried in a well-known JSON array, an HTTP header, and a meta tag (s17); AIPREF in robots.txt and an HTTP header (s11); RSL in robots.txt, Link header, HTML link, and inline script (s12); Content-Signal in robots.txt (s8). Falsifiable: normalise each channel to (path-scope, usage-category, allow|deny) triples and compare; two channels asserting opposite values for the same category and overlapping path scope is a mechanically detectable contradiction, and it provably yields divergent outcomes because a TDMRep-aware crawler and an AIPREF-aware crawler read disjoint inputs. The highest-value instance is documented directly: Cloudflare's managed robots.txt PREPENDS `Content-signal: search=yes, ai-train=no, use=reference` above the operator's own file, so the operator's stated policy can be contradicted at the edge without their knowledge (s7).",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/bot-auth-access/ai-usage-signal-coherence-across-channels.md',
      tags: ['proposed', 'bot-auth-access'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/bot-auth-access/ai-usage-signal-coherence-across-channels.md',
      'TODO stub',
    );
  }
}
