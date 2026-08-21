import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Preamble Tax (tokens before the first content token)".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/token-economics/preamble-tax-tokens-before-the-first-content-token.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Keep the decoded response body as a string. Extract main content, take its first ~200 chars,
// normalize whitespace and entities, and locate it in the body with the same normalization applied
// to a rolling window (fall back to locating the opening tag of the extracted container node via
// its source position from a position-tracking parser such as parse5 with sourceCodeLocationInfo).
// Tokenize body.slice(0, offset) at o200k_base. Additionally flag the single largest pre-content
// node so the finding names a culprit ('62k tokens: inline <style> at line 14').
export class PreambleTaxTokensBeforeTheFirstContentTokenAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/token-economics/preamble-tax-tokens-before-the-first-content-token',
    category: 'token-economics',
    title: "Preamble Tax (tokens before the first content token)",
    failureTitle: "Preamble Tax (tokens before the first content token)",
    description: "Measure the token offset, within the raw response body, at which the main content actually begins — i.e. how many tokens an agent must stream past before the first sentence of the answer appears. Pass < 2,000 tokens; warn 2,000-10,000; fail > 10,000. Also report the offset as a fraction of total document tokens and whether the content is split across a mid-document scripts/state island.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "Non-rendering agents ingest the document as a linear byte stream, so DOM order equals context order. Model accuracy is position-sensitive: relevant information at the beginning or end of a context is retrieved far more reliably than information buried in the middle. A page that inlines a 40k-token critical-CSS block and a serialized state blob ahead of <main> therefore does two things at once — it pushes the answer into the low-recall middle of whatever context window it lands in, and it guarantees the answer is what gets cut when the fetching harness truncates to a byte or token cap. Falsifiable: locate the first 200 normalized characters of the extracted main content inside the raw body, count tokens before that byte offset, and the number is deterministic.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/token-economics/preamble-tax-tokens-before-the-first-content-token.md',
      tags: ['proposed', 'token-economics'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/token-economics/preamble-tax-tokens-before-the-first-content-token.md',
      'TODO stub',
    );
  }
}
