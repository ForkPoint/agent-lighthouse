---
audit: content-extraction/article-element
audit_id: "6.4"
category: content-extraction
source_file: packages/core/src/audits/content-extraction/article-element.ts
slug: article-element
review_verdict: fix
severity: medium
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# article-element (`6.4`)

> semantic-html · source `article-element.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

RAG systems chunk content by <article> boundaries for vector embedding, treating each article as an independent retrieval unit. Without <article> tags, AI chunking algorithms fall back to arbitrary text splitting, which fragments related content across multiple embeddings and reduces answer quality.

## Code review findings (2026-08-20, 11-agent pass)

Declares applicablePageTypes ['content'] but then loops every page in the crawl ('for (const page of ctx.pages) { if (page.$('article').length > 0) …}'), so homepage, product, and category pages are counted in the denominator. A shop with one blog post and nine commerce pages is told '1/10 page(s) use <article> elements' and fails. The impact text ('RAG systems chunk content by <article> boundaries for vector embedding') describes a mechanism that LangChain, LlamaIndex, Firecrawl, and Jina Reader do not implement — they chunk on headings and token windows — so the urgency conveyed is invented.

**Required fix:** Filter the loop to pages whose pageType is in meta.applicablePageTypes before computing the ratio. Guard ctx.pages.length === 0 with notApplicable(). Rewrite the impact copy to the defensible claim (Readability-class extractors score <article> when selecting the content root) instead of the RAG-chunking assertion. Consider requiring the <article> to contain a heading, since a bare <article> wrapper carries no boundary information.

**False-positive risks:**
- applicablePageTypes is only a run-gate (audit-runner.ts:64); the loop still counts non-content pages → systematic false fails on mixed-content sites.
- detectPageType falls back to 'content' for anything not matched as product/category, so About/Contact/Pricing/Legal pages are all classed 'content' and expected to carry <article>.
- Documentation sites, SaaS marketing pages, and single-page apps legitimately have no self-contained article units → fail with no correct remediation.
- The inverse is also unhandled: a page wrapping its nav or its whole body in <article> scores full marks.
- Empty ctx.pages → 'allPass = pagesWithArticle === ctx.pages.length' → 0 === 0 → pass.

**Test gaps:**
- No mixed-page-type crawl proving the applicablePageTypes filter does not apply inside the loop.
- No fixture where <article> wraps non-article content (false pass).
- No empty-ctx.pages test.
- No docs-site/marketing-site fixture where absence of <article> is correct.

**Overlaps with:** `6.3`, `6.5`, `6.6`

## Evidence

### Signal: Landmark elements (main, nav, header, footer, article, aside) as extraction boundaries — grade A (semantic-dom-a11y)

**Mechanism:** Wrapping primary content in <main>/<article> and chrome in <nav>/<header>/<footer>/<aside> changes what boilerplate-removal extractors keep and drop: content inside landmark containers matching the extractor's body selectors is retained, and subtrees whose element or ARIA role resolves to navigation/banner/contentinfo/complementary are deleted before the text ever reaches the model. On a page built from undifferentiated divs, the same extractors fall back to class/id string heuristics and text-density guesses, so nav and footer text leaks into the extracted body and body text can be discarded.

**Grade: A** — The proof is in the source of the two dominant extractors, not in a claim about them. trafilatura's `BODY_XPATH` selects on `self::article or self::div or self::main or self::section` plus `@itemprop='articleBody'` and `@role='article'`, while its `OVERALL_DISCARD_XPATH` deletes nodes whose `@role` contains `nav`, along with footer and header markers. Readable, shipping code that acts on the element is documented consumer behaviour, which is the grade-A bar. The grade is about direction, not sufficiency: trafilatura also matches bare divs by id and class and falls back to justext and readability, and Readability gives `<main>` no special boost at all, so a landmark-free page is degraded rather than invisible.

**Evidence:** Source-level proof in the two dominant extractors. trafilatura's BODY_XPATH selects on 'self::article or self::div or self::main or self::section' plus @itemprop='articleBody' and @role='article', while OVERALL_DISCARD_XPATH deletes nodes whose @role contains 'nav', plus footer/header markers and @aria-hidden='true' [trafilatura-xpaths]; its documented baseline ladder tries 'article tags' before falling back to 'the raw text of the whole page body' [trafilatura-corefunctions]. Mozilla Readability consults ARIA landmark roles directly: UNLIKELY_ROLES = ['menu','menubar','complementary','navigation','alert','alertdialog','dialog'] triggers subtree removal, and its unlikelyCandidates regex penalises footer|header|menu|sidebar|related|social while okMaybeItsACandidate rescues article|body|content|main [mozilla-readability-source]. HTML-AAM makes the element→role mapping normative: main→main, nav→navigation, header→banner, footer→contentinfo, article→article, aside→complementary [w3c-html-aam], over WAI-ARIA 1.2's ratified landmark role set [w3c-wai-aria-1-2]. Anthropic's own get_page_text is documented to 'return the page's visible text as plain text, prioritizing the main article content' [anthropic-browser-use-tool], and Playwright snapshots list 'roles and landmarks… contentinfo sections' as snapshot contents [playwright-mcp-snapshots].

**Counter-evidence:** Landmarks are one path among several, not a gate. trafilatura also matches bare divs by id/class and falls back to justext/readability; Readability gives no special boost to <main> at all and can extract a landmark-free page perfectly well via text density. So a page with zero landmarks is degraded, not invisible. Adoption is partial — only 40.72% of pages use <main> [web-almanac-2025-accessibility] — which means extractors cannot depend on landmarks and have been tuned to work without them. No AI-search vendor documents landmarks as a requirement, and Google explicitly disclaims special optimizations for AI features [google-ai-features-docs]. Over-nesting also backfires: multiple <main> or a <nav> wrapping real content will actively delete content, so this signal is bidirectional and an audit should penalise misuse as well as absence.
**Consumers:** trafilatura, Mozilla Readability / Firefox Reader Mode, Anthropic get_page_text, Playwright MCP accessibility snapshot, Chrome DevTools MCP take_snapshot, Cloudflare Markdown for Agents · **Recommended tier:** scored

**Sources:** [trafilatura/xpaths.py (BODY_XPATH, OVERALL_DISCARD_XPATH)](https://raw.githubusercontent.com/adbar/trafilatura/master/trafilatura/xpaths.py) (verified 2026-08-20) · [trafilatura core functions documentation](https://trafilatura.readthedocs.io/en/latest/corefunctions.html) (verified 2026-08-20) · [mozilla/readability Readability.js source](https://raw.githubusercontent.com/mozilla/readability/main/Readability.js) (verified 2026-08-20) · [HTML Accessibility API Mappings 1.0](https://www.w3.org/TR/html-aam-1.0/) (verified 2026-08-20) · [Accessible Rich Internet Applications (WAI-ARIA) 1.2](https://www.w3.org/TR/wai-aria-1.2/) (verified 2026-08-20) · [Browser use tool (browser_toolset_20260801)](https://platform.claude.com/docs/en/agents-and-tools/tool-use/browser-use-tool) (verified 2026-08-20) · [Snapshots — Playwright MCP](https://playwright.dev/mcp/snapshots) (verified 2026-08-20) · [Web Almanac 2025 — Accessibility chapter](https://almanac.httparchive.org/en/2025/accessibility) (verified 2026-08-20) · [AI features and your website — Google Search Central](https://developers.google.com/search/docs/appearance/ai-features) (verified 2026-08-20)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
