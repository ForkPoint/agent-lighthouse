import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Extractor Survival Recall".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/answer-selection-forensics/extractor-survival-recall.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Static fetch, parse with linkedom or jsdom. 1) Run @mozilla/readability to get article.content.
// 2) Run a second pass mimicking Firecrawl/Jina defaults: drop script, style, nav, aside, header,
// footer, form, iframe, plus elements whose class or id matches
// /comment|sidebar|promo|related|advert|ad-|banner|cookie|newsletter|share/i. 3) Define key spans
// K: h1 text; the first two sentences of each h2/h3 section; every <caption>; every <dt>; every
// <th>; and every JSON-LD string value (description, offers.price, aggregateRating.ratingValue)
// that also literally occurs in the HTML. 4) recall = |K present in extracted output| / |K|; fail
// below 0.9. 5) For each dropped span, walk back up the source DOM and report the ancestor chain
// that caused the drop — that is the actionable output ('your spec table lives inside <aside
// class="related-specs">'). 6) textRatio = extracted chars / total visible-text chars: flag < 0.25
// as over-strip risk and > 0.85 as boilerplate leakage (chrome text will dominate the page's chunk
// embeddings). 7) Report both extractors separately, since disagreement between them is itself a
// fragility signal.
export class ExtractorSurvivalRecallAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/answer-selection-forensics/extractor-survival-recall',
    category: 'answer-selection-forensics',
    title: "Extractor Survival Recall",
    failureTitle: "Extractor Survival Recall",
    description: "Runs the boilerplate-stripping, HTML-to-markdown pipeline that agent readers actually run, then measures what fraction of the page's load-bearing spans survived it. Reports, by name, every key span that was dropped and the container that swallowed it. Also reports the extracted/total text ratio in both directions: over-stripping (answers living in stripped containers) and under-stripping (nav and footer boilerplate diluting the page's embedding).",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "Answer engines and agent readers do not embed raw HTML; they strip boilerplate and convert main content to markdown — Jina Reader states 'Boilerplate such as navigation, headers, footers, and ads is stripped, and the main content is converted to Markdown' (S10), and Firecrawl exposes the same only-main-content path (S11). These extractors use structural and class-name heuristics. Content placed in <aside>, <footer>, a role=complementary region, or a container whose class matches a stripper blocklist is deleted before embedding, so it can never be retrieved or cited regardless of its quality. Falsifiable and cheap to verify: fetch the same URL through r.jina.ai and check whether the fact is present in the returned markdown.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/answer-selection-forensics/extractor-survival-recall.md',
      tags: ['proposed', 'answer-selection-forensics'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/answer-selection-forensics/extractor-survival-recall.md',
      'TODO stub',
    );
  }
}
