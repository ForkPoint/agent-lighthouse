import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "Drag and Slider Dependency".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade B → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/agent-operability/drag-and-slider-dependency.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Static parse. Flag (a) <input type="range"> or role="slider" that is not accompanied within the
// same labelled field group by a numeric <input> or a <select> bound to the same parameter — and
// additionally fail any role="slider" missing aria-valuenow/aria-valuemin/aria-valuemax or an
// accessible name per APG, since without them the agent cannot even read the current value; (b)
// elements with draggable="true" (or class matching /sortable|draggable|drag-handle|reorder/)
// inside a list on a path matched by /cart|checkout|builder|configure|order/ with no adjacent
// move-up/move-down buttons or position <select>; (c) drop-zone divs with no sibling or descendant
// <input type="file"> (drag-only upload is unoperable — agents set files on an input, they do not
// synthesise a DataTransfer drop); (d) carousels whose only next/prev affordance is touch/swipe
// handlers with no rendered button controls. Weight by path criticality. Every finding names the
// missing discrete alternative, which is the remediation.
export class DragAndSliderDependencyAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/agent-operability/drag-and-slider-dependency',
    category: 'agent-operability',
    title: "Drag and Slider Dependency",
    failureTitle: "Drag and Slider Dependency",
    description: "Flags interactions on task-critical paths whose only operation path is a continuous pointer gesture — range sliders, drag-to-reorder lists, drag-only upload zones, swipe carousels — with no click, keyboard, or typed-value alternative.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "Falsifiable claim: continuous pointer gestures require an agent to synthesise a pointerdown, a sequence of intermediate pointermove events, and a pointerup at a computed pixel offset, with no feedback loop between steps and no way to verify the interim value; every other agent action is discrete and verifiable. WebSuite measures slider interaction at 0% success for both agents tested — the single worst primitive in its taxonomy — and Anthropic separately documents scrollbars and dropdowns as tricky under mouse control, recommending keyboard shortcuts instead. Test: pair the slider with a numeric <input> bound to the same value; the agent's success on 'set max price to 300' goes from 0 to near-certain because it becomes a fill action.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/agent-operability/drag-and-slider-dependency.md',
      tags: ['proposed', 'agent-operability'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/agent-operability/drag-and-slider-dependency.md',
      'TODO stub',
    );
  }
}
