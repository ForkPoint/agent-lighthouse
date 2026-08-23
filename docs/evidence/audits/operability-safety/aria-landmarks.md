---
audit: operability-safety/aria-landmarks
audit_id: "7.2"
category: operability-safety
source_file: packages/core/src/audits/operability-safety/aria-landmarks.ts
slug: aria-landmarks
review_verdict: fix
severity: high
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# aria-landmarks (`7.2`)

> operability-safety · source `aria-landmarks.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Claude computer use and browser agents rely on ARIA landmarks to identify page regions (navigation, main content, footer). Missing landmarks force agents to guess page structure from raw HTML, leading to misclicked elements and incorrect content extraction.

## Code review findings (2026-08-20, 11-agent pass)

Requires all four of banner/header, main, navigation, contentinfo/footer on the homepage. The underlying signal (region identification via landmarks) is genuinely useful to browser agents, but the implementation is a bare tag-presence count that both over- and under-reports, evaluates only `ctx.pages[0]`, and the `<footer>`/`<header>` checks do not model landmark scoping — so it is wrong on a large class of real sites while being scored at 'high' priority.

**Required fix:** Scope the header/footer checks to top-level elements (`body > header`, `header:not(article header, section header, aside header, nav header, main header)` and the same for footer). Evaluate every scanned page and report per-page, or state explicitly that the result is homepage-only. Return `na` (not `fail`) when the fetched body has no meaningful content (SPA shell: e.g. <500 chars of text and a single root div) or when `ctx.wafProtection?.isBlocked`. Weight `main` far above `footer` instead of a raw count cliff. Remove the duplicate `<nav>` requirement here since 7.3 already reports it.

**False-positive risks:**
- Landmark scoping ignored: `$('header').length > 0` counts a `<header>` nested inside `<article>`/`<section>`, which is NOT a banner landmark. A blog index whose only `<header>` elements are per-post card headers passes 'banner' falsely; the same bug applies to `<footer>` inside `<article>` (not contentinfo).
- Inverse: a site that puts its masthead in `<div class="header">` with no role fails 'banner' even though agents locate it fine from `<nav>`+`<h1>`; missing `<footer>` alone is common on landing pages and single-purpose pages and is reported at 'high' priority.
- Only `ctx.pages[0]` is inspected (`const $ = ctx.pages[0].$;`), yet the verdict is presented as a site-wide fact. A homepage built from a hero-only template fails the whole site.
- CSR SPA: the fetched shell has no landmarks at all → 'fail' with 2+ missing, on sites that render all four landmarks after hydration. Guaranteed false fail for React/Vue/Angular CSR apps.
- WAF/CDN interstitial (Cloudflare 'Just a moment…' at HTTP 200) → all four missing → hard fail.
- `$('[role="main"]')` is an exact attribute-value match: `role="doc-main main"` or any token-list role value is missed (rare but legal).
- The `missing.length <= 1 ? warn : fail` cliff is arbitrary — missing `main` alone (the most consequential landmark) is only a warn, while missing `header`+`footer` (cosmetic) is a hard fail.

**Test gaps:**
- No fixture with `<header>`/`<footer>` nested inside `<article>`/`<section>` (the scoping bug).
- No SPA-shell fixture.
- No multi-page fixture demonstrating that only page[0] is inspected.
- No fixture with `role` token lists.
- No fixture asserting the severity ordering is sensible (missing `main` vs missing `footer`).

**Overlaps with:** `7.3`, `7.4`

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
