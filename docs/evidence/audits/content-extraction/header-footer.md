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

## Code review findings (2026-08-20, 11-agent pass)

Counts any <header> or <footer> anywhere in the document — 'page.$('header').length > 0' — but <header>/<footer> nested inside <article>, <section>, or <aside> are sectioning-content headers, not banner/contentinfo landmarks. A blog post whose cards each use <article><header><h2>…</h2></header></article> is credited with a site banner it does not have, so the audit passes exactly the pages whose chrome an agent cannot identify. The premise it is meant to verify is therefore inverted for a common markup pattern.

**Required fix:** Restrict to landmark scope: 'body > header, body > footer' plus 'header:not(article header, section header, aside header, main header)' and equivalently for footer, or accept [role=banner]/[role=contentinfo]. Guard ctx.pages.length === 0 with notApplicable(). Report which pages are missing which landmark rather than only aggregate counts.

**False-positive risks:**
- Article-scoped <header>/<footer> are counted as landmarks — false pass on card/list layouts and on any theme using <article><header>.
- [role="banner"] / [role="contentinfo"] on a div are not accepted — false fail on older themes.
- Empty ctx.pages → '0 === 0' → pass.
- CSR SPA shells fail although the hydrated page has both.
- The warn branch's message and found disagree in granularity: message reports header/footer separately while found reports the 'both' count, so a user reading found sees a lower number than the message implies.

**Test gaps:**
- No <article><header> fixture — the inverted-premise false pass is untested.
- No role=banner/role=contentinfo fixture.
- No empty-ctx.pages test.
- No fixture with multiple <footer> elements (article footers plus site footer).

**Overlaps with:** `6.3`, `6.4`, `6.6`

## Evidence

### Signal: Landmark elements (main, nav, header, footer, article, aside) as extraction boundaries — grade A (semantic-dom-a11y)

**Mechanism:** Wrapping primary content in <main>/<article> and chrome in <nav>/<header>/<footer>/<aside> changes what boilerplate-removal extractors keep and drop: content inside landmark containers matching the extractor's body selectors is retained, and subtrees whose element or ARIA role resolves to navigation/banner/contentinfo/complementary are deleted before the text ever reaches the model. On a page built from undifferentiated divs, the same extractors fall back to class/id string heuristics and text-density guesses, so nav and footer text leaks into the extracted body and body text can be discarded.

**Grade: A** — The proof is in the source of the two dominant extractors, not in a claim about them. trafilatura's `BODY_XPATH` selects on `self::article or self::div or self::main or self::section` plus `@itemprop='articleBody'` and `@role='article'`, while its `OVERALL_DISCARD_XPATH` deletes nodes whose `@role` contains `nav`, along with footer and header markers. Readable, shipping code that acts on the element is documented consumer behaviour, which is the grade-A bar. The grade is about direction, not sufficiency: trafilatura also matches bare divs by id and class and falls back to justext and readability, and Readability gives `<main>` no special boost at all, so a landmark-free page is degraded rather than invisible.

**Evidence:** Source-level proof in the two dominant extractors. trafilatura's BODY_XPATH selects on 'self::article or self::div or self::main or self::section', plus @itemprop='articleBody' and @role='article'. Its OVERALL_DISCARD_XPATH deletes nodes whose @role contains 'nav', along with footer and header markers and @aria-hidden='true' [trafilatura-xpaths]. Its documented baseline ladder tries 'article tags' before falling back to 'the raw text of the whole page body' [trafilatura-corefunctions]. Mozilla Readability consults ARIA landmark roles directly: UNLIKELY_ROLES = ['menu','menubar','complementary','navigation','alert','alertdialog','dialog'] triggers subtree removal, and its unlikelyCandidates regex penalises footer|header|menu|sidebar|related|social while okMaybeItsACandidate rescues article|body|content|main [mozilla-readability-source]. HTML-AAM makes the element→role mapping normative: main→main, nav→navigation, header→banner, footer→contentinfo, article→article, aside→complementary [w3c-html-aam], over WAI-ARIA 1.2's ratified landmark role set [w3c-wai-aria-1-2]. Anthropic's own get_page_text is documented to 'return the page's visible text as plain text, prioritizing the main article content' [anthropic-browser-use-tool], and Playwright snapshots list 'roles and landmarks… contentinfo sections' as snapshot contents [playwright-mcp-snapshots].

**Counter-evidence:** Landmarks are one path among several, not a gate. trafilatura also matches bare divs by id/class and falls back to justext/readability; Readability gives no special boost to <main> at all and can extract a landmark-free page perfectly well via text density. So a page with zero landmarks is degraded, not invisible. Adoption is partial — only 40.72% of pages use <main> [web-almanac-2025-accessibility] — which means extractors cannot depend on landmarks and have been tuned to work without them. No AI-search vendor documents landmarks as a requirement, and Google explicitly disclaims special optimizations for AI features [google-ai-features-docs]. Over-nesting also backfires: multiple <main> or a <nav> wrapping real content will actively delete content, so this signal is bidirectional and an audit should penalise misuse as well as absence.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
