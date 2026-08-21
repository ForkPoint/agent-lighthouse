import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Site-Wide Passage Uniqueness Ratio".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: multi-page.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/answer-selection-forensics/site-wide-passage-uniqueness-ratio.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Multi-page crawl (cap N, seed from sitemap.xml plus llms.txt links). Per page: extract main
// content, sentence-split, normalize (lowercase, collapse whitespace, strip punctuation). 1) Build
// a site-wide sentence-frequency map; boilerplate = sentences appearing on >= max(3, 5% of crawled
// pages). 2) uniqueFraction(page) = unique sentence characters / total sentence characters; flag
// pages below 0.30. 3) Page-level 5-gram shingles -> 128-permutation MinHash -> LSH banding ->
// clusters at estimated Jaccard >= 0.90. 4) For each cluster, join in rel=canonical target,
// hreflang cluster membership, and sitemap presence; the hard fail is a cluster whose members all
// self-canonicalize, since exactly one will survive Google's election (S9) and the others are
// wasted. 5) Divergence sub-check: for each page with a .md alternate or an llms-full.txt section,
// compute Jaccard between the two; 0.50-0.90 means the alternate has drifted stale and the site is
// serving models a different answer than it serves users — report the diverged sentences. 6) Report
// medianUniqueFraction as the site-level number and the three worst clusters as the actionable
// list.
export class SiteWidePassageUniquenessRatioAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/answer-selection-forensics/site-wide-passage-uniqueness-ratio',
    category: 'answer-selection-forensics',
    title: "Site-Wide Passage Uniqueness Ratio",
    failureTitle: "Site-Wide Passage Uniqueness Ratio",
    description: "Crawls the site, extracts main content per page, and computes two passage-level numbers no page-level tool produces: the fraction of each page's sentences that are unique to it (versus repeated across three or more sibling pages), and MinHash near-duplicate clusters at Jaccard >= 0.9 with the canonical status of every cluster member. Includes a divergence sub-check comparing each page against its llms-full.txt or .md alternate.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "Google clusters duplicate and near-duplicate URLs and elects a single canonical; the losers have their signals consolidated into the winner and are deprioritized (S9) — and AI Overviews eligibility requires being indexed and snippet-eligible in the first place (S4). Separately, near-duplicate saturation is the documented default state of web corpora (S6). Two mechanisms follow. First, a cluster of self-canonicalizing near-duplicate pages competes against itself: at most one member survives canonical election, so the rest are unciteable no matter how good they are. Second, a page whose sentences are mostly site-wide boilerplate produces chunks whose embeddings encode the template rather than the page, so all those pages collide in vector space and none is a distinctive match for any query. Falsifiable at the cluster level: near-duplicate members that self-canonicalize should show markedly lower citation and impression rates than the elected canonical.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/answer-selection-forensics/site-wide-passage-uniqueness-ratio.md',
      tags: ['proposed', 'answer-selection-forensics'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/answer-selection-forensics/site-wide-passage-uniqueness-ratio.md',
      'TODO stub',
    );
  }
}
