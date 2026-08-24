---
audit: operability-safety/accessible-names
category: operability-safety
source_file: packages/core/src/audits/operability-safety/accessible-names.ts
slug: accessible-names
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

# Buttons and links have accessible names (`7.7`)

> operability-safety · source `_a11y.ts` · review verdict **keep** · evidence grade **A** · disposition: **keep**

## What it checks

AI browser agents identify clickable elements by their accessible name in the accessibility tree. Buttons and links (including icon-only controls) without text, aria-label, or aria-labelledby are invisible to agents, so they cannot navigate the site or trigger actions.

## Code review findings (2026-08-20, 11-agent pass)

Wraps axe `button-name` + `link-name`. Directly agent-relevant — an unnamed control is an untargetable action — and the port handles the realistic naming paths (subtree text incl. `<svg><title>`, aria-label, aria-labelledby, title, presentational role). Keep. Main caveat is the same CSS/SPA environment problem plus binary all-or-nothing severity with unusable selectors.

**Required fix:** _none — audit is sound as implemented_

**False-positive risks:**
- CSS blindness: template/carousel clones, hidden mega-menu panels, and `display:none` social icon rows fail `link-name` though no browser renders them.
- Icon links whose name comes from a CSS `::before` glyph or a background-image sprite legitimately fail — correct per axe, but combined with binary scoring one such footer icon zeroes the audit.
- Deferred content: `<a href>` whose text is injected on hydration (framework `<a>` shells, lazy i18n string substitution) fails on the static HTML.
- Third-party embeds present in the source (tracking pixel anchors, ad iframes' fallback links) fail against a site owner who cannot fix them.
- No count in the output: the message is identical for 1 and 500 violations; failing selectors degenerate to `a`/`a.btn` (categoryNotes #5), so the report cannot be acted on.
- CSR SPA → `na`, silently zero coverage on exactly the sites where agents struggle most.

**Test gaps:**
- No HTML-level test for this audit.
- No `<a><svg><title>` fixture (the svg-title naming path is only implicitly covered).
- No fixture with a hidden-by-class duplicate nav of icon links.
- No fixture asserting the output when dozens of nodes fail (the 5-node cap plus missing count).
- No `<button>` inside a `role="presentation"` ancestor fixture.

**Overlaps with:** _none_

## Evidence

### Signal: Form labels and ARIA naming for agent form-filling — grade A (semantic-dom-a11y)

**Mechanism:** Agents choose which field to fill by matching the user's intent against the accessible NAME of a control in the accessibility tree, then write to that control by reference. An input whose name comes from a properly associated <label for>, aria-label or aria-labelledby appears as e.g. textbox "Email address"; an input with only a visual placeholder or an adjacent unassociated div appears unnamed, so natural-language lookup fails and the agent either skips the field or writes the right value into the wrong control.

**Grade: A** — The whole chain is first-party documented. Anthropic's `find` locates "elements matching a natural-language description such as 'search field' or 'add to cart button'" and returns refs, and `form_input` then sets a value by that ref — so the accessible name is literally the lookup key, and a control named only by a placeholder is not addressable by intent. A named vendor, a named tool and a stated mechanism is grade A. It scopes to programmatic agents: pixel-based ones (OpenAI computer use, Gemini Computer Use, Anthropic desktop computer use) fill forms from visual layout and need no programmatic label at all.

**Evidence:** The full chain is first-party documented. Anthropic: find 'Search for elements matching a natural-language description such as "search field" or "add to cart button"', returning refs in the same tagged format as read_page; form_input then 'Set a form element's value directly' by that ref — so the accessible name is literally the lookup key [anthropic-browser-use-tool]. Playwright MCP's snapshot contents are documented to include 'form elements (textboxes, checkboxes with accessible names)', and browser_fill_form/browser_type act on snapshot refs [playwright-mcp-snapshots, playwright-mcp-repo]. accname (W3C Recommendation) fixes the precedence aria-labelledby > aria-label > native <label>/alt/title [w3c-accname] and HTML-AAM confirms 'label: provides accessible naming for form controls' [w3c-html-aam]. browser-use keys on role textbox/combobox/checkbox/searchbox plus the a11y properties 'focusable, editable, settable' [browser-use-clickable-elements]. Behavioural corroboration: across 300+ trials, agents engaged only where 'semantic button overlays or off-screen text labels are present' and ignored purely visual affordances [machine-readable-ads-paper].

**Counter-evidence:** Pixel-based agents (OpenAI computer use, Gemini Computer Use, Anthropic desktop computer use) fill forms from visual layout and do not require programmatic labels at all [openai-computer-use-guide, gemini-computer-use-docs, anthropic-computer-use-tool]. Adoption data shows agents already cope with widespread absence: only ~35% of mobile inputs get their accessible name from a <label> [web-almanac-2025-accessibility], yet agentic form-filling demonstrably works across the live web — placeholder text, nearby text and CSS position all provide fallback signal, and Anthropic's find is explicitly a fuzzy natural-language matcher rather than an exact accessible-name lookup. No public benchmark isolates label presence against form-fill success rate, so the effect size is undocumented even though the mechanism is airtight. Score presence of an accessible name from any accname-recognised source, not the literal <label for> element.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
