---
audit: accessibility/form-error-messages
audit_id: "7.6"
category: accessibility
source_file: packages/core/src/audits/accessibility/form-error-messages.ts
slug: form-error-messages
review_verdict: delete
severity: high
evidence_grade: A
disposition: "proposed: redeem as scored (pending triage)"
reviewed: 2026-08-21
---

# form-error-messages (`7.6`)

> accessibility · source `form-error-messages.ts` · review verdict **delete** · evidence grade **A** · disposition: **proposed: redeem as scored (pending triage)**

## What it checks

AI agents filling forms use aria-describedby to detect and understand validation errors programmatically. Without linked error messages, agents cannot self-correct form submissions, causing them to repeatedly submit invalid data or abandon the form entirely.

## Code review findings (2026-08-20, 11-agent pass)

Claims to verify that form validation errors are programmatically linked, but it only counts inputs carrying any `aria-describedby` that resolves to an existing id — and PASSES if a single input on any scanned page has one. `aria-describedby` is overwhelmingly used for hints/help text, not errors, and error markup does not exist in static HTML at all (it is injected after a failed submit), so the audit cannot observe the thing it names. The pass path is vacuous ('1 of 240 inputs' → pass, title renders as 'Form error messages linked'), and it can never fail, only warn. This is a measurement the framework cannot make from a GET request.

**Required fix:** Delete. If a form-readiness signal is wanted here it must be reframed as what is actually observable — e.g. 'required fields declare `required`/`aria-required` and a resolvable `aria-describedby`/`aria-errormessage`' — reported as a ratio with `na` when no validation attributes exist at all, and it must stop being titled/described as measuring error messages.

**False-positive risks:**
- Vacuous pass: `if (withDescribedby > 0) return this.pass(...)` — one help-text `aria-describedby` (e.g. a password-strength hint) passes a site whose 200-field checkout has zero error wiring.
- False warn: a site that does error handling correctly via `aria-invalid` + `role="alert"` + `aria-errormessage` (the modern, ARIA 1.2 way) but no `aria-describedby` gets warned and told to add `aria-describedby`, i.e. actively wrong guidance.
- Server-rendered error states are only present on a POST-back page; a normal GET of a form page can never contain them, so the audit systematically measures hints and reports them as error linkage.
- Only inputs inside `<form>` are counted (`$('form input, form select, form textarea')`) — React/modern sites frequently render fieldsets with no `<form>` wrapper and submit via JS → 'na' (no forms) on pages full of inputs.
- CSR SPA → 'na' with the message 'No form inputs found', masking rather than reporting missing coverage.
- `$(`[id="${id.replace(/"/g, '\\"')}"]`)` builds a selector from untrusted page content; ids containing `]`, backslashes or newlines produce a malformed selector — cheerio throws or silently matches nothing, turning a valid reference into a miss.
- Counts across ALL pages but reports a single global ratio with no page attribution (no `pageUrl` passed on pass/warn).

**Test gaps:**
- No fixture with `aria-invalid` + `role="alert"` + `aria-errormessage` (correct modern error wiring that this audit warns about).
- No fixture with `aria-describedby` used for hint text (the dominant real-world use, which currently produces a pass).
- No fixture with inputs outside a `<form>`.
- No fixture with an id containing selector metacharacters.
- No fixture with many inputs and one describedby (the vacuous-pass ratio).

**Overlaps with:** `7.5`

## Evidence

### Signal: Form labels and ARIA naming for agent form-filling — grade A (semantic-dom-a11y)

**Mechanism:** Agents choose which field to fill by matching the user's intent against the accessible NAME of a control in the accessibility tree, then write to that control by reference. An input whose name comes from a properly associated <label for>, aria-label or aria-labelledby appears as e.g. textbox "Email address"; an input with only a visual placeholder or an adjacent unassociated div appears unnamed, so natural-language lookup fails and the agent either skips the field or writes the right value into the wrong control.

**Evidence:** The full chain is first-party documented. Anthropic: find 'Search for elements matching a natural-language description such as "search field" or "add to cart button"', returning refs in the same tagged format as read_page; form_input then 'Set a form element's value directly' by that ref — so the accessible name is literally the lookup key [anthropic-browser-use-tool]. Playwright MCP's snapshot contents are documented to include 'form elements (textboxes, checkboxes with accessible names)', and browser_fill_form/browser_type act on snapshot refs [playwright-mcp-snapshots, playwright-mcp-repo]. accname (W3C Recommendation) fixes the precedence aria-labelledby > aria-label > native <label>/alt/title [w3c-accname] and HTML-AAM confirms 'label: provides accessible naming for form controls' [w3c-html-aam]. browser-use keys on role textbox/combobox/checkbox/searchbox plus the a11y properties 'focusable, editable, settable' [browser-use-clickable-elements]. Behavioural corroboration: across 300+ trials, agents engaged only where 'semantic button overlays or off-screen text labels are present' and ignored purely visual affordances [machine-readable-ads-paper].

**Counter-evidence:** Pixel-based agents (OpenAI computer use, Gemini Computer Use, Anthropic desktop computer use) fill forms from visual layout and do not require programmatic labels at all [openai-computer-use-guide, gemini-computer-use-docs, anthropic-computer-use-tool]. Adoption data shows agents already cope with widespread absence: only ~35% of mobile inputs get their accessible name from a <label> [web-almanac-2025-accessibility], yet agentic form-filling demonstrably works across the live web — placeholder text, nearby text and CSS position all provide fallback signal, and Anthropic's find is explicitly a fuzzy natural-language matcher rather than an exact accessible-name lookup. No public benchmark isolates label presence against form-fill success rate, so the effect size is undocumented even though the mechanism is airtight. Score presence of an accessible name from any accname-recognised source, not the literal <label for> element.
**Consumers:** Anthropic browser use form_input / find, Playwright MCP browser_fill_form, Chrome DevTools MCP, browser-use, Chrome/Firefox autofill and screen readers (accname consumers) · **Recommended tier:** scored

**Sources:** [Browser use tool (browser_toolset_20260801)](https://platform.claude.com/docs/en/agents-and-tools/tool-use/browser-use-tool) · [Snapshots — Playwright MCP](https://playwright.dev/mcp/snapshots) · [microsoft/playwright-mcp README](https://github.com/microsoft/playwright-mcp) · [Accessible Name and Description Computation 1.1](https://www.w3.org/TR/accname/) · [HTML Accessibility API Mappings 1.0](https://www.w3.org/TR/html-aam-1.0/) · [browser-use ClickableElementDetector source](https://raw.githubusercontent.com/browser-use/browser-use/main/browser_use/dom/serializer/clickable_elements.py) · [Machine-Readable Ads: Accessibility and Trust Patterns for AI Web Agents interacting with Online Advertisements](https://arxiv.org/abs/2507.12844) · [Web Almanac 2025 — Accessibility chapter](https://almanac.httparchive.org/en/2025/accessibility) · [Computer use — OpenAI API guide](https://developers.openai.com/api/docs/guides/tools-computer-use) · [Computer use — Gemini API](https://ai.google.dev/gemini-api/docs/computer-use) · [Computer use tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
