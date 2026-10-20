---
audit: operability-safety/landmark-unique
category: operability-safety
source_file: packages/core/src/audits/operability-safety/landmark-unique.ts
slug: landmark-unique
evidence_grade: A
disposition: "merged 2026-08-22 (Plan 4, Task 8) — absorbs nav-aria-label (7.3)"
reviewed: 2026-08-22
recommended_tier: scored
consumers:
  - Anthropic browser use tool / Claude in Chrome
  - Playwright MCP (snapshot mode)
  - Chrome DevTools MCP
  - browser-use
  - WebArena / BrowserGym-style benchmarks
  - Browserless agent MCP
signals:
  - name: "Landmark elements (main, nav, header, footer, article, aside) as extraction boundaries"
    grade: A
    domain: semantic-dom-a11y
  - name: Accessibility tree consumption by computer-use and agentic-browser agents
    grade: A
    domain: semantic-dom-a11y
sources:
  - trafilatura-xpaths
  - trafilatura-corefunctions
  - readability-src
  - w3c-html-aam
  - w3c-wai-aria-1-2
  - anthropic-browser-use-tool
  - playwright-mcp-snapshots
  - web-almanac-2025-accessibility
  - google-ai-features-trust
  - playwright-mcp-repo
  - chrome-devtools-mcp-tool-reference
  - browser-use-clickable-elements
  - webarena-repo
  - webarena-paper
  - w3c-accname
  - anthropic-cu-tool
  - openai-computer-use-guide
  - gemini-computer-use-docs
  - observation-reduction-paper
  - openai-cua-announcement
  - mozilla-readability-source
  - google-ai-features-docs
  - anthropic-computer-use-tool
---

# Landmarks are uniquely identifiable (`7.4`, `7.3`)

> operability-safety · source `landmark-unique.ts` (rule engine, base `_shared.ts`) · merged landmark-labelling audit, absorbs nav-aria-label (7.3) · evidence grade **A** · tier **scored** (weight 1.0)

## What it checks

AI browser agents traverse the accessibility tree and use a landmark's role plus accessible name to target the right region. Two landmarks of the same role — a primary `<nav>` and a footer `<nav>`, two `<aside>`s, two `<main>`s — without distinct accessible names are indistinguishable, so an agent can act on the wrong region. A landmark with no same-role sibling is unambiguous and is not flagged.

Standard `A11yBackedAudit` aggregation over the one rule it wires (`landmark-unique`): any page failing → `fail`; incomplete without a pass → `warn`; any pass → `pass`; nothing applicable → `na`.

## Evidence

### Signal: Landmark elements (main, nav, header, footer, article, aside) as extraction boundaries — grade A (semantic-dom-a11y)

**Mechanism:** Wrapping primary content in <main> or <article>, and chrome in <nav>, <header>, <footer> or <aside>, changes what boilerplate-removal extractors keep and drop. Content inside landmark containers matching the extractor's body selectors is retained. Subtrees whose element or ARIA role resolves to navigation, banner, contentinfo or complementary are deleted before the text ever reaches the model. On a page built from undifferentiated divs, the same extractors fall back to class/id string heuristics and text-density guesses, so nav and footer text leaks into the extracted body and body text can be discarded.

**Grade: A** — The proof is in the source of the two dominant extractors, not in a claim about them. trafilatura's body selector keeps `article`, `div`, `main` and `section`, and its discard pass deletes navigation, footer and header subtrees outright. Readable, shipping code that acts on the element is documented consumer behaviour, which is the grade-A bar. The grade is about direction, not sufficiency: trafilatura also matches bare divs by id and class and falls back to justext and readability, and Readability gives `<main>` no special boost at all, so a landmark-free page is degraded rather than invisible.

**Evidence:** Both dominant extractors act on the landmark, and the behaviour is readable in their source. trafilatura keeps `article`, `div`, `main` and `section` nodes, and nodes marked as the article body by `itemprop` or `role`. It deletes subtrees whose role is navigation, along with footer and header markers and anything hidden from assistive technology [trafilatura-xpaths]. Its documented fallback ladder tries 'article tags' before dropping back to 'the raw text of the whole page body' [trafilatura-corefunctions]. Mozilla Readability consults ARIA landmark roles directly. Its `UNLIKELY_ROLES` list — menu, menubar, complementary, navigation, alert, alertdialog and dialog — triggers subtree removal. Its candidate scoring penalises footer, header, menu, sidebar, related and social, and rescues article, body, content and main [mozilla-readability-source]. HTML-AAM makes the element→role mapping normative: main→main, nav→navigation, header→banner, footer→contentinfo, article→article, aside→complementary [w3c-html-aam], over WAI-ARIA 1.2's ratified landmark role set [w3c-wai-aria-1-2]. Anthropic's own get_page_text is documented to 'return the page's visible text as plain text, prioritizing the main article content' [anthropic-browser-use-tool], and Playwright snapshots list 'roles and landmarks… contentinfo sections' as snapshot contents [playwright-mcp-snapshots].

