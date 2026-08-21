import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Text-Fragment Citation Addressability".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade A → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/answer-selection-forensics/text-fragment-citation-addressability.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Static fetch (headless only for the JS-injection variant). 1) Read response headers; a
// `Document-Policy` value containing `force-load-at-top` is an immediate hard fail — note in the
// report that Document Policy is header-only, so a <meta http-equiv> is not a valid workaround or a
// valid detection site. 2) Build candidate answer spans: first sentence after each h2/h3, every
// <dd>, and every JSON-LD FAQPage acceptedAnswer.text that also occurs in the HTML. 3) Implement
// the block-boundary rule: assign each text node a nearest block ancestor using a display-block
// element list (p, div, li, td, th, h1-h6, section, article, blockquote, dd, dt, figcaption, pre,
// details, summary, main, aside, header, footer). A span is addressable only if its
// whitespace-normalized text lies within one block ancestor. 4) Scan the span for normalization
// hazards: U+00AD soft hyphen, U+200B/200C/200D zero-width, entity-encoded smart quotes that differ
// from the rendered glyph. 5) Ambiguity: if the normalized span occurs more than once in the
// document, require a prefix or suffix that also lives in the same block; if none exists, mark
// unambiguously-unaddressable. 6) Emit the percentage of answer spans that yield a valid fragment,
// plus the generated `#:~:text=` URLs so the user can click-test them. 7) Roadmap headless variant:
// re-run against the post-JS DOM to catch answers injected after load and ::before/::after-injected
// text, which the on-load matcher cannot see.
export class TextFragmentCitationAddressabilityAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/answer-selection-forensics/text-fragment-citation-addressability',
    category: 'answer-selection-forensics',
    title: "Text-Fragment Citation Addressability",
    failureTitle: "Text-Fragment Citation Addressability",
    description: "Determines whether a citing surface can construct a working `#:~:text=` deep link to the page's actual answer sentences. Hard-fails on the documented `Document-Policy: force-load-at-top` opt-out header, then simulates the spec's matching algorithm over the parsed DOM to prove each candidate answer span is (a) contained in a single block-level element, (b) unambiguous or disambiguable with a same-block prefix/suffix, and (c) free of characters that break normalization. Outputs the working fragment URLs as a fix artifact.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "Google Search auto-generates text-fragment URLs to land users on the exact featured-snippet text (S12), and the spec requires each of prefix/start/end/suffix to match within a single block-level element (S2, S3). When an answer sentence is fragmented across block boundaries, or the header opt-out is set, the fragment silently fails and the link degrades to page-top (S3). Falsifiable and directly testable: take the citing surface's own generated URL, load it, and observe whether the browser scrolls and highlights. Two failure classes are binary and deterministic — the opt-out header, and a start string that straddles two blocks.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/answer-selection-forensics/text-fragment-citation-addressability.md',
      tags: ['proposed', 'answer-selection-forensics'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/answer-selection-forensics/text-fragment-citation-addressability.md',
      'TODO stub',
    );
  }
}
