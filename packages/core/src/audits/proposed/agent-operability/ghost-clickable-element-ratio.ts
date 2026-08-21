import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Ghost-Clickable Element Ratio".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/agent-operability/ghost-clickable-element-ratio.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Static tier (default): parse the served HTML plus linked CSS. Flag as ghost any element that (a)
// is not a natively interactive tag and has no role attribute, AND (b) matches at least one
// clickability signal — inline onclick/onmousedown/onkeydown, a class or data-attribute matching
// /(^|[-_])(btn|button|cta|link|clickable|tile|card-link|toggle)([-_]|$)/, or a CSS rule setting
// cursor:pointer on its selector. Also flag <a> without href (no link role, no snapshot entry) and
// <button>/<a> whose computed accessible name per accname resolution (content, aria-label,
// aria-labelledby, title, alt of child img, svg <title>) is empty. Score = 1 -
// ghost/(ghost+semantic), fail below ~0.9. Headless tier (higher precision): CDP
// DOMDebugger.getEventListeners over all nodes plus DOMSnapshot cursor/isClickable (the exact
// signals browser-use consumes) intersected against the CDP Accessibility.getFullAXTree node set; a
// ghost is any node with a click listener or cursor:pointer whose AX node is ignored or has role
// generic/none with empty name.
export class GhostClickableElementRatioAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/agent-operability/ghost-clickable-element-ratio',
    category: 'agent-operability',
    title: "Ghost-Clickable Element Ratio",
    failureTitle: "Ghost-Clickable Element Ratio",
    description: "Measures the share of on-page click targets that a DOM/accessibility-tree agent cannot address at all: elements that look and behave clickable to a human or a vision model but expose no native or ARIA role and no accessible name, so they never appear in a Playwright-MCP style snapshot. Reported as ghost / (ghost + semantic) with a per-element evidence table.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "Falsifiable claim: an element whose click behaviour comes only from a JS listener on a non-interactive tag (or from cursor:pointer styling) and which carries no role and no accessible name is omitted from the serialized accessibility snapshot that agent toolkits send to the model; because every action tool in those toolkits addresses elements by snapshot reference, the agent cannot emit a valid click for it and must either fail or fall back to coordinate clicking. Test: take a working <button aria-label=\"Add to cart\">, replace it with an equivalently-styled <div onclick>, re-run browser_snapshot — the ref disappears and browser_click has no valid target. Reverse the change and the ref returns.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/agent-operability/ghost-clickable-element-ratio.md',
      tags: ['proposed', 'agent-operability'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/agent-operability/ghost-clickable-element-ratio.md',
      'TODO stub',
    );
  }
}
