import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "UGC Trust-Boundary Markers".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: multi-page.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/injection-safety/ugc-trust-boundary-markers.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Detect UGC regions by union of: JSON-LD/microdata types Comment, UserComments, Review, Question,
// Answer, DiscussionForumPosting; DOM selectors #comments, .comment, [id^=comment-], .review,
// [itemprop=reviewBody], .testimonial; embed scripts for Disqus, Commento, Giscus, Utterances; and
// any <form> posting to wp-comments-post.php or containing a textarea named comment/review/message.
// For each region: (1) is it or an ancestor marked data-nosnippet — and is that ancestor a
// span/div/section, since Google honors it on no other element; (2) do outbound <a> inside it carry
// rel containing ugc or nofollow; (3) does visitor-authored markup survive — presence of inline
// style=, <iframe>, <script>, cross-origin <img>, or a hidden-text construct inside a comment body.
// Scoring: FAIL when (3) trips, since the site's sanitizer permits the hidden-instruction attack
// directly; FAIL when a UGC region is unmarked and the Invisible Instruction Payload or Unicode
// scans already flagged content inside it; WARN when a UGC region or an open submission form exists
// with neither data-nosnippet containment nor a single rel=ugc link — no trust boundary at all. Do
// not submit anything to the form; detection is read-only. Report per-region so the fix maps to one
// template file.
export class UgcTrustBoundaryMarkersAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/injection-safety/ugc-trust-boundary-markers',
    category: 'injection-safety',
    title: "UGC Trust-Boundary Markers",
    failureTitle: "UGC Trust-Boundary Markers",
    description: "Locate visitor-contributed regions (comments, reviews, Q&A, forum posts) and check whether any machine-readable boundary separates them from editorial content: data-nosnippet containment, rel=\"ugc\" on their outbound links, and whether raw markup survives the sanitizer inside them.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "Attacker-controllable text sits in the same DOM as first-party copy with no boundary, so anything a visitor types becomes, to a fetching agent, a statement made by the domain. Google documents the concrete consequence and the concrete fix: text inside a data-nosnippet <span>/<div>/<section> is excluded from snippets across web search, Discover and AI Overviews, and text outside it is not; rel=\"ugc\" is Google's recommended marker for comment and forum links. The unsanitized-markup sub-check is the highest-value part: if a comment body can contain a style attribute or an iframe, then the Invisible Instruction Payload Scan attack becomes self-serve on this site. Brave's Comet PoC was exactly this — an injection hidden in third-party UGC. Falsifier: UGC regions that are data-nosnippet-contained and markup-stripped cannot contribute attacker text to an AI answer attributed to the domain.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/injection-safety/ugc-trust-boundary-markers.md',
      tags: ['proposed', 'injection-safety'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/injection-safety/ugc-trust-boundary-markers.md',
      'TODO stub',
    );
  }
}
