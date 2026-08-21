import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Section Split-Risk Profile".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/answer-selection-forensics/section-split-risk-profile.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Static fetch. 1) Same h2/h3 segmentation as the referent-integrity check. 2) Token-count each
// section with a real BPE tokenizer (gpt-tokenizer npm) rather than chars/4. 3) Emit findings: (a)
// SPLIT — section tokens > 512; severity = ceil(tokens/512)-1 = number of headless tail chunks
// produced; (b) BLOB — body > 512 tokens with fewer than 2 h2 elements, meaning the entire page is
// cut at arbitrary offsets; (c) THIN — section < 25 tokens, too sparse to produce a discriminative
// embedding (common in nav-like h3 stubs); (d) ATOMIC-SPLIT — a single <table> or <ol> whose
// markdown serialization exceeds 512 tokens, so the header row / list preamble is lost from the
// tail. 4) Also report headingDistance: max characters between a heading and the end of its
// section, as the single actionable number. 5) Score = share of body tokens living in sections at
// or under the window.
export class SectionSplitRiskProfileAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/answer-selection-forensics/section-split-risk-profile',
    category: 'answer-selection-forensics',
    title: "Section Split-Risk Profile",
    failureTitle: "Section Split-Risk Profile",
    description: "Measures every h2/h3 section against the published default chunk window (512 tokens / ~2000 characters) to find sections that will be mechanically cut into two or more chunks, producing tail chunks that carry no heading — and the inverse, sections too thin to embed meaningfully. Also flags atomic structures (tables, long ordered lists) longer than the window, which get split mid-structure.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "Fixed-window splitters cut at a character/token budget, not at meaning. When a section exceeds the window, chunk 1 keeps the heading (the strongest query-matching signal on the page) and every subsequent chunk from that section is headless — its embedding loses the topical anchor. Azure publishes 512 tokens / 2000 chars with 25% overlap as the recommended default and explicitly recommends heading-based segmentation as the alternative that avoids this (S5). Falsifiable prediction: for a page with one 2,000-token section versus the same content split into four 500-token h2 sections, the queries that match content in the final quarter of the text retrieve the split version and miss the monolithic one.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/answer-selection-forensics/section-split-risk-profile.md',
      tags: ['proposed', 'answer-selection-forensics'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/answer-selection-forensics/section-split-risk-profile.md',
      'TODO stub',
    );
  }
}
