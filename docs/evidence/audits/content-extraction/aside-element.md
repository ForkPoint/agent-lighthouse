---
audit: content-extraction/aside-element
category: content-extraction
source_file: packages/core/src/audits/content-extraction/aside-element.ts
slug: aside-element
evidence_grade: B
disposition: "kept — rewritten to a conditional extraction check 2026-08-22 (Plan 4, Task 11)"
reviewed: 2026-08-22
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

# aside-element (`6.6`)

> content-extraction · source `aside-element.ts` · evidence grade **B** · tier **scored** (weight 0.6) · rewritten from "any page has an `<aside>`" to a conditional per-page extraction check — see below

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

## The conditional-check rewrite (Plan 4, Task 11, 2026-08-22)

The [redemption dossier](../../deletions/semantic-html/aside-element.md) is unusual in this batch: it found the audit's *stated mechanism* "essentially verbatim correct" and put the entire fault in the implementation. So the description and guidance keep their claim and gain its sources; the check underneath is replaced.

**Old pass condition:** `pagesWithAside > 0` — one `<aside>` anywhere in the crawl passed the whole site; anything else warned. The audit could not fail, could not tell "no sidebar" from "sidebar in a `<div>`" (its entire stated purpose), penalised pages that correctly have no supplementary content, and looped every page while declaring `applicablePageTypes: ['content']`.

**New pass condition:** on content pages, every detected supplementary block — sidebar, promo, advert, related-links, newsletter, pull-quote container — is inside an `<aside>` or an element with `role="complementary"`. Pages carrying no supplementary block at all are not evaluated; if no content page has one, the audit is `notApplicable`.

### The check is now conditional, and it can fail

Supplementary blocks are detected two ways and compared:

- **Marked** — top-level `<aside>` and `[role="complementary"]` elements. A nested one belongs to the same block and is not double-counted.
- **Unmarked** — `div`/`section`/`ul`/`nav` containers whose `class`/`id` matches the supplementary-content token set (`sidebar`, `side-nav`, `supplemental`, `complementary`, `secondary`, `related`, `recirc`, `promo`, `callout`, `pullquote`, `newsletter`, `subscribe-box`, `advert`, `ad-slot`, `sponsored`, `widget`) and which are **not** inside a marked landmark. Only the outermost container of a nested stack is reported.

Those tokens are not invented: Readability's own `unlikelyCandidates` regex matches `sidebar|skyscraper|supplemental|related` and its negative class-weight regex penalises `sidebar`, so this is the same string family the extractor falls back to when a page has no landmarks.

The four outcomes replace the old two:

| Outcome | Condition |
| --- | --- |
| `na` | no content page carries a supplementary block |
| `pass` | every detected block is marked |
| `warn` | some marked, some not |
| `fail` | blocks exist and none are marked |

`scoreDisplayMode` moves `binary` → `ternary` for the new middle state. The `fail` branch is precisely the failure mode the audit always claimed to catch and never could: a `<div class="sidebar">` on a page with no `<aside>` anywhere.

### Page-type mismatch closed

`audit()` now filters `ctx.pages` to `pageType === 'content'`, matching the declared `applicablePageTypes`. The v1 denominator ("X/`ctx.pages.length`") mixed page types and let a homepage decide a content-page verdict; a regression test pins that a homepage sidebar no longer drives the result.

### Guidance states the extraction consequence

The redeem note's last requirement was that the guidance say out loud what marking content as supplementary *costs*. It now does, with the source-level evidence behind it: Readability deletes every `<aside>` from extracted article content via `this._clean(articleContent, "aside")`, trafilatura lists `"aside"` first in `MANUALLY_CLEANED`, and Chromium exposes the element as a `complementary` landmark in the accessibility tree that Anthropic's `read_page` returns. The `fix` text therefore ends with the warning the dossier asked for: never put citable facts — author bios, specifications, key figures — inside an `<aside>`, because that subtree never reaches the model.

### Grade decision: stays **B**, tier `scored`, weight 0.6

