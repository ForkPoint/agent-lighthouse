import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Stateful Control Introspectability".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/agent-operability/stateful-control-introspectability.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Static parse plus a lightweight CSS pass. Enumerate candidate state-bearing controls: (a)
// elements with role in {switch, checkbox, radio, tab, menuitemcheckbox, menuitemradio, option,
// treeitem} — fail any missing aria-checked / aria-selected as required by APG; (b) elements with
// role=button or a click signal whose class list contains a state token matching
// /(^|[-_])(is-)?(active|selected|on|off|open|expanded|checked|current|enabled)([-_]|$)/ and which
// carry no aria-pressed, aria-checked, aria-expanded, aria-selected or aria-current — these are
// CSS-only state; (c) disclosure triggers (a clickable element whose id is referenced by
// aria-controls, or that sits immediately before a collapsible panel matched by class
// /accordion|collapse|panel|details-content/) lacking aria-expanded; note that native
// <details>/<summary> passes automatically; (d) sort/filter controls in tables lacking aria-sort on
// the <th>. Score = 1 - opaque/(opaque+introspectable). Emit each opaque control with the CSS class
// that carries its state, since that class name is the exact remediation target.
export class StatefulControlIntrospectabilityAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/agent-operability/stateful-control-introspectability',
    category: 'agent-operability',
    title: "Stateful Control Introspectability",
    failureTitle: "Stateful Control Introspectability",
    description: "Checks that every control whose purpose is to hold a state — toggles, switches, checkboxes, radio groups, tabs, accordions, disclosure triggers, sort direction, filter chips — exposes that state through a machine-readable attribute rather than a CSS class alone. Reports the count of state-bearing controls whose current value an agent cannot read.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "Falsifiable claim: an agent operates as observe → act → verify. If a toggle's only 'on' signal is class=\"is-active\" plus a colour change, the agent's accessibility snapshot is byte-identical before and after the click, so it cannot verify the post-condition. It then either clicks again (flipping the state back) or asserts success without evidence. WebSP-Eval measures the consequence across 28 sites: toggles alone cause over 45% task failure across many models, and stateful UI elements are named the primary failure factor. Test: add aria-checked to the same toggle and re-run — the snapshot now differs pre/post and the double-toggle behaviour disappears.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/agent-operability/stateful-control-introspectability.md',
      tags: ['proposed', 'agent-operability'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/agent-operability/stateful-control-introspectability.md',
      'TODO stub',
    );
  }
}
