---
audit: operability-safety/aria-roles
category: operability-safety
source_file: packages/core/src/audits/operability-safety/aria-roles.ts
slug: aria-roles
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: scored
consumers:
  - Anthropic browser use tool / Claude in Chrome
  - Playwright MCP (snapshot mode)
  - Chrome DevTools MCP
  - browser-use
  - WebArena / BrowserGym-style benchmarks
  - Browserless agent MCP
signals:
  - name: Accessibility tree consumption by computer-use and agentic-browser agents
    grade: A
    domain: semantic-dom-a11y
sources:
  - anthropic-browser-use-tool
  - playwright-mcp-repo
  - playwright-mcp-snapshots
  - chrome-devtools-mcp-tool-reference
  - browser-use-clickable-elements
  - webarena-repo
  - webarena-paper
  - w3c-wai-aria-1-2
  - w3c-accname
  - w3c-html-aam
  - anthropic-cu-tool
  - openai-computer-use-guide
  - gemini-computer-use-docs
  - observation-reduction-paper
  - openai-cua-announcement
  - anthropic-computer-use-tool
---

# Valid ARIA roles (`7.11`)

> operability-safety · source `_a11y.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

AI agents map elements to behaviors by their ARIA role. Invalid, deprecated, or disallowed roles make an element’s purpose ambiguous, so agents may mis-classify or skip it.

## Code review findings (2026-08-20, 11-agent pass)

Bundles `aria-roles` (invalid/abstract/unsupported), `aria-deprecated-role`, and `aria-allowed-role` into one binary verdict. The first two are hard correctness errors worth a 'high' priority; `aria-allowed-role` is a best-practice rule in axe that fires on widespread, harmless patterns. Merging them means a stylistic nit and a genuinely broken role produce the identical 'high priority, score 0' output, which is misleading guidance.

**Required fix:** Split into two audits (or two severities): `aria-roles` + `aria-deprecated-role` at 'high' (hard errors), `aria-allowed-role` at 'low'/warn (best practice). Include the triggering rule id in the `found` string so the report says which rule fired.

**False-positive risks:**

- `aria-allowed-role` (axe best-practice) fires on common legitimate markup — e.g. `role="button"`/`role="tab"` on `<a href>`, `role="presentation"` on structural wrappers, framework-emitted roles on `<li>` — producing a 'high' priority fail for markup that works fine for agents.
- `unsupportedrole` flags roles that are valid ARIA but not implemented in a given browser engine; sites deliberately shipping forward-looking roles (e.g. `role="suggestion"`, dpub roles) get failed.
- CSS blindness: roles on hidden template/carousel clones are evaluated.
- Binary bundle with no per-rule attribution — the output says 'accessibility violations found' plus a selector, never which of the three rules fired, so the user cannot tell a typo'd role from a best-practice preference.
- CSR SPA → `na`, since roles are applied at runtime.

**Test gaps:**

- No HTML-level test for this audit.
- No fixture separating an invalid role from an allowed-role best-practice violation.
- No fixture with dpub roles or deprecated roles.

**Overlaps with:** `7.12`

## Evidence

### Signal: Accessibility tree consumption by computer-use and agentic-browser agents — grade A (semantic-dom-a11y)

**Mechanism:** Browser-embedded agents perceive the page as a serialized accessibility tree — role plus accessible name plus state plus an opaque element reference — and issue actions against those references rather than against CSS selectors or screen coordinates. An element's presence, role correctness and accessible name in the a11y tree therefore determine whether an agent can see it and act on it at all. Elements that are role-suppressed, unnamed or misrole'd are functionally invisible to this class of agent, however they look on screen.

**Grade: A** — Three major vendors document the same architecture first-party. Anthropic's `read_page` returns "the page's accessibility tree as text with each element tagged with a reference such as [ref_2]". The security guidance tells implementers to build page reads "from what the page renders (the accessibility tree or visible text), not raw DOM source". Playwright MCP and browser-use serialise role, name, state and a reference the same way. Named agents acting on the tree is the grade-A bar. The scope is browser-embedded agents only: Anthropic's desktop computer-use tool is screenshot-only, and OpenAI's computer use "looks at the current UI through a screenshot", so a pixel-driven agent needs none of this.

**Evidence:** Three independent major-vendor harnesses, all first-party. Anthropic's read_page 'Return[s] the page's accessibility tree as text with each element tagged with a reference such as [ref_2]'. The security guidance instructs implementers to 'build page reads from what the page renders (the accessibility tree or visible text), not raw DOM source' [anthropic-browser-use-tool]. Microsoft: 'Uses Playwright's accessibility tree, not pixel-based input' [playwright-mcp-repo], with snapshot mode the default and vision mode reserved for 'pages with poor accessibility markup' [playwright-mcp-snapshots]. Google: chrome-devtools-mcp take_snapshot is 'a text snapshot… based on the a11y tree… along with a unique identifier (uid)' [chrome-devtools-mcp-tool-reference]. The dominant OSS library resolves interactivity from ARIA roles, role/tabindex attributes, ARIA state and the accessibility properties 'focusable, editable, settable' [browser-use-clickable-elements]. The standard research benchmark exposes observation_type='accessibility_tree' [webarena-repo, webarena-paper]. The tree's contents are governed by ratified specs [w3c-wai-aria-1-2, w3c-accname, w3c-html-aam].

**Counter-evidence:** The claim must be scoped to browser-embedded agents, and even there it is contested. Some consumers are pixel-only. Anthropic's desktop computer-use tool is screenshot-only, with no DOM and no a11y access [anthropic-computer-use-tool]. OpenAI's computer-use tool takes base64 PNG screenshots, and 'the model looks at the current UI through a screenshot' with no structured input [openai-computer-use-guide, openai-cua-announcement]. Gemini Computer Use is likewise screenshots plus action history [gemini-computer-use-docs]. And the a11y tree is not even always the better representation. A 2026 study measured Claude Sonnet 4.6 gaining +14.6pp, and GPT-5.1 at high reasoning gaining +17.5pp, when given raw HTML instead of the accessibility tree. Strong models 'exploit layout information in HTML for better action grounding'. The a11y tree only won for lower-capability models [observation-reduction-paper]. So a11y-tree quality is a strong, well-documented determinant for one large and growing class of agent, not a universal precondition.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
