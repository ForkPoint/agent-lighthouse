import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Ghost content: CSS-hidden text ingested as visible".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade A → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/token-economics/ghost-content-css-hidden-text-ingested-as-visible.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Fetch HTML plus every same-origin <link rel=stylesheet> and inline <style>. Parse CSS with
// postcss; collect selectors whose declarations include display:none, visibility:hidden,
// content-visibility:hidden, or clip-path/position:absolute with 1px sizing (the sr-only idiom).
// Match those selectors against the DOM with css-select over linkedom, excluding nodes that already
// carry an inline hidden marker (those are the ones Readability handles). Sum textContent tokens of
// matched subtrees. For duplication, shingle each hidden block against the visible text. Known
// approximation: no cascade or specificity resolution and no media-query evaluation — mitigate by
// ignoring rules inside print media and by reporting matched selector text as evidence so a human
// can adjudicate. Exact resolution via getComputedStyle is a headless roadmap upgrade.
export class GhostContentCssHiddenTextIngestedAsVisibleAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/token-economics/ghost-content-css-hidden-text-ingested-as-visible',
    category: 'token-economics',
    title: "Ghost content: CSS-hidden text ingested as visible",
    failureTitle: "Ghost content: CSS-hidden text ingested as visible",
    description: "Find text that is hidden from human readers by an external stylesheet class but is invisible-as-hidden to every extractor an agent uses, and size it in tokens. Fail if class-hidden text exceeds 15% of the page's total text tokens or 1,000 tokens absolute; separately fail on near-duplicate hidden blocks (a mobile nav or tab-panel set duplicating visible content). Report contradiction risk when hidden text contains prices, availability, or dated claims.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "This is provable from source, not inferred. Readability's visibility test consults only node.style.display, node.style.visibility, the hidden attribute and aria-hidden — it explicitly does not evaluate class-based CSS rules from stylesheets. AI crawlers do not render, so no cascade is ever computed. Therefore any subtree hidden by `.mobile-only{display:none}`, `.tab-panel:not(.active){display:none}` or `[data-state=closed]{display:none}` reaches the model as ordinary body text with full weight. Consequence is not just cost: the agent sees three parallel copies of a nav, both the collapsed and expanded FAQ answers, and often stale price text from a hidden variant block, and irrelevant/contradictory context measurably degrades answers.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/token-economics/ghost-content-css-hidden-text-ingested-as-visible.md',
      tags: ['proposed', 'token-economics'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/token-economics/ghost-content-css-hidden-text-ingested-as-visible.md',
      'TODO stub',
    );
  }
}
