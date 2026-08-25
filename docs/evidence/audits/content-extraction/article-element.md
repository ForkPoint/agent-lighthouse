---
audit: content-extraction/article-element
category: content-extraction
source_file: packages/core/src/audits/content-extraction/article-element.ts
slug: article-element
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: scored
consumers:
  - trafilatura
  - Mozilla Readability / Firefox Reader Mode
  - Anthropic get_page_text
  - Playwright MCP accessibility snapshot
  - Chrome DevTools MCP take_snapshot
  - Cloudflare Markdown for Agents
signals:
  - name: "Landmark elements (main, nav, header, footer, article, aside) as extraction boundaries"
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
  - mozilla-readability-source
  - google-ai-features-docs
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

**Mechanism:** Wrapping primary content in <main> or <article>, and chrome in <nav>, <header>, <footer> or <aside>, changes what boilerplate-removal extractors keep and drop. Content inside landmark containers matching the extractor's body selectors is retained. Subtrees whose element or ARIA role resolves to navigation, banner, contentinfo or complementary are deleted before the text ever reaches the model. On a page built from undifferentiated divs, the same extractors fall back to class/id string heuristics and text-density guesses, so nav and footer text leaks into the extracted body and body text can be discarded.

**Grade: A** — The proof is in the source of the two dominant extractors, not in a claim about them. trafilatura's `BODY_XPATH` selects on `self::article or self::div or self::main or self::section`, plus `@itemprop='articleBody'` and `@role='article'`. Its `OVERALL_DISCARD_XPATH` deletes nodes whose `@role` contains `nav`, along with footer and header markers. Readable, shipping code that acts on the element is documented consumer behaviour, which is the grade-A bar. The grade is about direction, not sufficiency. trafilatura also matches bare divs by id and class, and falls back to justext and readability. Readability gives `<main>` no special boost at all. A landmark-free page is degraded rather than invisible.

**Evidence:** Source-level proof in the two dominant extractors. trafilatura's BODY_XPATH selects on 'self::article or self::div or self::main or self::section', plus @itemprop='articleBody' and @role='article'. Its OVERALL_DISCARD_XPATH deletes nodes whose @role contains 'nav', along with footer and header markers and @aria-hidden='true' [trafilatura-xpaths]. Its documented baseline ladder tries 'article tags' before falling back to 'the raw text of the whole page body' [trafilatura-corefunctions]. Mozilla Readability consults ARIA landmark roles directly: UNLIKELY_ROLES = ['menu','menubar','complementary','navigation','alert','alertdialog','dialog'] triggers subtree removal, and its unlikelyCandidates regex penalises footer|header|menu|sidebar|related|social while okMaybeItsACandidate rescues article|body|content|main [mozilla-readability-source]. HTML-AAM makes the element→role mapping normative: main→main, nav→navigation, header→banner, footer→contentinfo, article→article, aside→complementary [w3c-html-aam], over WAI-ARIA 1.2's ratified landmark role set [w3c-wai-aria-1-2]. Anthropic's own get_page_text is documented to 'return the page's visible text as plain text, prioritizing the main article content' [anthropic-browser-use-tool], and Playwright snapshots list 'roles and landmarks… contentinfo sections' as snapshot contents [playwright-mcp-snapshots].

**Counter-evidence:** Landmarks are one path among several, not a gate. trafilatura also matches bare divs by id and class, and falls back to justext or readability. Readability gives no special boost to <main> at all, and can extract a landmark-free page perfectly well via text density. So a page with zero landmarks is degraded, not invisible. Adoption is partial — only 40.72% of pages use <main> [web-almanac-2025-accessibility] — which means extractors cannot depend on landmarks and have been tuned to work without them. No AI-search vendor documents landmarks as a requirement, and Google explicitly disclaims special optimizations for AI features [google-ai-features-docs]. Over-nesting also backfires: multiple <main> or a <nav> wrapping real content will actively delete content, so this signal is bidirectional and an audit should penalise misuse as well as absence.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
