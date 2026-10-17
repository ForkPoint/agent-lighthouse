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

_(The pre-rewrite description claimed to detect live validation errors. A GET cannot observe them; the claim and its replacement are set out in the rewrite section below.)_

## The validation-linkage rewrite (Plan 4, Task 16, 2026-08-22)

The required fix from the code review is executed as written: the audit is reframed onto what a served document actually exposes, reported as a ratio, `na` when no validation attributes exist at all, and it no longer calls itself a measurement of error messages.

**Old pass condition:** at least one `<form>`-scoped input anywhere in the crawl carries an `aria-describedby` whose id resolves. One match passed the whole site; zero matches warned. It could never fail, and it could never be `na` for any page that had inputs.

**New pass condition:** every field in the assessed population points at a message element that exists in the document, via `aria-errormessage` **or** `aria-describedby`. Partial coverage warns, zero coverage fails, and a crawl with no constrained field at all is `notApplicable`.

### Two populations, in priority order

- **Invalid-state fields** (`aria-invalid="true"`) are the direct measurement the redemption note asks for — a field the server rendered in an error state must point at the message explaining it. When any exist, only they are assessed.
- **Required fields** (`required` or `aria-required="true"`) are the fallback proxy, and the one that applies on almost every GET: error markup is injected after a failed submit, so the observable question is whether the fields that _can_ fail are pre-wired. `aria-invalid="false"` is the valid state and enters neither population.
- **Neither present ⇒ `na`.** A page whose fields declare no constraint has nothing to link, and charging it a zero measured the page's genre.

The two are never averaged. Mixing "1 invalid field, wired" with "40 required fields, unwired" into one ratio would produce a number that means neither thing, so the invalid population wins outright whenever it exists.

### False positives closed

- **Vacuous pass gone.** `if (withDescribedby > 0) return this.pass(...)` is replaced by `linked === fields.length`. The code review's "1 of 240 inputs → pass" case now warns and reports `1 of 240`.
- **ARIA 1.2 wiring is no longer punished.** `aria-errormessage` is accepted on equal terms with `aria-describedby`. A site doing errors the modern way used to be warned and told to add `aria-describedby` — advice that would have made its markup worse. A regression test pins that this no longer happens.
- **Fields outside `<form>` are counted.** The old selector was `form input, form select, form textarea`, so a React fieldset that submits via JS reported "No form inputs found" and returned `na`, masking the gap instead of reporting it.
- **Id resolution cannot be broken by page content.** The old code interpolated ids into a `[id="…"]` selector; an id containing `]`, a backslash or a newline threw or silently missed. All ids are collected into a `Set` once per page and membership is tested, so no attribute value can malform a selector.
- **Page attribution.** `pageUrl` is passed on every branch and points at the first page carrying an unlinked field, rather than reporting a global ratio with no location.
- **Non-data controls excluded.** `hidden`, `submit`, `button`, `reset` and `image` never carry a message; `reset` and `image` were missing from the old exclusion list.

### Non-double-counting

`operability-safety/aria-attributes` already runs the `aria-valid-attr-value` rule, which validates that an `aria-errormessage` that _is_ present resolves; `operability-safety/label` covers accessible naming. Neither asks the coverage question — whether constrained fields carry a reference at all — which is what this audit measures. The scope split is stated in the source header.

### Grade decision: stays **A**, tier `scored`, weight 1.0

Source: the redemption note in [REWORK-TODO](../../../../packages/core/src/audits/rework-todo.md) — "Rebuild: verify aria-describedby/aria-errormessage linkage on invalid-state inputs instead of current broken heuristic. Evidence: a11y-tree consumption by computer-use agents graded A" — and the grade-A `semantic-dom-a11y` signal recorded below, whose recommended tier is `scored`. The rework is to the detector, not to the mechanism: the accessibility tree is documented as the lookup surface for Anthropic's `find`/`form_input`, Playwright MCP's `browser_fill_form` and browser-use, and `aria-errormessage`/`aria-describedby` are the accname-adjacent properties that carry a message into it. Per the §4 weight law `weightForGrade('A', 'scored') = 1.0`. `scoreDisplayMode` stays `ternary`, which the new three-state coverage verdict needs, and `defaultPriority` stays `medium`.

## Evidence

### Signal: Form labels and ARIA naming for agent form-filling — grade A (semantic-dom-a11y)

**Mechanism:** Agents choose which field to fill by matching the user's intent against the accessible name of a control in the accessibility tree, then write to that control by reference. An input whose name comes from a properly associated <label for>, aria-label or aria-labelledby appears as, for example, textbox "Email address". An input with only a visual placeholder, or an adjacent unassociated div, appears unnamed. Natural-language lookup then fails, and the agent either skips the field or writes the right value into the wrong control.

**Grade: A** — The whole chain is first-party documented. Anthropic's `find` locates "elements matching a natural-language description such as 'search field' or 'add to cart button'" and returns refs. `form_input` then sets a value by that ref. The accessible name is literally the lookup key, so a control named only by a placeholder is not addressable by intent. A named vendor, a named tool and a stated mechanism is grade A. It scopes to programmatic agents: pixel-based ones (OpenAI computer use, Gemini Computer Use, Anthropic desktop computer use) fill forms from visual layout and need no programmatic label at all.

**Evidence:** The full chain is first-party documented. Anthropic's find will 'Search for elements matching a natural-language description such as "search field" or "add to cart button"', and returns refs in the same tagged format as read_page. form_input then 'Set a form element's value directly' by that ref. The accessible name is literally the lookup key [anthropic-browser-use-tool]. Playwright MCP's snapshot contents are documented to include 'form elements (textboxes, checkboxes with accessible names)'. browser_fill_form and browser_type act on snapshot refs [playwright-mcp-snapshots, playwright-mcp-repo]. accname, a W3C Recommendation, fixes the precedence: aria-labelledby over aria-label over the native <label>, alt or title [w3c-accname]. HTML-AAM confirms that 'label: provides accessible naming for form controls' [w3c-html-aam]. browser-use keys on the textbox, combobox, checkbox and searchbox roles, plus the a11y properties 'focusable, editable, settable' [browser-use-clickable-elements]. Behavioural corroboration: across 300+ trials, agents engaged only where 'semantic button overlays or off-screen text labels are present' and ignored purely visual affordances [machine-readable-ads-paper].

**Counter-evidence:** Pixel-based agents (OpenAI computer use, Gemini Computer Use, Anthropic desktop computer use) fill forms from visual layout and do not require programmatic labels at all [openai-computer-use-guide, gemini-computer-use-docs, anthropic-computer-use-tool]. Adoption data shows agents already cope with widespread absence. Only about 35% of mobile inputs get their accessible name from a <label> [web-almanac-2025-accessibility], yet agentic form-filling demonstrably works across the live web. Placeholder text, nearby text and CSS position all provide fallback signal, and Anthropic's find is explicitly a fuzzy natural-language matcher rather than an exact accessible-name lookup. No public benchmark isolates label presence against form-fill success rate, so the effect size is undocumented even though the mechanism is airtight. Score presence of an accessible name from any accname-recognised source, not the literal <label for> element.
