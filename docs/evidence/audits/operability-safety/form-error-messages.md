---
audit: operability-safety/form-error-messages
category: operability-safety
source_file: packages/core/src/audits/operability-safety/form-error-messages.ts
slug: form-error-messages
evidence_grade: A
disposition: "kept — rewritten to a validation-linkage coverage check 2026-08-22 (Plan 4, Task 16)"
reviewed: 2026-08-22
recommended_tier: scored
consumers:
  - Anthropic browser use form_input / find
  - Playwright MCP browser_fill_form
  - Chrome DevTools MCP
  - browser-use
  - Chrome/Firefox autofill and screen readers (accname consumers)
signals:
  - name: Form labels and ARIA naming for agent form-filling
    grade: A
    domain: semantic-dom-a11y
sources:
  - anthropic-browser-use-tool
  - playwright-mcp-snapshots
  - playwright-mcp-repo
  - w3c-accname
  - w3c-html-aam
  - browser-use-clickable-elements
  - machine-readable-ads-paper
  - web-almanac-2025-accessibility
  - openai-computer-use-guide
  - gemini-computer-use-docs
  - anthropic-cu-tool
---

# form-error-messages (`7.6`)

> operability-safety · source `form-error-messages.ts` · evidence grade **A** · tier **scored** (weight 1.0) · rewritten from a vacuous first-match `aria-describedby` count to a two-population coverage ratio — see below

## What it checks

An agent filling a form reads the accessibility tree, where a message is attached to a field by `aria-errormessage` or `aria-describedby`. Fields the server rendered as `aria-invalid="true"` are checked directly; where no invalid state exists in the served document — the normal case on a GET — the required fields are checked instead, because those are the ones that can fail.

The audit does not see live validation errors. A GET returns the page before any submit, and error messages are usually injected only after a failed one. What the served document does show is whether a field carries the reference that will point at its message.

- The two populations are never averaged. Invalid-state fields are assessed when any exist; otherwise required fields (`required` or `aria-required="true"`) are.
- A reference counts when `aria-errormessage` or `aria-describedby` resolves to an element in the document.
- Fields outside a `<form>` count. `hidden`, `submit`, `button`, `reset` and `image` inputs do not.
- All fields linked passes. None linked fails. Some linked warns.
- No required or invalid-state field on the scanned pages is not applicable.

## Evidence

### Signal: Form labels and ARIA naming for agent form-filling — grade A (semantic-dom-a11y)

**Mechanism:** Agents choose which field to fill by matching the user's intent against the accessible name of a control in the accessibility tree, then write to that control by reference. An input whose name comes from a properly associated <label for>, aria-label or aria-labelledby appears as, for example, textbox "Email address". An input with only a visual placeholder, or an adjacent unassociated div, appears unnamed. Natural-language lookup then fails, and the agent either skips the field or writes the right value into the wrong control.

**Grade: A** — The whole chain is first-party documented. Anthropic's `find` locates "elements matching a natural-language description such as 'search field' or 'add to cart button'" and returns refs. `form_input` then sets a value by that ref. The accessible name is literally the lookup key, so a control named only by a placeholder is not addressable by intent. A named vendor, a named tool and a stated mechanism is grade A. It scopes to programmatic agents: pixel-based ones (OpenAI computer use, Gemini Computer Use, Anthropic desktop computer use) fill forms from visual layout and need no programmatic label at all.

**Evidence:** The full chain is first-party documented. Anthropic's find will 'Search for elements matching a natural-language description such as "search field" or "add to cart button"', and returns refs in the same tagged format as read_page. form_input then 'Set a form element's value directly' by that ref. The accessible name is literally the lookup key [anthropic-browser-use-tool]. Playwright MCP's snapshot contents are documented to include 'form elements (textboxes, checkboxes with accessible names)'. browser_fill_form and browser_type act on snapshot refs [playwright-mcp-snapshots, playwright-mcp-repo]. accname, a W3C Recommendation, fixes the precedence: aria-labelledby over aria-label over the native <label>, alt or title [w3c-accname]. HTML-AAM confirms that 'label: provides accessible naming for form controls' [w3c-html-aam]. browser-use keys on the textbox, combobox, checkbox and searchbox roles, plus the a11y properties 'focusable, editable, settable' [browser-use-clickable-elements]. Behavioural corroboration: across 300+ trials, agents engaged only where 'semantic button overlays or off-screen text labels are present' and ignored purely visual affordances [machine-readable-ads-paper].

**Counter-evidence:** Pixel-based agents (OpenAI computer use, Gemini Computer Use, Anthropic desktop computer use) fill forms from visual layout and do not require programmatic labels at all [openai-computer-use-guide, gemini-computer-use-docs, anthropic-computer-use-tool]. Adoption data shows agents already cope with widespread absence. Only about 35% of mobile inputs get their accessible name from a <label> [web-almanac-2025-accessibility], yet agentic form-filling demonstrably works across the live web. Placeholder text, nearby text and CSS position all provide fallback signal, and Anthropic's find is explicitly a fuzzy natural-language matcher rather than an exact accessible-name lookup. No public benchmark isolates label presence against form-fill success rate, so the effect size is undocumented even though the mechanism is airtight. Score presence of an accessible name from any accname-recognised source, not the literal <label for> element.

## Implementation deviations

- The audit measures reference coverage, not live validation errors. A GET cannot observe errors injected after a failed submit.
- Fields with `aria-invalid="true"` are assessed when any exist. Otherwise required fields (`required` or `aria-required="true"`) are assessed. The two populations are never averaged.
- A crawl with no constrained field is `notApplicable`.
- `aria-errormessage` and `aria-describedby` count equally. Fields outside a `<form>` are counted.
- Ids are collected into a set per page, so no attribute value can malform a selector.
- `hidden`, `submit`, `button`, `reset` and `image` inputs are excluded.
- `aria-attributes` validates that a present reference resolves, and `label` covers naming. This audit asks only whether constrained fields carry a reference at all.

## Limits

### Browser snapshot evidence

Browser agents read the rendered page as an accessibility tree. Anthropic's `read_page` returns "the page's accessibility tree as text", Playwright MCP "uses accessibility snapshots instead of screenshots", and Chrome DevTools MCP `take_snapshot` is "based on the a11y tree" (verified 2026-10-20). A supplied browser snapshot is that rendered DOM, so the browser view reuses this audit on it.

The snapshot path runs this audit on each complete, unredacted, non-loading capture that carries readable text. It reads the parsed capture DOM only. It reports the original static verdict as an unscored browser finding with weight 0. It does not prove HTTP delivery, computed appearance, a complete accessibility tree, live form state, or action success. A truncated, redacted or still-loading capture records missing evidence. Existing implementation limits still apply.

The review and limits appear in [Browser-rendered snapshot assessment](../../../architecture/browser-snapshots.md#supported-audit-inventory). The eligibility record lives in `packages/core/src/snapshot-eligibility.ts`. The crawler grade, tier and weight stay unchanged.
