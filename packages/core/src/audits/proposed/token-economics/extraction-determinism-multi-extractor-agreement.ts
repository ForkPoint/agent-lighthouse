import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Extraction determinism (multi-extractor agreement)".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/token-economics/extraction-determinism-multi-extractor-agreement.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Parse once into a DOM (linkedom). Extractor 1: @mozilla/readability. Extractor 2: semantic
// selector — first non-empty of main, [role=main], article, then largest text-density block — with
// nav/aside/footer/header removed. Extractor 3: an independent density heuristic (defuddle, or a
// text-to-link-density scorer in the boilerpipe/trafilatura style). Normalize each output
// (lowercase, collapse whitespace, strip punctuation), shingle at n=5, compute pairwise Jaccard.
// Fold in readability's own signals: null return, textContent length < charThreshold (500), and
// isProbablyReaderable false are automatic fails since they mean the most widely deployed extractor
// gives an agent nothing. Emit the symmetric difference of the largest disagreeing pair as
// evidence.
export class ExtractionDeterminismMultiExtractorAgreementAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/token-economics/extraction-determinism-multi-extractor-agreement',
    category: 'token-economics',
    title: "Extraction determinism (multi-extractor agreement)",
    failureTitle: "Extraction determinism (multi-extractor agreement)",
    description: "Run three structurally different main-content extractors against the same HTML and score how much they agree. Report minimum pairwise Jaccard similarity over 5-gram shingles of the extracted text, plus title agreement and a hard flag when readability returns null or under its 500-char threshold. Pass ≥ 0.75 minimum pairwise agreement; warn 0.5-0.75; fail < 0.5 or any extractor returning nothing. Output the diff of what one extractor kept and another dropped — that diff is the deliverable.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "There is no single 'the content of this page'; there is whatever the fetching agent's extractor decided. Benchmarked over 990 documents, open-source extractors span recall 0.714 to 0.991 and precision 0.534 to 0.936, and the major commercial readers each apply their own undisclosed pipeline. A page whose DOM makes the main region unambiguous (a real <main>/<article>, one dominant text block, low link density) yields near-identical text from all of them. A page built from sibling divs, sectioned card grids, or a content region interleaved with promo blocks yields materially different text per extractor — which means ChatGPT, Claude and Perplexity are each answering from a different version of your page, and low-precision extractors additionally carry nav and promo text into the model's context. Falsifiable and stable: same HTML in, same agreement number out.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/token-economics/extraction-determinism-multi-extractor-agreement.md',
      tags: ['proposed', 'token-economics'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/token-economics/extraction-determinism-multi-extractor-agreement.md',
      'TODO stub',
    );
  }
}
