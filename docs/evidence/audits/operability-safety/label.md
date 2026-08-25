---
audit: operability-safety/label
category: operability-safety
source_file: packages/core/src/audits/operability-safety/label.ts
slug: label
evidence_grade: A
disposition: "keep"
reviewed: 2026-08-21
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

# Form inputs have associated labels (`7.5`)

> operability-safety · source `_a11y.ts` · review verdict **keep** · evidence grade **A** · disposition: **keep**

## What it checks

AI agents filling forms identify fields by their accessible name (label, aria-label, or aria-labelledby). Unlabeled inputs are invisible to form-filling agents, so automated workflows like "sign me up" or "submit a contact request" fail.

## Code review findings (2026-08-20, 11-agent pass)

Wraps axe `label` + `select-name`. Highest-value audit in the category for agent outcomes: an input with no accessible name genuinely cannot be mapped to data by a form-filling agent. The port is faithful (rules.ts:208-209, including the `hidden-explicit-label` none-check). Keep, but two real-world caveats: CSS-hidden modal/drawer inputs are evaluated (false fails) and the `non-empty-placeholder` any-check means placeholder-only inputs pass (a weaker name than the audit's guidance implies).

**Required fix:** _none — audit is sound as implemented_

**False-positive risks:**
- CSS blindness: inputs inside `.modal{display:none}`, off-canvas search drawers, and hidden newsletter overlays are evaluated as visible and fail `label`, while a real browser + real axe skip them. Very common on storefronts (hidden search + hidden mobile filter forms).
- `non-empty-placeholder` is in the any-list, so `<input placeholder="Email">` with no label PASSES — the audit's fix text ('Associate every input with a <label>') is stricter than what it enforces, so a passing site may still be hard for agents that read the accessibility tree (placeholder is not a robust name).
- Custom widgets are invisible to it: `<div role="textbox">`, `<div role="combobox">` and contenteditable fields are not in the `input, textarea` selector → false negative on exactly the JS-heavy forms most likely to break agents.
- CSR SPA → `na`; a React form site gets no signal at all, presented as 'no applicable elements on scanned pages'.
- Binary aggregation: 1 unlabeled hidden honeypot input (a standard anti-spam pattern, often only `style` -less and class-hidden) fails the entire audit exactly like 50 unlabeled checkout fields.

**Test gaps:**
- No HTML-level test for this audit.
- No honeypot-input fixture (class-hidden anti-spam field).
- No placeholder-only fixture asserting the pass, which is the behaviour most likely to surprise a maintainer.
- No `role="textbox"`/contenteditable fixture documenting the coverage hole.
- No fixture with a `<label>` in a different form/shadow context.

**Overlaps with:** `7.6`

## Evidence

### Signal: Form labels and ARIA naming for agent form-filling — grade A (semantic-dom-a11y)

**Mechanism:** Agents choose which field to fill by matching the user's intent against the accessible NAME of a control in the accessibility tree, then write to that control by reference. An input whose name comes from a properly associated <label for>, aria-label or aria-labelledby appears as, for example, textbox "Email address". An input with only a visual placeholder, or an adjacent unassociated div, appears unnamed. Natural-language lookup then fails, and the agent either skips the field or writes the right value into the wrong control.

**Grade: A** — The whole chain is first-party documented. Anthropic's `find` locates "elements matching a natural-language description such as 'search field' or 'add to cart button'" and returns refs. `form_input` then sets a value by that ref. The accessible name is literally the lookup key, so a control named only by a placeholder is not addressable by intent. A named vendor, a named tool and a stated mechanism is grade A. It scopes to programmatic agents: pixel-based ones (OpenAI computer use, Gemini Computer Use, Anthropic desktop computer use) fill forms from visual layout and need no programmatic label at all.

**Evidence:** The full chain is first-party documented. Anthropic's find tool 'Search[es] for elements matching a natural-language description such as "search field" or "add to cart button"', and returns refs in the same tagged format as read_page. form_input then 'Set[s] a form element's value directly' by that ref. The accessible name is literally the lookup key [anthropic-browser-use-tool]. Playwright MCP's snapshot contents are documented to include 'form elements (textboxes, checkboxes with accessible names)', and browser_fill_form and browser_type act on snapshot refs [playwright-mcp-snapshots, playwright-mcp-repo]. accname, a W3C Recommendation, fixes the precedence: aria-labelledby over aria-label over the native <label>, alt or title [w3c-accname]. HTML-AAM confirms that 'label: provides accessible naming for form controls' [w3c-html-aam]. browser-use keys on the textbox, combobox, checkbox and searchbox roles, plus the a11y properties 'focusable, editable, settable' [browser-use-clickable-elements]. Behavioural corroboration: across 300+ trials, agents engaged only where 'semantic button overlays or off-screen text labels are present' and ignored purely visual affordances [machine-readable-ads-paper].

**Counter-evidence:** Pixel-based agents (OpenAI computer use, Gemini Computer Use, Anthropic desktop computer use) fill forms from visual layout and do not require programmatic labels at all [openai-computer-use-guide, gemini-computer-use-docs, anthropic-computer-use-tool]. Adoption data shows agents already cope with widespread absence. Only about 35% of mobile inputs get their accessible name from a <label> [web-almanac-2025-accessibility], yet agentic form-filling demonstrably works across the live web. Placeholder text, nearby text and CSS position all provide fallback signal, and Anthropic's find is explicitly a fuzzy natural-language matcher rather than an exact accessible-name lookup. No public benchmark isolates label presence against form-fill success rate, so the effect size is undocumented even though the mechanism is airtight. Score presence of an accessible name from any accname-recognised source, not the literal <label for> element.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