Source: the [redemption dossier's verdict](../../deletions/semantic-html/aside-element.md) — "redeemed — keep with rewrite (grade B)" — and the [REWORK-TODO entry](../../../../packages/core/src/audits/REWORK-TODO.md). Grade B rests on two independent consumers acting on the element by name (Readability's `_clean(articleContent, "aside")`; trafilatura's `MANUALLY_CLEANED`) plus an empirically verified a11y-tree path (a live Chromium snapshot surfacing both a top-level and a nested `<aside>` as `complementary`). It is B rather than A because no AI vendor documents `<aside>` as a requirement and both extractors also work without landmarks — the signal degrades a page, it does not gate it.

Neither the redeem note nor the REWORK-TODO row asks for a grade or tier change; the required rework is to the check and the guidance. Per the §4 weight law `weightForGrade('B', 'scored') = 0.6`; `defaultPriority` stays `low`.

### Rewrite deviations

- **Detection is class/id-based, so Tailwind-only and CSS-Modules markup is invisible to it.** A hashed or utility-class sidebar produces no candidate and the page simply is not evaluated, which fails safe to `na`/`pass` rather than to a false accusation. Position- and geometry-based detection needs a rendered layout the scanner does not have.
- **`widget` is kept in the token set despite being noisy on WordPress themes.** It is one of the most common real names for a sidebar block, and the cost of a false positive here is a `warn` telling an author to wrap a widget in `<aside>` — which is correct advice even when the container was not what we guessed.
- **Misuse is not penalised.** The evidence dossier for landmark elements notes the signal is bidirectional (wrapping citable content in `<aside>` actively destroys it), but detecting *that* means judging whether the text inside an `<aside>` is citable. It is stated in the guidance instead of scored.

## Evidence

### Signal: Landmark elements (main, nav, header, footer, article, aside) as extraction boundaries — grade A (semantic-dom-a11y)

**Mechanism:** Wrapping primary content in <main>/<article> and chrome in <nav>/<header>/<footer>/<aside> changes what boilerplate-removal extractors keep and drop: content inside landmark containers matching the extractor's body selectors is retained, and subtrees whose element or ARIA role resolves to navigation/banner/contentinfo/complementary are deleted before the text ever reaches the model. On a page built from undifferentiated divs, the same extractors fall back to class/id string heuristics and text-density guesses, so nav and footer text leaks into the extracted body and body text can be discarded.

**Grade: A** — The proof is in the source of the two dominant extractors, not in a claim about them. trafilatura's `BODY_XPATH` selects on `self::article or self::div or self::main or self::section` plus `@itemprop='articleBody'` and `@role='article'`, while its `OVERALL_DISCARD_XPATH` deletes nodes whose `@role` contains `nav`, along with footer and header markers. Readable, shipping code that acts on the element is documented consumer behaviour, which is the grade-A bar. The grade is about direction, not sufficiency: trafilatura also matches bare divs by id and class and falls back to justext and readability, and Readability gives `<main>` no special boost at all, so a landmark-free page is degraded rather than invisible.

**Evidence:** Source-level proof in the two dominant extractors. trafilatura's BODY_XPATH selects on 'self::article or self::div or self::main or self::section', plus @itemprop='articleBody' and @role='article'. Its OVERALL_DISCARD_XPATH deletes nodes whose @role contains 'nav', along with footer and header markers and @aria-hidden='true' [trafilatura-xpaths]. Its documented baseline ladder tries 'article tags' before falling back to 'the raw text of the whole page body' [trafilatura-corefunctions]. Mozilla Readability consults ARIA landmark roles directly: UNLIKELY_ROLES = ['menu','menubar','complementary','navigation','alert','alertdialog','dialog'] triggers subtree removal, and its unlikelyCandidates regex penalises footer|header|menu|sidebar|related|social while okMaybeItsACandidate rescues article|body|content|main [mozilla-readability-source]. HTML-AAM makes the element→role mapping normative: main→main, nav→navigation, header→banner, footer→contentinfo, article→article, aside→complementary [w3c-html-aam], over WAI-ARIA 1.2's ratified landmark role set [w3c-wai-aria-1-2]. Anthropic's own get_page_text is documented to 'return the page's visible text as plain text, prioritizing the main article content' [anthropic-browser-use-tool], and Playwright snapshots list 'roles and landmarks… contentinfo sections' as snapshot contents [playwright-mcp-snapshots].

**Counter-evidence:** Landmarks are one path among several, not a gate. trafilatura also matches bare divs by id/class and falls back to justext/readability; Readability gives no special boost to <main> at all and can extract a landmark-free page perfectly well via text density. So a page with zero landmarks is degraded, not invisible. Adoption is partial — only 40.72% of pages use <main> [web-almanac-2025-accessibility] — which means extractors cannot depend on landmarks and have been tuned to work without them. No AI-search vendor documents landmarks as a requirement, and Google explicitly disclaims special optimizations for AI features [google-ai-features-docs]. Over-nesting also backfires: multiple <main> or a <nav> wrapping real content will actively delete content, so this signal is bidirectional and an audit should penalise misuse as well as absence.

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/semantic-html/aside-element.md](../../deletions/semantic-html/aside-element.md). Outcome: **redeemable**, grade B.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (grade B, rewrite required).
- 2026-08-22 — required rework executed (Plan 4, Task 11): check made conditional on detected supplementary content, `na` when a page legitimately has none, page-type filter aligned with `applicablePageTypes`, `binary` → `ternary`, guidance now states that Readability and trafilatura discard `<aside>` content. Grade B / tier `scored` / weight 0.6 unchanged; `TODO(redeem)` marker removed from the source file.
