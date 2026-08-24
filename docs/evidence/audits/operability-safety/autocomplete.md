---
audit: operability-safety/autocomplete
audit_id: "7.15"
category: operability-safety
source_file: packages/core/src/audits/operability-safety/autocomplete.ts
slug: autocomplete
review_verdict: fix
severity: medium
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# Form fields use valid autocomplete tokens (`7.15`)

> operability-safety · source `_a11y.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Form-filling agents map fields to known data (name, email, address, payment) via autocomplete tokens. Invalid tokens break that mapping.

## Code review findings (2026-08-20, 11-agent pass)

Wraps `autocomplete-valid`, which only validates the SYNTAX of autocomplete tokens on fields that already have the attribute (rules.ts `autocompleteMatch` requires a non-empty `autocomplete`). But the meta text says 'Without valid autocomplete, an agent must guess each field's meaning, so automated checkout/sign-up flows fail' — describing a PRESENCE check the audit does not perform. A site with zero autocomplete attributes anywhere (the common case) returns `na` and is excluded from scoring, so the checkout-readiness concern the description raises is never actually reported. Title and behaviour disagree.

**Required fix:** Either (a) rewrite title/description/impact to say plainly 'validates autocomplete tokens where present; does not require them', or (b) add a presence dimension: when a scanned page has recognisable personal-data inputs (`type=email|tel`, `name~=(email|phone|address|zip|cc)`) and none carry autocomplete, return `warn` instead of `na`. Do not leave the current mismatch between what the text promises and what the rule measures.

**False-positive risks:**
- Misleading `na`: no autocomplete anywhere → 'no applicable elements on scanned pages', which a user reads as 'nothing to fix' when it is exactly the failure the description warns about.
- Vendor/framework tokens that are valid HTML but non-standard (`autocomplete="one-time-code"` is valid; `autocomplete="off"`/`"new-password"` handled; but framework-emitted values like `autocomplete="nope"`/`"chrome-off"` used deliberately to suppress autofill) are flagged as errors even though they are an intentional pattern.
- CSS blindness: hidden duplicate checkout forms in drawers are evaluated.
- CSR SPA → `na`.
- Binary verdict at 'high' priority for what is, when it fires, usually a single typo'd token.

**Test gaps:**
- No HTML-level test for this audit.
- No fixture with zero autocomplete attributes asserting the `na` (the misleading path).
- No fixture with the deliberate anti-autofill tokens.
- No fixture with `autocomplete="section-blue shipping street-address"` (multi-token form).

**Overlaps with:** `7.5`

## Evidence

### Signal: Form labels and ARIA naming for agent form-filling — grade A (semantic-dom-a11y)

**Mechanism:** Agents choose which field to fill by matching the user's intent against the accessible NAME of a control in the accessibility tree, then write to that control by reference. An input whose name comes from a properly associated <label for>, aria-label or aria-labelledby appears as e.g. textbox "Email address"; an input with only a visual placeholder or an adjacent unassociated div appears unnamed, so natural-language lookup fails and the agent either skips the field or writes the right value into the wrong control.

**Evidence:** The full chain is first-party documented. Anthropic: find 'Search for elements matching a natural-language description such as "search field" or "add to cart button"', returning refs in the same tagged format as read_page; form_input then 'Set a form element's value directly' by that ref — so the accessible name is literally the lookup key [anthropic-browser-use-tool]. Playwright MCP's snapshot contents are documented to include 'form elements (textboxes, checkboxes with accessible names)', and browser_fill_form/browser_type act on snapshot refs [playwright-mcp-snapshots, playwright-mcp-repo]. accname (W3C Recommendation) fixes the precedence aria-labelledby > aria-label > native <label>/alt/title [w3c-accname] and HTML-AAM confirms 'label: provides accessible naming for form controls' [w3c-html-aam]. browser-use keys on role textbox/combobox/checkbox/searchbox plus the a11y properties 'focusable, editable, settable' [browser-use-clickable-elements]. Behavioural corroboration: across 300+ trials, agents engaged only where 'semantic button overlays or off-screen text labels are present' and ignored purely visual affordances [machine-readable-ads-paper].

**Counter-evidence:** Pixel-based agents (OpenAI computer use, Gemini Computer Use, Anthropic desktop computer use) fill forms from visual layout and do not require programmatic labels at all [openai-computer-use-guide, gemini-computer-use-docs, anthropic-computer-use-tool]. Adoption data shows agents already cope with widespread absence: only ~35% of mobile inputs get their accessible name from a <label> [web-almanac-2025-accessibility], yet agentic form-filling demonstrably works across the live web — placeholder text, nearby text and CSS position all provide fallback signal, and Anthropic's find is explicitly a fuzzy natural-language matcher rather than an exact accessible-name lookup. No public benchmark isolates label presence against form-fill success rate, so the effect size is undocumented even though the mechanism is airtight. Score presence of an accessible name from any accname-recognised source, not the literal <label for> element.
**Consumers:** Anthropic browser use form_input / find, Playwright MCP browser_fill_form, Chrome DevTools MCP, browser-use, Chrome/Firefox autofill and screen readers (accname consumers) · **Recommended tier:** scored

**Sources:** [Browser use tool (browser_toolset_20260801)](https://platform.claude.com/docs/en/agents-and-tools/tool-use/browser-use-tool) (verified 2026-08-20) · [Snapshots — Playwright MCP](https://playwright.dev/mcp/snapshots) (verified 2026-08-20) · [microsoft/playwright-mcp README](https://github.com/microsoft/playwright-mcp) (verified 2026-08-20) · [Accessible Name and Description Computation 1.1](https://www.w3.org/TR/accname/) (verified 2026-08-20) · [HTML Accessibility API Mappings 1.0](https://www.w3.org/TR/html-aam-1.0/) (verified 2026-08-20) · [browser-use ClickableElementDetector source](https://raw.githubusercontent.com/browser-use/browser-use/main/browser_use/dom/serializer/clickable_elements.py) (verified 2026-08-20) · [Machine-Readable Ads: Accessibility and Trust Patterns for AI Web Agents interacting with Online Advertisements](https://arxiv.org/abs/2507.12844) (verified 2026-08-20) · [Web Almanac 2025 — Accessibility chapter](https://almanac.httparchive.org/en/2025/accessibility) (verified 2026-08-20) · [Computer use — OpenAI API guide](https://developers.openai.com/api/docs/guides/tools-computer-use) (verified 2026-08-20) · [Computer use — Gemini API](https://ai.google.dev/gemini-api/docs/computer-use) (verified 2026-08-20) · [Computer use tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool) (verified 2026-08-20)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
