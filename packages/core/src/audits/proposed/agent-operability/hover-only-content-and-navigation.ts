import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Hover-Only Content and Navigation".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/agent-operability/hover-only-content-and-navigation.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Static parse of HTML plus all linked stylesheets. Build the set of selectors that make an element
// visible (display/visibility/opacity/transform/max-height transitions) and check whether the ONLY
// such rule for a given submenu container is predicated on :hover on itself or an ancestor. Fail
// when: the submenu's trigger carries no aria-expanded and no aria-haspopup; and no :focus,
// :focus-within or [aria-expanded="true"]/[data-open] selector produces an equivalent visible
// state; and no JS-toggled class is plausible (heuristic: the trigger has no click/keydown listener
// attribute and no id referenced by aria-controls). Separately flag information carried only by
// title attributes on non-form elements, and hover-card containers (class matching
// /tooltip|popover|hovercard/) not referenced by aria-describedby from a focusable element. Report
// each unreachable destination URL, since those are the pages an agent will never discover.
// Headless tier raises precision by comparing the a11y snapshot at rest against the snapshot after
// dispatching a synthetic hover on each nav trigger and diffing the exposed link set.
export class HoverOnlyContentAndNavigationAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/agent-operability/hover-only-content-and-navigation',
    category: 'agent-operability',
    title: "Hover-Only Content and Navigation",
    failureTitle: "Hover-Only Content and Navigation",
    description: "Detects navigation subtrees and information that exist in the DOM only while a pointer hovers — CSS :hover-revealed submenus with no focus or aria-expanded equivalent, and content carried solely in title attributes or hover cards.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "Falsifiable claim: a submenu revealed only by an ancestor :hover rule is display:none or visibility:hidden in the resting DOM, and Playwright's actionability contract defines such an element as not visible — so every Playwright-derived agent refuses to click it, and the snapshot serializer omits it entirely. The agent therefore never learns those destinations exist. WebSuite measures the information-retrieval half of this at 0% success for tooltip-based content across both agents tested. Test: add a :focus-within (or JS-toggled aria-expanded) path to the same menu; the submenu becomes reachable in the snapshot and the destination becomes clickable without any hover synthesis.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/agent-operability/hover-only-content-and-navigation.md',
      tags: ['proposed', 'agent-operability'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/agent-operability/hover-only-content-and-navigation.md',
      'TODO stub',
    );
  }
}
