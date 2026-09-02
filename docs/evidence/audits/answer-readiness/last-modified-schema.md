---
audit: answer-readiness/last-modified-schema
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/last-modified-schema.ts
slug: last-modified-schema
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: scored
consumers:
  - Google Search (documented consumer of datePublished/dateModified structured data)
  - ChatGPT / OAI-SearchBot (empirically strongest recency bias)
  - Perplexity
  - Gemini
  - Copilot
signals:
  - name: Publication and updated dates (datePublished / dateModified) effect on AI citation
    grade: B
    domain: geo-authority
sources:
  - ahrefs-freshness-17m
  - seer-recency-study
  - google-publication-dates
  - google-article-structured-data
  - google-helpful-content
  - geo-critical-survey-arxiv
---

# last-modified-schema (`10.10`)

> generative-engine · source `last-modified-schema.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

## What it checks

AI engines use dateModified in JSON-LD to determine content freshness. Content that shows recent updates is prioritized over stale content.

## Code review findings (2026-08-20, 11-agent pass)

`dateModified` is a real, consumed freshness signal so the audit deserves to exist, but its core rule is wrong: it WARNS when `dateModified` equals `datePublished`, which is the correct and honest markup for an article that has never been revised. The audit therefore tells users that accurate metadata is a problem and implicitly nudges them to falsify revision dates — actively harmful guidance. Combined with the unfiltered page loop, a homepage's `WebPage.dateModified` also passes the audit on behalf of an entire undated blog.

**Required fix:** 1) Stop warning when `dateModified === datePublished`; that is valid markup. Pass when `dateModified` is present and parseable, and warn only when it is absent or older than a justifiable staleness threshold. 2) Compare with `Date.parse`, not string equality. 3) Filter to `p.pageType === 'content'` and either drop `WebPage` from the type list or rank Article/BlogPosting/NewsArticle ahead of it, so the homepage cannot answer for the blog. 4) Aggregate across content pages (n of m) instead of returning on the first hit. 5) Replace the local shallow walker with `flattenJsonLd`. 6) Since 10.9 already accepts `dateModified` as a date signal, make the two explicitly complementary: 10.9 = any date visible, 10.10 = machine-readable revision date specifically.

**False-positive risks:**

- `if (typeof datePublished === 'string' && dateModified.trim() !== datePublished.trim())` → pass, else `warn`. An article published once and never edited SHOULD have equal dates; warning on it pressures the user to fabricate freshness. This is the audit's central logic, not an edge case.
- String inequality, not date comparison. `"2025-01-01"` vs `"2025-01-01T00:00:00Z"` vs `"2025-01-01T00:00:00+00:00"` denote the same instant but compare unequal → false PASS ('dateModified differs from datePublished') on markup carrying no update information at all.
- No recency check despite the guidance claiming freshness ranking: `"dateModified": "2011-04-02"` passes as long as it differs from datePublished, so a decade-stale page scores like one updated yesterday. Future-dated build timestamps also pass without comment.
- `applicablePageTypes: ['content']` does not filter `ctx.pages`, and `WebPage` is in the type list. Nearly every homepage emits `{"@type":"WebPage","dateModified":…}` via Yoast/next-seo, so the audit passes on the homepage and never examines the blog posts that actually lack it — with `pageUrl` reporting the homepage.
- Returns on the first node with `dateModified`, so 1 of 5 content pages having it yields an unqualified PASS.
- The shallow local `findJsonLdByType` misses `mainEntity`/`isPartOf`-nested Article nodes → false FAIL on Yoast/next-seo's most common graph shape. The file reads `p.structuredData ?? p.jsonLd`, so Microdata/RDFa flow in, but the shallow walker then discards most of it.

**Test gaps:**

- No test asserting that an unrevised article with equal dates is acceptable — the tests codify the harmful warn as correct.
- No test for equivalent-but-differently-formatted timestamps.
- No test for a very old `dateModified` (staleness).
- No test where the passing `dateModified` lives on the homepage while content pages have none.
- No test for `mainEntity`-nested Article.
- No test exercising the `structuredData` branch with actual Microdata/RDFa.

**Overlaps with:** `10.9`

## Evidence

### Signal: Publication and updated dates (datePublished / dateModified) effect on AI citation — grade B (geo-authority)

**Mechanism:** Exposing accurate, machine-readable datePublished/dateModified (in structured data and matching visible text) makes a page eligible for the measurable recency preference that AI answer engines exhibit, raising citation probability relative to pages with no discoverable date.

**Grade: B** — The empirical case is the strongest in its domain and the vendor case is absent, which is exactly what grade B describes. Ahrefs analysed 16.975M cited URLs across six surfaces and found AI-cited pages average 1,064 days old against 1,432 for organic results — 25.7% fresher — and Seer Interactive reproduced a recency preference on an independent dataset. No vendor documents reading `datePublished` or `dateModified` for answer selection, so nothing here reaches A. The two largest datasets also disagree about Google AI Overviews: Ahrefs found no freshness advantage there at all, Seer found the strongest one. At least one is wrong, so the audit makes no platform-specific claim.

**Evidence:** This is the best-evidenced signal in the domain on the empirical side, at large scale and across independent datasets. Ahrefs analysed 16.975M cited URLs across six surfaces: AI-cited pages average 1,064 days old vs 1,432 for organic results — 25.7% fresher; ChatGPT is strongest at 958 days. Seer Interactive analysed 5,000+ dated URLs using ChatGPT bot log files: ~65% of hits went to past-year content, 79% to the last two years, 89% to the last three, and only 6% to content older than six years. Google's publication-dates doc confirms Google is a documented consumer of these fields, and requires that 'the date... match between the equivalent user-visible and structured values'. It also notes that 'Google doesn't depend on a single date factor because all factors can be prone to issues' — which is exactly why supplying an unambiguous machine-readable date is the actionable part. The 2026 critical survey rates dates/recency as having moderate replicated support. Scoring the PRESENCE and consistency of a correct date is well-founded.

**Counter-evidence:** The two largest datasets disagree on Google AI Overviews. Ahrefs found AIO cites pages averaging 1,432 days, no fresher than organic, and the weakest recency bias of all platforms. Seer reported that AIO had the strongest bias, at about 85% from 2023–2025. At least one is wrong, so platform-specific recency claims are unsafe. The average AI-cited page is still 2.9 years old, so recency is a tilt, not a gate. Seer's own caveat: Energy and instructional/decking content showed 10–15-year-old pages still drawing AI bot traffic, and the study concludes query intent matters more than mechanical recency optimization. The critical survey finds recency helps time-sensitive queries but 'lacks universality'. Critically, all of this is correlational — fresh pages may simply cover fresher topics. And Google explicitly names date-churn as an anti-pattern: 'Are you changing the date of pages to make them seem fresh when the content has not substantially changed?' Ahrefs' author adds that 'low-quality, irrelevant content that's updated every day will not have a magic positive effect.' The recommendation follows: score date presence, correctness and visible-to-structured agreement, and do not score date recency — recency rewards exactly the manipulation Google penalises.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
