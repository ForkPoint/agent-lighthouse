import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Overlay Interception Hazard".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade A → scored tier. Implementation difficulty: headless-browser.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/agent-operability/overlay-interception-hazard.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Headless (roadmap tier). After load and after a settle delay, enumerate interactive nodes (native
// controls plus anything with an interactive role or a click listener), and for each compute its
// bounding box centre and call document.elementFromPoint(x, y); flag when the returned node is not
// the element and not a descendant of it, recording the intercepting element's selector, z-index
// and position value. Aggregate interceptors so one cookie bar reports once with its
// blocked-element count rather than N times. Separately flag: position:fixed layers whose z-index
// exceeds all content and whose area covers more than ~25% of the viewport; invisible full-viewport
// catchers (fixed elements with opacity 0 or transparent background covering the viewport and no
// accessible name); and sticky headers whose height exceeds the offset applied to
// :target/scroll-margin-top, which causes anchor navigation to land on content hidden behind the
// header. Also worth capturing at two viewport sizes, since 1280x720 — the baseline Anthropic
// recommends for computer use — is where sticky chrome eats the largest proportion of usable
// height.
export class OverlayInterceptionHazardAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/agent-operability/overlay-interception-hazard',
    category: 'agent-operability',
    title: "Overlay Interception Hazard",
    failureTitle: "Overlay Interception Hazard",
    description: "For every interactive element in the viewport, checks whether that element is actually the hit target at its own centre point, and reports the intercepting layer. Catches cookie bars, chat widgets, sticky headers over anchor targets, promo modals, and invisible full-viewport click-catchers.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "Falsifiable claim: Playwright's actionability contract includes a 'receives events' check — the element must be the hit target for pointer events at the action point — and aborts the action when an overlay intercepts, which is a hard failure for every Playwright-derived agent. Vision-based agents fail differently but equally: they compute the element's coordinates from the screenshot and click the overlay instead. browser-use's snapshot extractor consumes paint order and stacking contexts for exactly this reason. Test: elementFromPoint at an element's centre returning a node that is neither the element nor its descendant predicts the abort deterministically.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/agent-operability/overlay-interception-hazard.md',
      tags: ['proposed', 'agent-operability'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/agent-operability/overlay-interception-hazard.md',
      'TODO stub',
    );
  }
}
