import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Question-Heading Answer Span Alignment".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade C → informative tier. Implementation difficulty: llm-assisted.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/answer-selection-forensics/question-heading-answer-span-alignment.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Static parse plus an LLM adjudication pass. 1) Detect interrogative headings: text ends with '?'
// or begins with what/how/why/when/where/who/which/can/do/does/is/are/should/will. 2) Take the
// section body up to the next heading. 3) Deterministic gates, all reportable without an LLM: (a)
// proximity — the candidate answer sentence starts within 320 characters of the heading; (b) block
// containment — the sentence lies wholly inside one block-level element, so it is text-fragment
// addressable (reuse the addressability engine); (c) lexical anchoring — the sentence shares at
// least one non-stopword content token with the heading; (d) length envelope — 8 to 40 words; (e)
// not-a-teaser — does not match /^(in this (article|guide|post|section)|let's|first,?
// (let's|we)|read on|keep reading|before we|here's what)/i and is not a link-only paragraph. 4) LLM
// gate: send heading plus candidate span to a judge with a strict rubric returning
// answers|partial|no, plus the reason. Cache by content hash. 5) Report as advisory findings with
// the heading, the candidate span, and which gate failed; do not fold into the numeric score while
// grade is C. 6) Cheap variant for score-free CI: run gates (a)-(e) only, and report coverage as an
// informational metric.
export class QuestionHeadingAnswerSpanAlignmentAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/answer-selection-forensics/question-heading-answer-span-alignment',
    category: 'answer-selection-forensics',
    title: "Question-Heading Answer Span Alignment",
    failureTitle: "Question-Heading Answer Span Alignment",
    description: "For every interrogative heading, checks that the immediately following content is a self-contained declarative answer inside a measurable envelope — appears within the first ~320 characters of the section, is a contiguous span inside one block element, restates a content word from the heading, and is not a teaser or link-out. Roadmap item: the structural half is deterministic, but judging whether the span actually answers the question needs an LLM adjudicator.",
    scoreDisplayMode: 'binary',
    weight: 0,
    defaultPriority: 'medium',
    guidance: {
      impact: "A citable answer must be a contiguous extractable span: Google's featured snippet is exactly such a span and is deep-linked with an auto-generated text fragment (S12), which the spec constrains to a single block-level element (S2, S3). So a question heading whose answer is spread across three paragraphs, or deferred behind 'here's what you need to know first', has no single span that a citing surface can lift. Chunk segmentation reinforces this: heading-based chunkers (S5) put the heading and the answer in the same chunk only when the answer is near the heading. The honest limitation is that the semantic part — does this sentence answer this question — is not decidable by regex, which is why this is graded C and not scored.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/answer-selection-forensics/question-heading-answer-span-alignment.md',
      tags: ['proposed', 'answer-selection-forensics'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/answer-selection-forensics/question-heading-answer-span-alignment.md',
      'TODO stub',
    );
  }
}