**Counter-evidence:** Landmarks are one path among several, not a gate. trafilatura also matches bare divs by id/class and falls back to justext/readability; Readability gives no special boost to <main> at all and can extract a landmark-free page perfectly well via text density. So a page with zero landmarks is degraded, not invisible. Adoption is partial — only 40.72% of pages use <main> [web-almanac-2025-accessibility] — which means extractors cannot depend on landmarks and have been tuned to work without them. No AI-search vendor documents landmarks as a requirement, and Google explicitly disclaims special optimizations for AI features [google-ai-features-docs]. Over-nesting also backfires: multiple <main> or a <nav> wrapping real content will actively delete content, so this signal is bidirectional and an audit should penalise misuse as well as absence.

### Signal: Accessibility tree consumption by computer-use and agentic-browser agents — grade A (semantic-dom-a11y)

**Mechanism:** Browser-embedded agents perceive the page as a serialized accessibility tree — role plus accessible name plus state plus an opaque element reference — and issue actions against those references rather than against CSS selectors or screen coordinates. An element's presence, role correctness and accessible name in the a11y tree therefore determine whether an agent can see it and act on it at all. Elements that are role-suppressed, unnamed or misrole'd are functionally invisible to this class of agent, however they look on screen.

**Grade: A** — Three major vendors document the same architecture first-party. Anthropic's `read_page` returns "the page's accessibility tree as text with each element tagged with a reference such as [ref_2]". The security guidance tells implementers to build page reads "from what the page renders (the accessibility tree or visible text), not raw DOM source". Playwright MCP and browser-use serialise role, name, state and a reference the same way. Named agents acting on the tree is the grade-A bar. The scope is browser-embedded agents only: Anthropic's desktop computer-use tool is screenshot-only, and OpenAI's computer use "looks at the current UI through a screenshot", so a pixel-driven agent needs none of this.

**Evidence:** Three independent major-vendor harnesses, all first-party. Anthropic's read_page 'Return[s] the page's accessibility tree as text with each element tagged with a reference such as [ref_2]'. The security guidance instructs implementers to 'build page reads from what the page renders (the accessibility tree or visible text), not raw DOM source' [anthropic-browser-use-tool]. Microsoft: 'Uses Playwright's accessibility tree, not pixel-based input' [playwright-mcp-repo], with snapshot mode the default and vision mode reserved for 'pages with poor accessibility markup' [playwright-mcp-snapshots]. Google: chrome-devtools-mcp take_snapshot is 'a text snapshot… based on the a11y tree… along with a unique identifier (uid)' [chrome-devtools-mcp-tool-reference]. The dominant OSS library resolves interactivity from ARIA roles, role/tabindex attributes, ARIA state and the accessibility properties 'focusable, editable, settable' [browser-use-clickable-elements]. The standard research benchmark exposes observation_type='accessibility_tree' [webarena-repo, webarena-paper]. The tree's contents are governed by ratified specs [w3c-wai-aria-1-2, w3c-accname, w3c-html-aam].

**Counter-evidence:** The claim must be scoped to browser-embedded agents, and even there it is contested. Some consumers are pixel-only. Anthropic's desktop computer-use tool is screenshot-only, with no DOM and no a11y access [anthropic-computer-use-tool]. OpenAI's computer-use tool takes base64 PNG screenshots, and 'the model looks at the current UI through a screenshot' with no structured input [openai-computer-use-guide, openai-cua-announcement]. Gemini Computer Use is likewise screenshots plus action history [gemini-computer-use-docs]. And the a11y tree is not even always the better representation. A 2026 study measured Claude Sonnet 4.6 gaining +14.6pp, and GPT-5.1 at high reasoning gaining +17.5pp, when given raw HTML instead of the accessibility tree. Strong models 'exploit layout information in HTML for better action grounding'. The a11y tree only won for lower-capability models [observation-reduction-paper]. So a11y-tree quality is a strong, well-documented determinant for one large and growing class of agent, not a universal precondition.

## Implementation deviations

- A lone unlabelled landmark is not flagged. A label exists to disambiguate landmarks that share a role.
- The rule covers every landmark type, resolves `aria-labelledby`, and runs on every scanned page.

## Deferred

- `stripStyles()` discards stylesheets before jsdom. The desktop and mobile `<nav>` pair a responsive theme ships still counts as two visible same-role landmarks. The fix is a rule-engine visibility model, or a downgrade to `warn` for that pair.
- Violation counts and stable path-based selectors belong to `A11yBackedAudit`'s reporting shape, shared by every rule-backed audit.

## Limits

### Browser snapshot evidence

Browser agents read the rendered page as an accessibility tree. Anthropic's `read_page` returns "the page's accessibility tree as text", Playwright MCP "uses accessibility snapshots instead of screenshots", and Chrome DevTools MCP `take_snapshot` is "based on the a11y tree" (verified 2026-10-20). A supplied browser snapshot is that rendered DOM, so the browser view reuses this audit on it.

The snapshot path runs this audit on each complete, unredacted, non-loading capture that carries readable text. It runs the same accessibility rule pass over the capture HTML, with page scripts off and no resource loading. If that pass yields no results, the capture records missing evidence instead of a verdict. It reports the original static verdict as an unscored browser finding with weight 0. It does not prove HTTP delivery, computed appearance, a complete accessibility tree, live form state, or action success. A truncated, redacted or still-loading capture records missing evidence. Existing implementation limits still apply.

The review and limits appear in [Browser-rendered snapshot assessment](../../../architecture/browser-snapshots.md#supported-audit-inventory). The eligibility record lives in `packages/core/src/snapshot-eligibility.ts`. The crawler grade, tier and weight stay unchanged.
