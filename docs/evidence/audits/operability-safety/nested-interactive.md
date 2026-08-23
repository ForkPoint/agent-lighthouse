---
audit: operability-safety/nested-interactive
audit_id: "7.16"
category: operability-safety
source_file: packages/core/src/audits/operability-safety/nested-interactive.ts
slug: nested-interactive
review_verdict: keep
severity: low
evidence_grade: A
disposition: "keep"
reviewed: 2026-08-21
---

# No nested interactive controls (`7.16`)

> operability-safety · source `_a11y.ts` · review verdict **keep** · evidence grade **A** · disposition: **keep**

## What it checks

Interactive elements nested inside other interactive elements (e.g. a button inside a link) create ambiguous targets in the accessibility tree.

## Code review findings (2026-08-20, 11-agent pass)

Wraps `nested-interactive`. Narrow, faithful port (matches only roles with `childrenPresentational`), and the failure mode it describes — two overlapping click targets — is a genuine source of wrong actions for browser agents. Fires rarely and mostly on real bugs. Keep.

**Required fix:** _none — audit is sound as implemented_

**False-positive risks:**
- CSS blindness: nested controls inside hidden template/carousel clones are evaluated.
- `getFocusableDescendants` treats any element with a `tabindex` attribute as focusable, so `tabindex="-1"` wrappers used purely for programmatic focus inside a card link are flagged (`isFocusable` returns true for any parseable tabindex, including -1) — a common legitimate pattern in card/tile components.
- CSR SPA → `na`.
- Failing target is typically `a`/`div.card`, unusable for locating the nested pair; no count.

**Test gaps:**
- No HTML-level test for this audit.
- No fixture with `tabindex="-1"` inside a link/button (the likeliest false positive).
- No fixture with `<a><button>` nesting proving the rule fires.

**Overlaps with:** _none_

## Evidence

### Signal: Accessibility tree consumption by computer-use and agentic-browser agents — grade A (semantic-dom-a11y)

**Mechanism:** Browser-embedded agents perceive the page as a serialized accessibility tree — role plus accessible name plus state plus an opaque element reference — and issue actions against those references rather than against CSS selectors or screen coordinates. Therefore an element's presence, role correctness and accessible name in the a11y tree determine whether an agent can see it and act on it at all; elements that are role-suppressed, unnamed, or misrole'd are functionally invisible to this class of agent regardless of how they look on screen.

**Evidence:** Three independent major-vendor harnesses, all first-party. Anthropic: read_page 'Return the page's accessibility tree as text with each element tagged with a reference such as [ref_2]', and the security guidance instructs implementers to 'build page reads from what the page renders (the accessibility tree or visible text), not raw DOM source' [anthropic-browser-use-tool]. Microsoft: 'Uses Playwright's accessibility tree, not pixel-based input' [playwright-mcp-repo], with snapshot mode the default and vision mode reserved for 'pages with poor accessibility markup' [playwright-mcp-snapshots]. Google: chrome-devtools-mcp take_snapshot is 'a text snapshot… based on the a11y tree… along with a unique identifier (uid)' [chrome-devtools-mcp-tool-reference]. The dominant OSS library resolves interactivity from ARIA roles, role/tabindex attributes, ARIA state and the accessibility properties 'focusable, editable, settable' [browser-use-clickable-elements]. The standard research benchmark exposes observation_type='accessibility_tree' [webarena-repo, webarena-paper]. The tree's contents are governed by ratified specs [w3c-wai-aria-1-2, w3c-accname, w3c-html-aam].

**Counter-evidence:** The claim must be scoped to browser-embedded agents, and even there it is contested. Pixel-only consumers: Anthropic's DESKTOP computer use tool is screenshot-only with no DOM or a11y access [anthropic-computer-use-tool]; OpenAI's computer use tool takes base64 PNG screenshots and 'the model looks at the current UI through a screenshot' with no structured input [openai-computer-use-guide, openai-cua-announcement]; Gemini Computer Use is likewise screenshots plus action history [gemini-computer-use-docs]. And the a11y tree is not even always the better representation: a 2026 study measured Claude Sonnet 4.6 gaining +14.6pp and GPT-5.1 (high reasoning) +17.5pp when given raw HTML INSTEAD of the accessibility tree, because strong models 'exploit layout information in HTML for better action grounding' — the a11y tree only won for lower-capability models [observation-reduction-paper]. So a11y-tree quality is a strong, well-documented determinant for one large and growing class of agent, not a universal precondition.
**Consumers:** Anthropic browser use tool / Claude in Chrome, Playwright MCP (snapshot mode), Chrome DevTools MCP, browser-use, WebArena / BrowserGym-style benchmarks, Browserless agent MCP · **Recommended tier:** scored

**Sources:** [Browser use tool (browser_toolset_20260801)](https://platform.claude.com/docs/en/agents-and-tools/tool-use/browser-use-tool) · [microsoft/playwright-mcp README](https://github.com/microsoft/playwright-mcp) · [Snapshots — Playwright MCP](https://playwright.dev/mcp/snapshots) · [chrome-devtools-mcp tool reference (take_snapshot)](https://raw.githubusercontent.com/ChromeDevTools/chrome-devtools-mcp/main/docs/tool-reference.md) · [browser-use ClickableElementDetector source](https://raw.githubusercontent.com/browser-use/browser-use/main/browser_use/dom/serializer/clickable_elements.py) · [web-arena-x/webarena repository](https://github.com/web-arena-x/webarena) · [WebArena: A Realistic Web Environment for Building Autonomous Agents](https://arxiv.org/abs/2307.13854) · [Accessible Rich Internet Applications (WAI-ARIA) 1.2](https://www.w3.org/TR/wai-aria-1.2/) · [Accessible Name and Description Computation 1.1](https://www.w3.org/TR/accname/) · [HTML Accessibility API Mappings 1.0](https://www.w3.org/TR/html-aam-1.0/) · [Computer use tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool) · [Computer use — OpenAI API guide](https://developers.openai.com/api/docs/guides/tools-computer-use) · [Computer use — Gemini API](https://ai.google.dev/gemini-api/docs/computer-use) · [Read More, Think More: Revisiting Observation Reduction for Web Agents](https://arxiv.org/abs/2604.01535) · [Computer-Using Agent (CUA)](https://openai.com/index/computer-using-agent/)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
