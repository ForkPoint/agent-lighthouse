---
audit: accessibility/_a11y
audit_id: "7.13"
category: accessibility
source_file: packages/core/src/audits/accessibility/_a11y.ts
slug: aria-required-attr
review_verdict: fix
severity: medium
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# Complete ARIA relationships (`7.13`)

> accessibility · source `_a11y.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Composite widgets (menus, listboxes, tabs, grids) require specific child/parent roles and attributes. Missing pieces break the structure agents traverse.

## Code review findings (2026-08-20, 11-agent pass)

Bundles `aria-required-attr`, `aria-required-children`, `aria-required-parent`. The signal is real for composite widgets, but of all the engine audits this one is the most exposed to static-HTML evaluation: required children/parents of menus, listboxes, tabs, comboboxes and grids are routinely rendered or moved at runtime, so a fully working widget in the browser reports a violation here.

**Required fix:** Downgrade violations that come from EMPTY required-children containers to `warn` (they are indistinguishable from a runtime-populated widget on static HTML), keep hard fails only for containers that have children of the wrong role. Report which of the three rules fired.

**False-positive risks:**
- Runtime-populated widgets: `<ul role="listbox"></ul>` / `role="menu"` / `role="tablist"` whose `option`/`menuitem`/`tab` children are rendered on open (the standard pattern for every dropdown library) fail `aria-required-children` on the fetched HTML while being correct in a browser.
- `aria-required-parent`: elements relocated into their container by JS (portals, `aria-owns` set at runtime) fail even though the browser tree is well-formed.
- CSS blindness: hidden mega-menu / accordion widgets that a browser skips are evaluated.
- Three rules collapsed into one binary verdict at 'medium' priority with no attribution.
- The `reviewEmpty` option list in checks.ts routes some empty containers to `incomplete`, which the base class then swallows if any sibling rule passes (categoryNotes #4a) — so results are inconsistent between roles in a way the report does not explain.
- CSR SPA → `na`.

**Test gaps:**
- No HTML-level test for this audit.
- No fixture with an empty `role="listbox"`/`role="menu"` container (the dominant real-world false positive).
- No `aria-owns`-satisfied fixture at the audit level (only the engine-level perf test covers it).
- No fixture proving the reviewEmpty→incomplete path.

**Overlaps with:** `7.12`

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
