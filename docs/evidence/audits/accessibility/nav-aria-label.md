---
audit: accessibility/nav-aria-label
audit_id: "7.3"
category: accessibility
source_file: packages/core/src/audits/accessibility/nav-aria-label.ts
slug: nav-aria-label
review_verdict: merge
severity: medium
evidence_grade: A
disposition: "proposed: merge (pending triage)"
reviewed: 2026-08-21
---

# nav-aria-label (`7.3`)

> accessibility · source `nav-aria-label.ts` · review verdict **merge** · evidence grade **A** · disposition: **proposed: merge (pending triage)**

## What it checks

AI browser agents use aria-label on <nav> elements to understand navigation purpose before interacting with it. Unlabeled navs force agents to inspect child links to guess whether it is main navigation, breadcrumbs, or a footer menu, slowing down agentic workflows.

## Code review findings (2026-08-20, 11-agent pass)

Requires an aria-label/aria-labelledby on EVERY `<nav>`. That is stricter than the actual accessibility consensus (labels are needed to DISAMBIGUATE when more than one navigation landmark exists) and is exactly the signal 7.4 (`landmark-unique`, ported from axe) already measures correctly by role+accessible-name. A page with a single unlabeled `<nav>` is unambiguous to any agent, yet this audit fails it at ratio <0.5 and warns above. Its no-nav branch also re-reports what 7.2 already reports.

**Required fix:** Merge into 7.4 (A11yLandmarkUniqueAudit), which measures the same thing with axe's role+accessible-name uniqueness logic and covers all landmark types, not just `<nav>`. If a nav-specific signal is retained, only require labels when 2+ nav landmarks exist, resolve `aria-labelledby` ids, and delete the 'no <nav> found' branch (duplicate of 7.2).

**False-positive risks:**
- Fails correct markup: a page with one unlabeled `<nav>` plus two more unlabeled navs (breadcrumb + footer) gets 'fail (0 of 3 labeled)' even though 7.4 would only flag the genuinely ambiguous duplicates; a single-nav page is scored 'fail' at 0/1 labeled.
- Ignores heading-derived names: a `<nav>` whose accessible name comes from a nested `<h2>` referenced through the surrounding structure, or a `<nav role="navigation">` labeled by an adjacent visible heading without `aria-labelledby`, counts as unlabeled.
- Only `ctx.pages[0]` is inspected but the message reads as site-wide.
- Counts navs hidden by CSS (mobile drawer duplicating the desktop nav) — cheerio has no visibility model at all, so a responsive site with a desktop+mobile nav pair is penalised for a nav no agent will ever see twice.
- CSR SPA shell → 'No `<nav>` elements on page' warn on sites that render navigation client-side.
- The `labeled / navs.length >= 0.5` cliff is arbitrary: 1 of 2 labeled = warn, 1 of 3 = fail, though the ambiguity is identical.

**Test gaps:**
- No fixture with a single unlabeled nav (the most common legitimate case).
- No fixture with a CSS-hidden mobile-menu duplicate.
- No fixture with `aria-labelledby` pointing at a non-existent id (a stale reference is currently counted as 'labeled' — the code only checks the attribute is non-empty, never that the id resolves).
- No SPA-shell fixture.
- No multi-page fixture.

**Overlaps with:** `7.4`, `7.2`

## Evidence

### Signal: Landmark elements (main, nav, header, footer, article, aside) as extraction boundaries — grade A (semantic-dom-a11y)

**Mechanism:** Wrapping primary content in <main>/<article> and chrome in <nav>/<header>/<footer>/<aside> changes what boilerplate-removal extractors keep and drop: content inside landmark containers matching the extractor's body selectors is retained, and subtrees whose element or ARIA role resolves to navigation/banner/contentinfo/complementary are deleted before the text ever reaches the model. On a page built from undifferentiated divs, the same extractors fall back to class/id string heuristics and text-density guesses, so nav and footer text leaks into the extracted body and body text can be discarded.

