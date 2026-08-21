import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Native Control Substitution Index".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade A → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/agent-operability/native-control-substitution-index.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Static parse. For each <form> and each labelled field region, classify the control: NATIVE if
// <select>, <input type=date|month|time|file|color|range>; SUBSTITUTED if the region contains no
// native control but does contain (a) role="combobox"/"listbox"/"menu" markup, (b) a hidden <input
// type="hidden"> or type="text" readonly paired with a clickable div whose class matches
// /select|dropdown|picker|calendar|datepicker|chooser/, or (c) a drop-zone div (class matching
// /drop.?zone|file.?drop|upload.?area/) with no sibling <input type="file">. Weight fields on paths
// matched by URL or form action containing /checkout|cart|signup|register|book|order|search/. For
// each SUBSTITUTED control additionally check whether the ARIA combobox contract is satisfiable per
// APG (aria-expanded present, aria-controls resolving to an existing element whose role is
// listbox/grid/tree/dialog, options carrying role=option, aria-activedescendant ids resolvable) — a
// substituted control with a complete contract is a warning; one with a broken or absent contract
// is a failure.
export class NativeControlSubstitutionIndexAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/agent-operability/native-control-substitution-index',
    category: 'agent-operability',
    title: "Native Control Substitution Index",
    failureTitle: "Native Control Substitution Index",
    description: "Counts choice, date, and file-input controls implemented as custom div widgets instead of the native HTML elements, weighted by whether they sit on a conversion-critical path (search, filter, checkout, signup). Reports each substituted control with the number of agent actions it costs versus its native equivalent.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "Falsifiable claim: native <select>, <input type=\"date\">, and <input type=\"file\"> are single-call primitives in every mainstream agent toolkit (selectOption, fill, setInputFiles) and are keyboard-operable, so they succeed in one action with no actionability risk. A custom equivalent requires open → wait for popup → scroll the option list into view → locate the option → click, where each step is independently subject to Playwright's visible/stable/receives-events gates, and Anthropic documents dropdowns specifically as 'tricky for Claude to manipulate using mouse movements'. Test: instrument the same form with native vs custom controls and count tool calls and retries to reach an identical value.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/agent-operability/native-control-substitution-index.md',
      tags: ['proposed', 'agent-operability'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/agent-operability/native-control-substitution-index.md',
      'TODO stub',
    );
  }
}
