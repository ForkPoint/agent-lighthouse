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

## Evidence

### Signal: Form labels and ARIA naming for agent form-filling — grade A (semantic-dom-a11y)

**Mechanism:** Agents choose which field to fill by matching the user's intent against the accessible name of a control in the accessibility tree, then write to that control by reference. An input whose name comes from a properly associated <label for>, aria-label or aria-labelledby appears as, for example, textbox "Email address". An input with only a visual placeholder, or an adjacent unassociated div, appears unnamed. Natural-language lookup then fails, and the agent either skips the field or writes the right value into the wrong control.

**Grade: A** — The whole chain is first-party documented. Anthropic's `find` locates "elements matching a natural-language description such as 'search field' or 'add to cart button'" and returns refs. `form_input` then sets a value by that ref. The accessible name is literally the lookup key, so a control named only by a placeholder is not addressable by intent. A named vendor, a named tool and a stated mechanism is grade A. It scopes to programmatic agents: pixel-based ones (OpenAI computer use, Gemini Computer Use, Anthropic desktop computer use) fill forms from visual layout and need no programmatic label at all.

**Evidence:** The full chain is first-party documented. Anthropic's find will 'Search for elements matching a natural-language description such as "search field" or "add to cart button"', and returns refs in the same tagged format as read_page. form_input then 'Set a form element's value directly' by that ref. The accessible name is literally the lookup key [anthropic-browser-use-tool]. Playwright MCP's snapshot contents are documented to include 'form elements (textboxes, checkboxes with accessible names)'. browser_fill_form and browser_type act on snapshot refs [playwright-mcp-snapshots, playwright-mcp-repo]. accname, a W3C Recommendation, fixes the precedence: aria-labelledby over aria-label over the native <label>, alt or title [w3c-accname]. HTML-AAM confirms that 'label: provides accessible naming for form controls' [w3c-html-aam]. browser-use keys on the textbox, combobox, checkbox and searchbox roles, plus the a11y properties 'focusable, editable, settable' [browser-use-clickable-elements]. Behavioural corroboration: across 300+ trials, agents engaged only where 'semantic button overlays or off-screen text labels are present' and ignored purely visual affordances [machine-readable-ads-paper].

**Counter-evidence:** Pixel-based agents (OpenAI computer use, Gemini Computer Use, Anthropic desktop computer use) fill forms from visual layout and do not require programmatic labels at all [openai-computer-use-guide, gemini-computer-use-docs, anthropic-computer-use-tool]. Adoption data shows agents already cope with widespread absence. Only about 35% of mobile inputs get their accessible name from a <label> [web-almanac-2025-accessibility], yet agentic form-filling demonstrably works across the live web. Placeholder text, nearby text and CSS position all provide fallback signal, and Anthropic's find is explicitly a fuzzy natural-language matcher rather than an exact accessible-name lookup. No public benchmark isolates label presence against form-fill success rate, so the effect size is undocumented even though the mechanism is airtight. Score presence of an accessible name from any accname-recognised source, not the literal <label for> element.

## Deferred

- Controls inside a container hidden by an external stylesheet are still
  checked. A large retail site ships an unfilled popup template, hidden by an
  id rule in its stylesheet, whose empty links fail `link-name`. The engine
  honours computed `display:none`, but the runner strips stylesheets before
  building the document, for event-loop cost. The stylesheet scanner in
  `gatherers/css-rules.ts` resolves no specificity and no media queries, so
  skipping on its answer would also skip a desktop menu that is hidden at the
  base and shown at desktop width, which an agent does see. Exact resolution
  waits for the headless tier.