**Evidence:** Source-level proof in the two dominant extractors. trafilatura's BODY_XPATH selects on 'self::article or self::div or self::main or self::section' plus @itemprop='articleBody' and @role='article', while OVERALL_DISCARD_XPATH deletes nodes whose @role contains 'nav', plus footer/header markers and @aria-hidden='true' [trafilatura-xpaths]; its documented baseline ladder tries 'article tags' before falling back to 'the raw text of the whole page body' [trafilatura-corefunctions]. Mozilla Readability consults ARIA landmark roles directly: UNLIKELY_ROLES = ['menu','menubar','complementary','navigation','alert','alertdialog','dialog'] triggers subtree removal, and its unlikelyCandidates regex penalises footer|header|menu|sidebar|related|social while okMaybeItsACandidate rescues article|body|content|main [mozilla-readability-source]. HTML-AAM makes the element→role mapping normative: main→main, nav→navigation, header→banner, footer→contentinfo, article→article, aside→complementary [w3c-html-aam], over WAI-ARIA 1.2's ratified landmark role set [w3c-wai-aria-1-2]. Anthropic's own get_page_text is documented to 'return the page's visible text as plain text, prioritizing the main article content' [anthropic-browser-use-tool], and Playwright snapshots list 'roles and landmarks… contentinfo sections' as snapshot contents [playwright-mcp-snapshots].

**Counter-evidence:** Landmarks are one path among several, not a gate. trafilatura also matches bare divs by id/class and falls back to justext/readability; Readability gives no special boost to <main> at all and can extract a landmark-free page perfectly well via text density. So a page with zero landmarks is degraded, not invisible. Adoption is partial — only 40.72% of pages use <main> [web-almanac-2025-accessibility] — which means extractors cannot depend on landmarks and have been tuned to work without them. No AI-search vendor documents landmarks as a requirement, and Google explicitly disclaims special optimizations for AI features [google-ai-features-docs]. Over-nesting also backfires: multiple <main> or a <nav> wrapping real content will actively delete content, so this signal is bidirectional and an audit should penalise misuse as well as absence.
**Consumers:** trafilatura, Mozilla Readability / Firefox Reader Mode, Anthropic get_page_text, Playwright MCP accessibility snapshot, Chrome DevTools MCP take_snapshot, Cloudflare Markdown for Agents · **Recommended tier:** scored

