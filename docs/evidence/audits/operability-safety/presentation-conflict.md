---
audit: operability-safety/presentation-conflict
category: operability-safety
source_file: packages/core/src/audits/operability-safety/presentation-conflict.ts
slug: presentation-conflict
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

# No presentation-role conflicts (`7.23`)

> operability-safety · source `_a11y.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

An element marked role="presentation"/"none" while still focusable or carrying ARIA sends contradictory signals about whether it exists in the accessibility tree.

## Evidence

### Signal: Accessibility tree consumption by computer-use and agentic-browser agents — grade A (semantic-dom-a11y)

**Mechanism:** Browser-embedded agents perceive the page as a serialized accessibility tree — role plus accessible name plus state plus an opaque element reference — and issue actions against those references rather than against CSS selectors or screen coordinates. An element's presence, role correctness and accessible name in the a11y tree therefore determine whether an agent can see it and act on it at all. Elements that are role-suppressed, unnamed or misrole'd are functionally invisible to this class of agent, however they look on screen.

**Grade: A** — Three major vendors document the same architecture first-party. Anthropic's `read_page` returns "the page's accessibility tree as text with each element tagged with a reference such as [ref_2]". The security guidance tells implementers to build page reads "from what the page renders (the accessibility tree or visible text), not raw DOM source". Playwright MCP and browser-use serialise role, name, state and a reference the same way. Named agents acting on the tree is the grade-A bar. The scope is browser-embedded agents only: Anthropic's desktop computer-use tool is screenshot-only, and OpenAI's computer use "looks at the current UI through a screenshot", so a pixel-driven agent needs none of this.

**Evidence:** Three independent major-vendor harnesses, all first-party. Anthropic's read_page 'Return[s] the page's accessibility tree as text with each element tagged with a reference such as [ref_2]'. The security guidance instructs implementers to 'build page reads from what the page renders (the accessibility tree or visible text), not raw DOM source' [anthropic-browser-use-tool]. Microsoft: 'Uses Playwright's accessibility tree, not pixel-based input' [playwright-mcp-repo], with snapshot mode the default and vision mode reserved for 'pages with poor accessibility markup' [playwright-mcp-snapshots]. Google: chrome-devtools-mcp take_snapshot is 'a text snapshot… based on the a11y tree… along with a unique identifier (uid)' [chrome-devtools-mcp-tool-reference]. The dominant OSS library resolves interactivity from ARIA roles, role/tabindex attributes, ARIA state and the accessibility properties 'focusable, editable, settable' [browser-use-clickable-elements]. The standard research benchmark exposes observation_type='accessibility_tree' [webarena-repo, webarena-paper]. The tree's contents are governed by ratified specs [w3c-wai-aria-1-2, w3c-accname, w3c-html-aam].

**Counter-evidence:** The claim must be scoped to browser-embedded agents, and even there it is contested. Pixel-only consumers exist. Anthropic's desktop computer use tool is screenshot-only, with no DOM or a11y access [anthropic-computer-use-tool]. OpenAI's computer use tool takes base64 PNG screenshots — 'the model looks at the current UI through a screenshot' — with no structured input [openai-computer-use-guide, openai-cua-announcement]. Gemini Computer Use is likewise screenshots plus action history [gemini-computer-use-docs]. And the a11y tree is not even always the better representation. A 2026 study measured Claude Sonnet 4.6 gaining +14.6pp, and GPT-5.1 at high reasoning gaining +17.5pp, when given raw HTML instead of the accessibility tree. Strong models 'exploit layout information in HTML for better action grounding'. The a11y tree only won for lower-capability models [observation-reduction-paper]. So a11y-tree quality is a strong, well-documented determinant for one large and growing class of agent, not a universal precondition.

## Limits

### Browser snapshot evidence

Browser agents read the rendered page as an accessibility tree. Anthropic's `read_page` returns "the page's accessibility tree as text", Playwright MCP "uses accessibility snapshots instead of screenshots", and Chrome DevTools MCP `take_snapshot` is "based on the a11y tree" (verified 2026-10-20). A supplied browser snapshot is that rendered DOM, so the browser view reuses this audit on it.

The snapshot path runs this audit on each complete, unredacted, non-loading capture that carries readable text. It runs the same accessibility rule pass over the capture HTML, with page scripts off and no resource loading. If that pass yields no results, the capture records missing evidence instead of a verdict. It reports the original static verdict as an unscored browser finding with weight 0. It does not prove HTTP delivery, computed appearance, a complete accessibility tree, live form state, or action success. A truncated, redacted or still-loading capture records missing evidence. Existing implementation limits still apply.

The review and limits appear in [Browser-rendered snapshot assessment](../../../architecture/browser-snapshots.md#supported-audit-inventory). The eligibility record lives in `packages/core/src/snapshot-eligibility.ts`. The crawler grade, tier and weight stay unchanged.
