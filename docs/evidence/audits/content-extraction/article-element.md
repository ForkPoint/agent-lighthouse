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

The v7 runner selects article-purpose pages for this check. A `general` declaration does not establish article purpose. Detection can use Open Graph article metadata or primary article prose without author, date, or Article schema fields. Schema-only evidence remains a hint. Detected matches remain informative; a precise `article` declaration uses the existing audit tier.

RAG systems chunk content by <article> boundaries for vector embedding, treating each article as an independent retrieval unit. Without <article> tags, AI chunking algorithms fall back to arbitrary text splitting, which fragments related content across multiple embeddings and reduces answer quality.

## Evidence

### Signal: Landmark elements (main, nav, header, footer, article, aside) as extraction boundaries — grade A (semantic-dom-a11y)

**Mechanism:** Wrapping primary content in <main> or <article>, and chrome in <nav>, <header>, <footer> or <aside>, changes what boilerplate-removal extractors keep and drop. Content inside landmark containers matching the extractor's body selectors is retained. Subtrees whose element or ARIA role resolves to navigation, banner, contentinfo or complementary are deleted before the text ever reaches the model. On a page built from undifferentiated divs, the same extractors fall back to class/id string heuristics and text-density guesses, so nav and footer text leaks into the extracted body and body text can be discarded.

**Grade: A** — The proof is in the source of the two dominant extractors, not in a claim about them. trafilatura's body selector keeps `article`, `div`, `main` and `section`, and its discard pass deletes navigation, footer and header subtrees outright. Readable, shipping code that acts on the element is documented consumer behaviour, which is the grade-A bar. The grade is about direction, not sufficiency. trafilatura also matches bare divs by id and class, and falls back to justext and readability. Readability gives `<main>` no special boost at all. A landmark-free page is degraded rather than invisible.

**Evidence:** Both dominant extractors act on the landmark, and the behaviour is readable in their source. trafilatura keeps `article`, `div`, `main` and `section` nodes, and nodes marked as the article body by `itemprop` or `role`. It deletes subtrees whose role is navigation, along with footer and header markers and anything hidden from assistive technology [trafilatura-xpaths]. Its documented fallback ladder tries 'article tags' before dropping back to 'the raw text of the whole page body' [trafilatura-corefunctions]. Mozilla Readability consults ARIA landmark roles directly. Its `UNLIKELY_ROLES` list — menu, menubar, complementary, navigation, alert, alertdialog and dialog — triggers subtree removal. Its candidate scoring penalises footer, header, menu, sidebar, related and social, and rescues article, body, content and main [mozilla-readability-source]. HTML-AAM makes the element→role mapping normative: main→main, nav→navigation, header→banner, footer→contentinfo, article→article, aside→complementary [w3c-html-aam], over WAI-ARIA 1.2's ratified landmark role set [w3c-wai-aria-1-2]. Anthropic's own get_page_text is documented to 'return the page's visible text as plain text, prioritizing the main article content' [anthropic-browser-use-tool], and Playwright snapshots list 'roles and landmarks… contentinfo sections' as snapshot contents [playwright-mcp-snapshots].

**Counter-evidence:** Landmarks are one path among several, not a gate. trafilatura also matches bare divs by id and class, and falls back to justext or readability. Readability gives no special boost to <main> at all, and can extract a landmark-free page perfectly well via text density. So a page with zero landmarks is degraded, not invisible. Adoption is partial — only 40.72% of pages use <main> [web-almanac-2025-accessibility] — which means extractors cannot depend on landmarks and have been tuned to work without them. No AI-search vendor documents landmarks as a requirement, and Google explicitly disclaims special optimizations for AI features [google-ai-features-docs]. Over-nesting also backfires: multiple <main> or a <nav> wrapping real content will actively delete content, so this signal is bidirectional and an audit should penalise misuse as well as absence.

## Implementation deviations

- The audit runs on article pages only (`applicablePageTypes: [PageType.Article]`).
