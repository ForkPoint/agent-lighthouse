---
audit: answer-readiness/last-updated-indicator
audit_id: "9.10"
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/last-updated-indicator.ts
slug: last-updated-indicator
review_verdict: merge
severity: medium
evidence_grade: B
disposition: "merge (approved 2026-08-21)"
reviewed: 2026-08-21
---

# last-updated-indicator (`9.10`)

> answer-engine · source `last-updated-indicator.ts` · review verdict **merge** · evidence grade **B** · disposition: **merge (approved 2026-08-21)**

## What it checks

AI engines use freshness signals like "Last updated" dates to rank answers. Content without freshness indicators is deprioritized for time-sensitive queries.

## Code review findings (2026-08-20, 11-agent pass)

Requires an 'updated/modified/revised' keyword adjacent to a parseable date on an article page, warning when the keyword appears without a date. The detection is more careful than most here (it demands a real DATE_PATTERN match in a ±window rather than any nearby digits). But it measures the same underlying thing as 9.8 — 'is there a machine-readable date on this content page' — reads the same pages through the same shared helper, and duplicates DATE_PATTERN character-for-character. A site fixes both with one <time> element yet is scored twice for the same omission, and the 'updated' variant produces a full fail on correctly-dated evergreen articles that simply have no revision.

**Required fix:** Merge into 9.8 as a single graded freshness audit scored once: pass when a dateModified / 'last updated' + date is present; partial-pass (0.5) when only a publication date exists; fail when neither. That removes the double penalty, removes the false fail on unrevised evergreen articles, and collapses the duplicated DATE_PATTERN into one definition (which should also be shared with generative-engine/publication-date). If the merge is rejected, at minimum: constrain the <time> keyword scope to the element's immediate text/preceding sibling instead of `.parent().text()`, drop the incidental-prose warn path, and gate the keyword and date patterns on the page `lang`.

**False-positive risks:**
- Double penalty for one defect: an undated article fails both 9.8 and 9.10 with the same fix ('add a <time> element'), costing double weight in the category score for a single omission.
- Full fail on a legitimately correct page: a freshly published, properly dated article that has never been revised has no reason to carry 'Last updated' — yet it fails at medium priority with 'No "last updated" indicator found', which is bad guidance (and encourages fake update stamps).
- Parent-scope keyword matching is loose: `const context = \`${time.parent().text()} ${time.text()} ${time.attr('datetime') ?? ''}\`` — on an article-card grid or a list where a shared parent contains 'Updated' text for a different item, an unrelated <time> passes. Cheerio's `.parent().text()` concatenates all sibling text in that parent.
- 'updated' matches unrelated prose: 'We updated our packaging in March 2025', 'This policy was revised January 2024', a changelog entry, or a cookie-consent line all satisfy keyword+date within the ±window and pass as a page freshness indicator.
- English-only: UPDATED_PATTERN knows only updated/modified/revised, and DATE_PATTERN only English months — 'Zuletzt aktualisiert: 15. Januar 2025' fails on both halves.
- The DATE_PATTERN duplication is a live correctness hazard: the comment says a third copy exists in generative-engine/publication-date.ts, so any fix must be applied in three files or the three freshness audits will disagree about the same page.
- Shares the leaky `isArticleContentPage`, so /privacy-policy (which genuinely does say 'Last updated') and /contact both enter the population.
- The warn path fires on incidental prose: a page saying 'we updated our menu' with no nearby date gets a medium-priority warning to add a date to a sentence that is not a freshness indicator.
- SPA/CSR: client-rendered date lines → false fail.

**Test gaps:**
- No article-card grid where a shared parent puts 'Updated' next to an unrelated <time>.
- No incidental-prose case ('We updated our packaging in March 2025') showing a non-freshness sentence passing.
- No non-English update phrasing ('Zuletzt aktualisiert').
- No evergreen correctly-dated article with no revision (the false fail).
- Nothing asserts the two DATE_PATTERN copies stay in sync.
- No test that a fail here co-occurs with a fail in 9.8 for the same missing element.
- No empty-SPA-shell test.

**Overlaps with:** `9.8`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Graded evidence (2026-08-21)

**Mechanism claim:** A visible "Last updated / Modified / Revised" label placed next to a machine-readable date lets a date extractor resolve the page's *modification* date as distinct from its original publication date, which freshness-sensitive answer surfaces use to judge how current the page is.

**Grade: B** — the extraction half is vendor-documented and matches this audit's detector (Google names "Last updated" as a recommended label and reads `dateModified`; htmldate resolves updated dates), but the claim that distinguishes this audit from `dates-on-content` — that an explicit update *label* outranks a bare publication date in AI answers — has no documented consumer and no measured effect.

**Evidence:**
- Google's byline-date guidance covers precisely this pattern: it asks publishers to show a prominently displayed date with clear labeling such as "Posted", "Published" or "Last updated", *and* to specify "the `datePublished` and/or `dateModified` fields" on a `CreativeWork` subtype, with visible and structured values matching. Google states it "estimates that the web page was updated or published" from these signals and "can expose this information in Search results" — https://developers.google.com/search/docs/appearance/publication-dates (verified 2026-08-21)
- The extraction stack resolves updates as a first-class output: htmldate identifies "original **and updated** publication dates" from `link`/`meta` elements (including Open Graph attributes), `abbr` and `time` elements and page text, and is "used in production on millions of documents" — https://htmldate.readthedocs.io/en/latest/ (verified 2026-08-21); it feeds trafilatura, whose extraction preserves structure and metadata — https://trafilatura.readthedocs.io/en/latest/corefunctions.html (verified 2026-08-21)
- A vendor ties freshness to AI answers explicitly: Bing states freshness signals "directly influence how quickly updates are reflected in search results and AI generated answers", with `lastmod` "a key signal, helping Bing prioritize URLs for recrawling and reindexing" — https://blogs.bing.com/webmaster/July-2025/Keeping-Content-Discoverable-with-Sitemaps-in-AI-Powered-Search (verified 2026-08-21)
- The Search path reaches the AI surface: "To be eligible to be shown as a supporting link in AI Overviews or AI Mode, a page must be indexed and eligible to be shown in Google Search with a snippet" — https://developers.google.com/search/docs/appearance/ai-features (verified 2026-08-21)

**Counter-evidence:** Nothing documents this audit's distinctive claim. No vendor and no study shows that a page labeled "Last updated: <date>" is cited more than the same page showing only a publication date — the label is a display convention Google recommends for its own date estimation, not a demonstrated ranking input. Google's AI-features and AI-optimization pages never mention dates or freshness and state that no special markup is needed (https://developers.google.com/search/docs/appearance/ai-features, https://developers.google.com/search/docs/fundamentals/ai-optimization-guide). Bing's freshness statement concerns sitemap `<lastmod>`, not an on-page label. Google's guidance also ties the date to a real publish/update event and asks that visible and structured values agree, so bumping the label without changing the content is an antipattern this audit cannot detect and would reward. Finally the signal is not independent: this audit shares its detector, its date regex and its entire evidence base with `answer-engine/dates-on-content` (graded A on the extraction claim), and the dossier already carries a merge verdict — scoring both would double-count one signal. All URLs verified 2026-08-21.

**Merged into:** `answer-readiness/dates-on-content` (Plan 4, 2026-08-22) — [merged dossier](../../audits/answer-readiness/dates-on-content.md)
