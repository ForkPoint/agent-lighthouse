---
audit: operability-safety/native-control-substitution
category: operability-safety
source_file: packages/core/src/audits/operability-safety/native-control-substitution.ts
slug: native-control-substitution
evidence_grade: A
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-22"
reviewed: 2026-08-20
graduated: 2026-08-22
sources:
  - playwright-locator-select-option
  - playwright-mcp-repo
  - anthropic-cu-ui-tips
  - S2
  - S11
---

# Native Control Substitution Index

> Shipped in v2. Evidence grade **A** · scored tier · unique · implementation: `static-fetch`

## What it checks

Finds choice, date and file controls built as custom widgets instead of the native HTML elements. A native element is `<select>` or an `<input>` of type date, month, week, time, datetime-local, file, color or range.

A custom widget is counted in three cases:

- an element with `role="combobox"`, `"listbox"` or `"menu"` that is not a `<select>` or `<input>`;
- a `div`, `span`, `button` or `a` whose class reads as a picker (`select`, `dropdown`, `picker`, `calendar`, `datepicker`, `chooser`, `combobox`), with a hidden or readonly input in the same region holding its value;
- a drop zone with no `<input type="file">` inside it or beside it.

The region is the enclosing `<form>`, or the parent element when there is none. A native control in the region means the widget decorates a real element, so it is not counted.

Each custom choice widget is then checked for the ARIA combobox contract: a widget role, `aria-expanded`, an `aria-controls` that resolves to a popup role holding options, and an `aria-activedescendant` that resolves when present.

The result reports a weighted index, not an action count. A substitution counts 2 when the page URL or form action reads as checkout, cart, signup, register, book, order or search, and 1 elsewhere.

- No choice, date or file control at all is not applicable.
- Only native controls passes.
- A custom widget with a complete contract warns. It works, but costs more steps than the native element.
- A custom widget with a broken or missing contract, or a drop zone with no file input, fails.

## Claimed mechanism (falsifiable)

Falsifiable claim: native <select>, <input type="date">, and <input type="file"> are single-call primitives in every mainstream agent toolkit (selectOption, fill, setInputFiles) and are keyboard-operable, so they succeed in one action with no actionability risk. A custom equivalent requires five steps: open the control, wait for the popup, scroll the option list into view, locate the option, then click. Each step is independently subject to Playwright's visible, stable and receives-events gates. Anthropic documents dropdowns specifically as 'tricky for Claude to manipulate using mouse movements'. Test: instrument the same form with native vs custom controls and count tool calls and retries to reach an identical value.

## Evidence

- **[Playwright — locator.selectOption() and locator.setInputFiles()](https://playwright.dev/docs/api/class-locator#locator-select-option)** — Microsoft (vendor-doc, verified 2026-10-17)
  - `selectOption` "Selects option or options in `<select>`", and "If the target element is not a `<select>` element, this method throws an error." `setInputFiles` "expects Locator to point to an input element." The one-call primitives exist only for the native elements.
- **[microsoft/playwright-mcp README](https://github.com/microsoft/playwright-mcp)** — Microsoft (vendor-doc, verified 2026-10-17)
  - The agent-facing tools mirror those primitives. `browser_select_option` will "Select an option in a dropdown" by snapshot ref, and `browser_file_upload` will "Upload one or multiple files". A custom widget has to be driven with clicks instead.
- **[Computer use tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool)** — Anthropic (vendor-doc, verified 2026-10-17)
  - "Some UI elements (such as dropdowns and scrollbars) might be tricky for Claude to manipulate using mouse movements. If you experience this, try prompting the model to use keyboard shortcuts."
- **[Playwright: Auto-waiting / Actionability checks](https://playwright.dev/docs/actionability)** — Microsoft (vendor-doc, URL verified 2026-08-20)
  - Each click on a custom widget passes the visible, stable and receives-events checks. Opening a popup, scrolling it and clicking an option is several such actions where the native element needs one.
- **[WebSuite: Systematically Evaluating Why Web Agents Fail](https://arxiv.org/html/2406.01623v1)** — arXiv (study, URL verified 2026-10-17)
  - Counter-evidence. In WebSuite's per-interaction table a custom dropdown menu succeeded 100% for both agents tested, and a native select 100% for one and 0% for the other, over 8 trials each. The study does not show custom widgets failing more often than native ones. The grade rests on the documented tool behaviour above, not on this study.

## Example failure

A checkout ships a styled country picker: <div class="dropdown" tabindex="0"> plus a virtualised <ul> that only renders 20 of 195 countries at a time, and a hidden input carrying the value. Playwright's selectOption is unusable; the agent opens the list, sees 20 entries, does not find 'Netherlands', and has no scroll target inside the popup — the same 'difficulty locating correct scrollable areas' failure WebVoyager names as a driver of navigation-stuck.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

**Grade: A** — the consumer behaviour is first-party documented. Playwright documents that its one-call primitives work only on the native elements and throw on anything else. Playwright MCP exposes those primitives to agents as tools. Anthropic documents dropdowns as hard for Claude to operate with the mouse.

## Implementation deviations

- The id drops the proposal's `-index` suffix. The result carries the index as a weighted count.
- The "labelled field region" is the control's enclosing `<form>`, or its parent element when there is none. A native control anywhere in that region makes the styled div decoration, and it is not counted.

## Deferred

- **Action-cost reporting.** Counting the agent actions a widget costs needs a headless browser. The audit reports the weighted substitution index and the contract defect instead.
- **Virtualised option lists.** Whether a list renders only part of its options is observable only once its script runs, so it is not assessed.

## Limits

### Browser snapshot evidence

Browser agents read the rendered page as an accessibility tree. Anthropic's `read_page` returns "the page's accessibility tree as text", Playwright MCP "uses accessibility snapshots instead of screenshots", and Chrome DevTools MCP `take_snapshot` is "based on the a11y tree" (verified 2026-10-20). A supplied browser snapshot is that rendered DOM, so the browser view reuses this audit on it.

The snapshot path runs this audit on each complete, unredacted, non-loading capture that carries readable text. It reads the parsed capture DOM only. It reports the original static verdict as an unscored browser finding with weight 0. It does not prove HTTP delivery, computed appearance, a complete accessibility tree, live form state, or action success. A truncated, redacted or still-loading capture records missing evidence. Existing implementation limits still apply.

The review and limits appear in [Browser-rendered snapshot assessment](../../../architecture/browser-snapshots.md#supported-audit-inventory). The eligibility record lives in `packages/core/src/snapshot-eligibility.ts`. The crawler grade, tier and weight stay unchanged.
