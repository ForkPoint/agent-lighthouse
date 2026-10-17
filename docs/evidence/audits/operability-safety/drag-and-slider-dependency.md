---
audit: operability-safety/drag-and-slider-dependency
category: operability-safety
source_file: packages/core/src/audits/operability-safety/drag-and-slider-dependency.ts
slug: drag-and-slider-dependency
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - S11
  - anthropic-cu-ui-tips
  - wcag-22-dragging-movements
  - playwright-locator-select-option
---

# Drag and Slider Dependency

> Shipped in v2. Evidence grade **B** · scored tier · unique · implementation: `static-fetch`

## What it checks

Flags controls whose only operation path is a continuous pointer gesture, with no click, keyboard or typed-value alternative beside them. Five cases are reported:

- a range slider with no numeric input or select in the same field group;
- a `role="slider"` with no `aria-valuenow`, `aria-valuemin`, `aria-valuemax` or accessible name;
- a draggable list with no move buttons or position select, on a cart, checkout, builder, configure or order URL only;
- a drop zone with no `<input type="file">` inside or beside it;
- a carousel with swipe handlers and no next or previous button.

Only the reorder case is limited to transaction paths. The other four are checked on every scanned page. No slider, draggable list, drop zone or carousel on the scanned pages is not applicable. Any finding fails.

## Claimed mechanism (falsifiable)

Falsifiable claim: continuous pointer gestures require an agent to synthesise a pointerdown, a sequence of intermediate pointermove events, and a pointerup at a computed pixel offset. There is no feedback loop between steps, and no way to verify the interim value. Every other agent action is discrete and verifiable. WebSuite measures slider interaction at 0% success for both agents tested — the single worst primitive in its taxonomy — and Anthropic separately documents scrollbars and dropdowns as tricky under mouse control, recommending keyboard shortcuts instead. Test: pair the slider with a numeric <input> bound to the same value; the agent's success on 'set max price to 300' goes from 0 to near-certain because it becomes a fill action.

## Evidence

- **[WebSuite: Systematically Evaluating Why Web Agents Fail](https://arxiv.org/html/2406.01623v1)** — arXiv (study, URL verified 2026-10-17)
  - Slider interaction succeeded 0% for both agents tested, natbot and SeeAct, over 32 trials. No other interaction in the study's table scores lower. Date and select inputs, which take a discrete value, scored far higher.
- **[Computer use tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool)** — Anthropic (vendor-doc, verified 2026-10-17)
  - "Some UI elements (such as dropdowns and scrollbars) might be tricky for Claude to manipulate using mouse movements. If you experience this, try prompting the model to use keyboard shortcuts."
- **[Understanding SC 2.5.7: Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)** — W3C WAI (spec, verified 2026-10-17)
  - WCAG 2.2 at level AA: "All functionality that uses a dragging movement for operation can be achieved by a single pointer without dragging", unless dragging is essential. The fixes it names are the ones this audit looks for: "an input beside a slider could allow any user to enter a precise value", and forward and backward buttons on a carousel.
- **[Playwright — locator.setInputFiles()](https://playwright.dev/docs/api/class-locator#locator-select-option)** — Microsoft (vendor-doc, verified 2026-10-17)
  - `setInputFiles` "expects Locator to point to an input element." A drop zone with no file input gives an agent nothing to set files on.

## Example failure

A hotel search gates results behind a dual-thumb price range slider (two divs with no role and no aria-value*) and a drag-only date range. Asked to find rooms under 200 EUR, the agent has no readable current value, no keyboard path and no numeric input. It drags approximately, and cannot read where it landed. It returns results for the wrong range, while asserting the filter was applied.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

**Grade: B** — strong empirical measurement. WebSuite measures slider interaction at 0% for both agents tested. Anthropic documents the same weakness for mouse-driven controls. WCAG 2.5.7 names the discrete alternatives, but it is an accessibility requirement with no documented agent consumer, so it does not lift the grade to A.

## Implementation deviations

- The two slider arms are counted apart. A `role="slider"` missing a value attribute or an accessible name is reported on the APG arm only. A value an agent cannot read is a different defect from one it cannot set discretely.
- "The same labelled field group" is the enclosing `<fieldset>`, `<form>` or `[role="group"]`, else the parent element. A page-wide search would pass a slider beside an unrelated number field.
- Path criticality is matched on `/cart|checkout|builder|configure|order/`. Wider words such as `seat` or `book` match ordinary editorial URLs.
- The reorder finding is raised once per list, not once per item. One set of move buttons is one fix.

## Deferred

- Criticality is a gate on the reorder arm, not a weight on findings.
- Listener-attached drag. A list made sortable in script carries no `draggable` attribute or matching class. Detecting it needs a headless browser.
- Value binding. The audit checks that a discrete control shares the field group, not that it is bound to the same value.
