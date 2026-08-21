import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Signal Density Index (content tokens ÷ delivered tokens)".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/token-economics/signal-density-index-content-tokens-delivered-tokens.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// HTTP GET with an AI-crawler UA and Accept-Encoding identity-or-decompressed; keep the decoded
// body as the denominator string. Parse with linkedom/cheerio, run @mozilla/readability over the
// DOM for textContent as numerator, fall back to a <main>/<article>/[role=main] selector when
// readability returns null. Count both with gpt-tokenizer or js-tiktoken at o200k_base. Report a
// breakdown of the denominator by node type (script, style, comment, attribute text, visible text)
// so the report tells the user which bucket to attack — this breakdown is what makes the other
// checks in this set actionable.
export class SignalDensityIndexContentTokensDeliveredTokensAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/token-economics/signal-density-index-content-tokens-delivered-tokens',
    category: 'token-economics',
    title: "Signal Density Index (content tokens ÷ delivered tokens)",
    failureTitle: "Signal Density Index (content tokens ÷ delivered tokens)",
    description: "Primary meter for the whole category. Tokenize the raw HTTP response body exactly as a non-rendering agent receives it, tokenize the extracted main content, and report the ratio plus the absolute waste in tokens. Grades: A ≥ 0.20, B 0.10-0.20, C 0.04-0.10, F < 0.04. Also emit the absolute numbers (delivered tokens, content tokens, wasted tokens) because a 3% ratio on a 2k-token page is trivia while 3% on a 90k-token page is the whole finding.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "AI crawlers do not execute JavaScript and do not apply CSS, so the entire HTTP response body — inline scripts, style blocks, serialized state, comments, tracking snippets — is what gets tokenized into the agent's context, and per-document token cost is real enough that infrastructure vendors bill and report it per conversion. If content tokens are a small fraction of delivered tokens, then every retrieval of this page spends most of its context budget on bytes that carry no answer, and irrelevant context measurably degrades model accuracy on top of the cost. Falsifiable: fetch the page with a plain HTTP client, count tokens with o200k_base, and the ratio is a single reproducible number that does not move between runs.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/token-economics/signal-density-index-content-tokens-delivered-tokens.md',
      tags: ['proposed', 'token-economics'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/token-economics/signal-density-index-content-tokens-delivered-tokens.md',
      'TODO stub',
    );
  }
}