**Sources:** [trafilatura/xpaths.py (BODY_XPATH, OVERALL_DISCARD_XPATH)](https://raw.githubusercontent.com/adbar/trafilatura/master/trafilatura/xpaths.py) · [trafilatura core functions documentation](https://trafilatura.readthedocs.io/en/latest/corefunctions.html) · [mozilla/readability Readability.js source](https://raw.githubusercontent.com/mozilla/readability/main/Readability.js) · [HTML Accessibility API Mappings 1.0](https://www.w3.org/TR/html-aam-1.0/) · [Accessible Rich Internet Applications (WAI-ARIA) 1.2](https://www.w3.org/TR/wai-aria-1.2/) · [Browser use tool (browser_toolset_20260801)](https://platform.claude.com/docs/en/agents-and-tools/tool-use/browser-use-tool) · [Snapshots — Playwright MCP](https://playwright.dev/mcp/snapshots) · [Web Almanac 2025 — Accessibility chapter](https://almanac.httparchive.org/en/2025/accessibility) · [AI features and your website — Google Search Central](https://developers.google.com/search/docs/appearance/ai-features)

### Signal: Accessibility tree consumption by computer-use and agentic-browser agents — grade A (semantic-dom-a11y)

**Mechanism:** Browser-embedded agents perceive the page as a serialized accessibility tree — role plus accessible name plus state plus an opaque element reference — and issue actions against those references rather than against CSS selectors or screen coordinates. Therefore an element's presence, role correctness and accessible name in the a11y tree determine whether an agent can see it and act on it at all; elements that are role-suppressed, unnamed, or misrole'd are functionally invisible to this class of agent regardless of how they look on screen.

**Evidence:** Three independent major-vendor harnesses, all first-party. Anthropic: read_page 'Return the page's accessibility tree as text with each element tagged with a reference such as [ref_2]', and the security guidance instructs implementers to 'build page reads from what the page renders (the accessibility tree or visible text), not raw DOM source' [anthropic-browser-use-tool]. Microsoft: 'Uses Playwright's accessibility tree, not pixel-based input' [playwright-mcp-repo], with snapshot mode the default and vision mode reserved for 'pages with poor accessibility markup' [playwright-mcp-snapshots]. Google: chrome-devtools-mcp take_snapshot is 'a text snapshot… based on the a11y tree… along with a unique identifier (uid)' [chrome-devtools-mcp-tool-reference]. The dominant OSS library resolves interactivity from ARIA roles, role/tabindex attributes, ARIA state and the accessibility properties 'focusable, editable, settable' [browser-use-clickable-elements]. The standard research benchmark exposes observation_type='accessibility_tree' [webarena-repo, webarena-paper]. The tree's contents are governed by ratified specs [w3c-wai-aria-1-2, w3c-accname, w3c-html-aam].

**Counter-evidence:** The claim must be scoped to browser-embedded agents, and even there it is contested. Pixel-only consumers: Anthropic's DESKTOP computer use tool is screenshot-only with no DOM or a11y access [anthropic-computer-use-tool]; OpenAI's computer use tool takes base64 PNG screenshots and 'the model looks at the current UI through a screenshot' with no structured input [openai-computer-use-guide, openai-cua-announcement]; Gemini Computer Use is likewise screenshots plus action history [gemini-computer-use-docs]. And the a11y tree is not even always the better representation: a 2026 study measured Claude Sonnet 4.6 gaining +14.6pp and GPT-5.1 (high reasoning) +17.5pp when given raw HTML INSTEAD of the accessibility tree, because strong models 'exploit layout information in HTML for better action grounding' — the a11y tree only won for lower-capability models [observation-reduction-paper]. So a11y-tree quality is a strong, well-documented determinant for one large and growing class of agent, not a universal precondition.
**Consumers:** Anthropic browser use tool / Claude in Chrome, Playwright MCP (snapshot mode), Chrome DevTools MCP, browser-use, WebArena / BrowserGym-style benchmarks, Browserless agent MCP · **Recommended tier:** scored

**Sources:** [Browser use tool (browser_toolset_20260801)](https://platform.claude.com/docs/en/agents-and-tools/tool-use/browser-use-tool) · [microsoft/playwright-mcp README](https://github.com/microsoft/playwright-mcp) · [Snapshots — Playwright MCP](https://playwright.dev/mcp/snapshots) · [chrome-devtools-mcp tool reference (take_snapshot)](https://raw.githubusercontent.com/ChromeDevTools/chrome-devtools-mcp/main/docs/tool-reference.md) · [browser-use ClickableElementDetector source](https://raw.githubusercontent.com/browser-use/browser-use/main/browser_use/dom/serializer/clickable_elements.py) · [web-arena-x/webarena repository](https://github.com/web-arena-x/webarena) · [WebArena: A Realistic Web Environment for Building Autonomous Agents](https://arxiv.org/abs/2307.13854) · [Accessible Rich Internet Applications (WAI-ARIA) 1.2](https://www.w3.org/TR/wai-aria-1.2/) · [Accessible Name and Description Computation 1.1](https://www.w3.org/TR/accname/) · [HTML Accessibility API Mappings 1.0](https://www.w3.org/TR/html-aam-1.0/) · [Computer use tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool) · [Computer use — OpenAI API guide](https://developers.openai.com/api/docs/guides/tools-computer-use) · [Computer use — Gemini API](https://ai.google.dev/gemini-api/docs/computer-use) · [Read More, Think More: Revisiting Observation Reduction for Web Agents](https://arxiv.org/abs/2604.01535) · [Computer-Using Agent (CUA)](https://openai.com/index/computer-using-agent/)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
