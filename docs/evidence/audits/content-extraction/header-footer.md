---
audit: content-extraction/header-footer
category: content-extraction
source_file: packages/core/src/audits/content-extraction/header-footer.ts
slug: header-footer
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

# header-footer (`6.5`)

> semantic-html · source `header-footer.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

AI agents use <header> and <footer> landmarks to identify and exclude boilerplate content (navigation, copyright, links) from primary content extraction. Without these landmarks, agents may include footer disclaimers or nav menus in their content summaries.

## Evidence

### Signal: Landmark elements (main, nav, header, footer, article, aside) as extraction boundaries — grade A (semantic-dom-a11y)

**Mechanism:** Wrapping primary content in <main> or <article>, and chrome in <nav>, <header>, <footer> or <aside>, changes what boilerplate-removal extractors keep and drop. Content inside landmark containers matching the extractor's body selectors is retained. Subtrees whose element or ARIA role resolves to navigation, banner, contentinfo or complementary are deleted before the text ever reaches the model. On a page built from undifferentiated divs, the same extractors fall back to class/id string heuristics and text-density guesses, so nav and footer text leaks into the extracted body and body text can be discarded.

**Grade: A** — The proof is in the source of the two dominant extractors, not in a claim about them. trafilatura's body selector keeps `article`, `div`, `main` and `section`, and its discard pass deletes navigation, footer and header subtrees outright. Readable, shipping code that acts on the element is documented consumer behaviour, which is the grade-A bar. The grade is about direction, not sufficiency: trafilatura also matches bare divs by id and class and falls back to justext and readability, and Readability gives `<main>` no special boost at all, so a landmark-free page is degraded rather than invisible.

**Evidence:** Both dominant extractors act on the landmark, and the behaviour is readable in their source. trafilatura keeps `article`, `div`, `main` and `section` nodes, and nodes marked as the article body by `itemprop` or `role`. It deletes subtrees whose role is navigation, along with footer and header markers and anything hidden from assistive technology [trafilatura-xpaths]. Its documented fallback ladder tries 'article tags' before dropping back to 'the raw text of the whole page body' [trafilatura-corefunctions]. Mozilla Readability consults ARIA landmark roles directly. Its `UNLIKELY_ROLES` list — menu, menubar, complementary, navigation, alert, alertdialog and dialog — triggers subtree removal. Its candidate scoring penalises footer, header, menu, sidebar, related and social, and rescues article, body, content and main [mozilla-readability-source]. HTML-AAM makes the element→role mapping normative: main→main, nav→navigation, header→banner, footer→contentinfo, article→article, aside→complementary [w3c-html-aam], over WAI-ARIA 1.2's ratified landmark role set [w3c-wai-aria-1-2]. Anthropic's own get_page_text is documented to 'return the page's visible text as plain text, prioritizing the main article content' [anthropic-browser-use-tool], and Playwright snapshots list 'roles and landmarks… contentinfo sections' as snapshot contents [playwright-mcp-snapshots].

**Counter-evidence:** Landmarks are one path among several, not a gate. trafilatura also matches bare divs by id and class, and falls back to justext or readability. Readability gives no special boost to <main> at all, and can extract a landmark-free page perfectly well via text density. So a page with zero landmarks is degraded, not invisible. Adoption is partial — only 40.72% of pages use <main> [web-almanac-2025-accessibility] — which means extractors cannot depend on landmarks and have been tuned to work without them. No AI-search vendor documents landmarks as a requirement, and Google explicitly disclaims special optimizations for AI features [google-ai-features-docs]. Over-nesting also backfires: multiple <main> or a <nav> wrapping real content will actively delete content, so this signal is bidirectional and an audit should penalise misuse as well as absence.

## Implementation deviations

- Every sampled page is judged through `judgePages`. There is no first-page exception. Partial coverage warns; no page with both landmarks fails.

## Deferred

- The selectors are literal `<header>` and `<footer>`. Section-scoped elements still count as document landmarks, ARIA equivalents are not read, and hidden markup is not skipped.
- Applicability when a page has no relevant chrome is undefined.
- Fetched HTML does not prove the hydrated browser DOM.

## Limits

### Browser snapshot evidence

Browser agents read the rendered page, not the served HTML. Anthropic's `get_page_text` returns "the page's visible text as plain text, prioritizing the main article content", and Playwright MCP snapshots list headings and landmarks by role (verified 2026-10-20). A supplied browser snapshot is that rendered DOM, so the browser view reuses this audit on it.

The snapshot path runs this audit on each complete, unredacted, non-loading capture that carries readable text. It reads the parsed capture DOM only. It reports the original static verdict as an unscored browser finding with weight 0. It does not prove HTTP delivery, computed appearance, a complete accessibility tree, live form state, or action success. A truncated, redacted or still-loading capture records missing evidence. Existing implementation limits still apply.

The review and limits appear in [Browser-rendered snapshot assessment](../../../architecture/browser-snapshots.md#supported-audit-inventory). The eligibility record lives in `packages/core/src/snapshot-eligibility.ts`. The crawler grade, tier and weight stay unchanged.
