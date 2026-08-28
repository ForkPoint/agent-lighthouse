---
audit: content-extraction/main-element
category: content-extraction
source_file: packages/core/src/audits/content-extraction/main-element.ts
slug: main-element
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

# main-element (`6.3`)

> semantic-html · source `main-element.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

AI scrapers use <main> to identify primary content and discard nav/footer chrome, reducing hallucination risk from boilerplate text. Without <main>, agents must guess which content is primary versus navigational, often ingesting menus and footers into their context window.

## Code review findings (2026-08-20, 11-agent pass)

Checks only the literal tag — 'page.$('main').length > 0' — so <div role="main"> and <div id="main" role="main"> (still emitted by many older themes and by every framework that predates the element) are scored as failures despite being exactly equivalent in the accessibility tree that the audit's own impact text invokes. It also passes vacuously on an empty crawl ('allPass = pagesWithMain === ctx.pages.length' → 0 === 0), and passes a page with three <main> elements even though the guidance demands exactly one.

**Required fix:** Match 'main, [role="main"]' instead of 'main'. Guard ctx.pages.length === 0 with notApplicable(). Add a warn when a page has more than one main/role=main, matching the stated 'exactly one <main> per page' guidance. Include the offending page URLs in `found` — currently the report says '3/10 pages' with no way to know which 7.

**False-positive risks:**
- role="main" on a div is not accepted — a false fail for a semantically correct page.
- Empty ctx.pages → '0 === 0' → pass with '0/0 pages with <main>'. A WAF-blocked crawl reports success.
- CSR SPA shells (<div id="root"></div>) fail although the hydrated DOM has <main>; the fetcher does no JS rendering.
- Multiple <main> elements (invalid HTML, common when a layout and a page template both emit one) score as pass.
- found/message report only counts, never URLs, so the result is not actionable on a multi-page crawl.

**Test gaps:**
- No <div role="main"> fixture.
- No empty-ctx.pages test (the false pass is unguarded and unnoticed).
- No multiple-<main> fixture.
- No SPA-shell fixture.
- Only 1- and 2-page crawls tested; the warn/fail boundary on larger crawls is unexercised.

**Overlaps with:** `6.4`, `6.5`, `6.6`

## Evidence

### Signal: Landmark elements (main, nav, header, footer, article, aside) as extraction boundaries — grade A (semantic-dom-a11y)

**Mechanism:** Wrapping primary content in <main> or <article>, and chrome in <nav>, <header>, <footer> or <aside>, changes what boilerplate-removal extractors keep and drop. Content inside landmark containers matching the extractor's body selectors is retained. Subtrees whose element or ARIA role resolves to navigation, banner, contentinfo or complementary are deleted before the text ever reaches the model. On a page built from undifferentiated divs, the same extractors fall back to class/id string heuristics and text-density guesses, so nav and footer text leaks into the extracted body and body text can be discarded.

**Grade: A** — The proof is in the source of the two dominant extractors, not in a claim about them. trafilatura's body selector keeps `article`, `div`, `main` and `section`, and its discard pass deletes navigation, footer and header subtrees outright. Readable, shipping code that acts on the element is documented consumer behaviour, which is the grade-A bar. The grade is about direction, not sufficiency: trafilatura also matches bare divs by id and class and falls back to justext and readability, and Readability gives `<main>` no special boost at all, so a landmark-free page is degraded rather than invisible.

**Evidence:** Both dominant extractors act on the landmark, and the behaviour is readable in their source. trafilatura keeps `article`, `div`, `main` and `section` nodes, and nodes marked as the article body by `itemprop` or `role`. It deletes subtrees whose role is navigation, along with footer and header markers and anything hidden from assistive technology [trafilatura-xpaths]. Its documented fallback ladder tries 'article tags' before dropping back to 'the raw text of the whole page body' [trafilatura-corefunctions]. Mozilla Readability consults ARIA landmark roles directly. Its `UNLIKELY_ROLES` list — menu, menubar, complementary, navigation, alert, alertdialog and dialog — triggers subtree removal. Its candidate scoring penalises footer, header, menu, sidebar, related and social, and rescues article, body, content and main [mozilla-readability-source]. HTML-AAM makes the element→role mapping normative: main→main, nav→navigation, header→banner, footer→contentinfo, article→article, aside→complementary [w3c-html-aam], over WAI-ARIA 1.2's ratified landmark role set [w3c-wai-aria-1-2]. Anthropic's own get_page_text is documented to 'return the page's visible text as plain text, prioritizing the main article content' [anthropic-browser-use-tool], and Playwright snapshots list 'roles and landmarks… contentinfo sections' as snapshot contents [playwright-mcp-snapshots].

**Counter-evidence:** Landmarks are one path among several, not a gate. trafilatura also matches bare divs by id and class, and falls back to justext or readability; Readability gives no special boost to <main> at all and can extract a landmark-free page perfectly well via text density. So a page with zero landmarks is degraded, not invisible. Adoption is partial — only 40.72% of pages use <main> [web-almanac-2025-accessibility] — which means extractors cannot depend on landmarks and have been tuned to work without them. No AI-search vendor documents landmarks as a requirement, and Google explicitly disclaims special optimizations for AI features [google-ai-features-docs]. Over-nesting also backfires: multiple <main> or a <nav> wrapping real content will actively delete content, so this signal is bidirectional and an audit should penalise misuse as well as absence.

## Implementation deviations

- 2026-08-28 — the audit declines when the scan holds no response it can
  attribute to this site. It read the `<main>` landmark on the scanned pages,
  and `ctx.pages`/`ctx.rootFiles` carry whatever answered 200 — on a parked
  domain a broker's page from another host, on a walled or throttled origin
  nothing at all. It now consults `scanReadTheSite()` and returns
  `notApplicable` carrying the gate's own reason.
  Verdicts that moved on the five nothing-obtained contract states: walled
  pass → na, throttled pass → na, redirected away pass → na, non-HTML homepage
  fail → na, HTTP 200 bot challenge fail → na. Found by
  `packages/core/src/tests/hostile-state-contract.test.ts`.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
