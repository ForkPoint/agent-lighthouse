---
audit: content-extraction/aside-element
audit_id: "6.6"
category: content-extraction
source_file: packages/core/src/audits/content-extraction/aside-element.ts
slug: aside-element
review_verdict: delete
severity: medium
evidence_grade: B
disposition: "kept — rewrite required (approved 2026-08-21)"
reviewed: 2026-08-21
---

# aside-element (`6.6`)

> semantic-html · source `aside-element.ts` · review verdict **delete** · evidence grade **B** · disposition: **kept — rewrite required (approved 2026-08-21)**

## What it checks

AI agents use <aside> to distinguish supplementary content (sidebars, callouts, related links) from primary content. Without it, sidebar content may be mixed into the main content extraction, diluting the primary message in AI-generated summaries.

## Code review findings (2026-08-20, 11-agent pass)

Falsy audit with no discriminative power. It passes if a single <aside> exists on any page of the crawl ('const hasAside = pagesWithAside > 0') and otherwise warns; it can never fail. Crucially it cannot detect the failure it describes — sidebar content marked up as <div class="sidebar"> is indistinguishable to this code from a site that genuinely has no supplementary content, and both get the same warn. Meanwhile a site with one decorative <aside> and nine div-based sidebars gets a full 1.0. Passing this audit cannot plausibly change any agent outcome.

**Required fix:** _none — audit is sound as implemented_

**False-positive risks:**
- 'pagesWithAside > 0' — one <aside> anywhere in a 50-page crawl yields a full pass regardless of the other 49 pages.
- Declares applicablePageTypes ['content'] but loops all pages, so the denominator in the pass message ('X/ctx.pages.length') mixes page types.
- Warns on sites that correctly have no supplementary content (landing pages, docs, checkout flows) — unactionable noise, since the only 'fix' is to invent a sidebar.
- Cannot distinguish 'no sidebar' from 'sidebar in a div', which is the entire stated point of the check.

**Test gaps:**
- Two tests only; no fixture with a div-based sidebar (the failure mode the audit claims to catch).
- No multi-page crawl showing that one <aside> on page 1 passes the whole site.
- No test of the applicablePageTypes/loop mismatch.

**Overlaps with:** `6.12`, `6.13`, `6.3`, `6.5`

## Evidence

### Signal: Landmark elements (main, nav, header, footer, article, aside) as extraction boundaries — grade A (semantic-dom-a11y)

**Mechanism:** Wrapping primary content in <main>/<article> and chrome in <nav>/<header>/<footer>/<aside> changes what boilerplate-removal extractors keep and drop: content inside landmark containers matching the extractor's body selectors is retained, and subtrees whose element or ARIA role resolves to navigation/banner/contentinfo/complementary are deleted before the text ever reaches the model. On a page built from undifferentiated divs, the same extractors fall back to class/id string heuristics and text-density guesses, so nav and footer text leaks into the extracted body and body text can be discarded.

**Evidence:** Source-level proof in the two dominant extractors. trafilatura's BODY_XPATH selects on 'self::article or self::div or self::main or self::section' plus @itemprop='articleBody' and @role='article', while OVERALL_DISCARD_XPATH deletes nodes whose @role contains 'nav', plus footer/header markers and @aria-hidden='true' [trafilatura-xpaths]; its documented baseline ladder tries 'article tags' before falling back to 'the raw text of the whole page body' [trafilatura-corefunctions]. Mozilla Readability consults ARIA landmark roles directly: UNLIKELY_ROLES = ['menu','menubar','complementary','navigation','alert','alertdialog','dialog'] triggers subtree removal, and its unlikelyCandidates regex penalises footer|header|menu|sidebar|related|social while okMaybeItsACandidate rescues article|body|content|main [mozilla-readability-source]. HTML-AAM makes the element→role mapping normative: main→main, nav→navigation, header→banner, footer→contentinfo, article→article, aside→complementary [w3c-html-aam], over WAI-ARIA 1.2's ratified landmark role set [w3c-wai-aria-1-2]. Anthropic's own get_page_text is documented to 'return the page's visible text as plain text, prioritizing the main article content' [anthropic-browser-use-tool], and Playwright snapshots list 'roles and landmarks… contentinfo sections' as snapshot contents [playwright-mcp-snapshots].

**Counter-evidence:** Landmarks are one path among several, not a gate. trafilatura also matches bare divs by id/class and falls back to justext/readability; Readability gives no special boost to <main> at all and can extract a landmark-free page perfectly well via text density. So a page with zero landmarks is degraded, not invisible. Adoption is partial — only 40.72% of pages use <main> [web-almanac-2025-accessibility] — which means extractors cannot depend on landmarks and have been tuned to work without them. No AI-search vendor documents landmarks as a requirement, and Google explicitly disclaims special optimizations for AI features [google-ai-features-docs]. Over-nesting also backfires: multiple <main> or a <nav> wrapping real content will actively delete content, so this signal is bidirectional and an audit should penalise misuse as well as absence.
**Consumers:** trafilatura, Mozilla Readability / Firefox Reader Mode, Anthropic get_page_text, Playwright MCP accessibility snapshot, Chrome DevTools MCP take_snapshot, Cloudflare Markdown for Agents · **Recommended tier:** scored

**Sources:** [trafilatura/xpaths.py (BODY_XPATH, OVERALL_DISCARD_XPATH)](https://raw.githubusercontent.com/adbar/trafilatura/master/trafilatura/xpaths.py) · [trafilatura core functions documentation](https://trafilatura.readthedocs.io/en/latest/corefunctions.html) · [mozilla/readability Readability.js source](https://raw.githubusercontent.com/mozilla/readability/main/Readability.js) · [HTML Accessibility API Mappings 1.0](https://www.w3.org/TR/html-aam-1.0/) · [Accessible Rich Internet Applications (WAI-ARIA) 1.2](https://www.w3.org/TR/wai-aria-1.2/) · [Browser use tool (browser_toolset_20260801)](https://platform.claude.com/docs/en/agents-and-tools/tool-use/browser-use-tool) · [Snapshots — Playwright MCP](https://playwright.dev/mcp/snapshots) · [Web Almanac 2025 — Accessibility chapter](https://almanac.httparchive.org/en/2025/accessibility) · [AI features and your website — Google Search Central](https://developers.google.com/search/docs/appearance/ai-features)

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/semantic-html/aside-element.md](../../deletions/semantic-html/aside-element.md). Outcome: **redeemable**, grade B.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
