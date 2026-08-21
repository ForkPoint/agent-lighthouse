import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Snippet-Gate Coverage Analysis".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade A → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/answer-selection-forensics/snippet-gate-coverage-analysis.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Static fetch, one request. 1) Parse every <meta name="robots">, <meta name="googlebot">, and
// other per-bot meta tags, plus all X-Robots-Tag response headers including per-bot forms
// (`X-Robots-Tag: googlebot: max-snippet:0`). Resolve to an effective directive set per bot using
// the documented most-restrictive-wins precedence, and report the resolution, since conflicting
// meta-versus-header directives are a common silent bug. 2) Hard fail on noindex or nosnippet for
// any AI-relevant agent. 3) Collect data-nosnippet subtrees; compute nosnippetCoverage = characters
// inside them / main-content characters. Fail if coverage > 0.20, or if any subtree contains the
// first sentence after an h2, a JSON-LD FAQPage answer, or a main-content <table> — and name the
// suppressed span in the finding. 4) If max-snippet is a positive integer, compare it to the
// character length of the primary answer span (first sentence after h1 or after the first h2); fail
// when the budget is shorter, and show the truncation point. 5) Cross-check consistency: a page
// carrying FAQPage or HowTo JSON-LD while also carrying nosnippet is a self-defeating configuration
// and should be reported as a single combined finding.
export class SnippetGateCoverageAnalysisAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/answer-selection-forensics/snippet-gate-coverage-analysis',
    category: 'answer-selection-forensics',
    title: "Snippet-Gate Coverage Analysis",
    failureTitle: "Snippet-Gate Coverage Analysis",
    description: "Computes the site's effective snippet permissions per crawler — merging <meta name=\"robots\">, per-bot meta tags, and X-Robots-Tag response headers — then measures those permissions against the page's actual answer content: is max-snippet numerically smaller than the primary answer span, and does data-nosnippet coverage overlap the answer span, the FAQ answers, or the main-content tables. Reports the specific suppressed text, not just the directive.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "Google states the eligibility gate directly: to appear as a supporting link a page 'must be indexed and eligible to be shown in Google Search with a snippet', and names nosnippet, data-nosnippet, max-snippet and noindex as the controls that limit what AI Overviews and AI Mode can show (S4). This makes the causal chain fully documented rather than inferred: a max-snippet value shorter than the answer sentence truncates the answer below usefulness, and data-nosnippet wrapping the answer removes it from AI surfaces entirely while leaving it visible to humans — an invisible failure that page-level SEO reports do not surface because the directive itself is technically 'valid'.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/answer-selection-forensics/snippet-gate-coverage-analysis.md',
      tags: ['proposed', 'answer-selection-forensics'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/answer-selection-forensics/snippet-gate-coverage-analysis.md',
      'TODO stub',
    );
  }
}
