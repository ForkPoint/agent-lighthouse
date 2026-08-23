---
audit: answer-readiness/unique-meta
audit_id: "4.5"
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/unique-meta.ts
slug: unique-meta
review_verdict: fix
severity: high
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# unique-meta (`4.5`)

> meta-tags · source `unique-meta.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

## What it checks

AI crawlers use title and description pairs to distinguish between pages. Duplicate meta across pages causes agents to merge or skip content, meaning some of your pages will be invisible in AI-generated answers. Give each page a unique title and description.

## Code review findings (2026-08-20, 11-agent pass)

The only site-wide audit in the category, and its core dedup logic is dead code. The comment says pages are grouped by canonical URL, but it reads `page.meta?.['canonical']` — canonical is a `<link>`, never a `<meta>`, so `extractMetaTags` never produces that key and the lookup is always undefined. It silently falls back to `page.url` with the query string stripped, which merges legitimately distinct pages. Combined with `page.meta?.['title']` shadowing the real `<title>` and `$('title')` matching inline-SVG titles, this audit can report duplicates that don't exist and miss ones that do.

**Required fix:** 1) Replace `let canon = (page.meta?.['canonical'] || page.url).trim()` with a headLinks lookup: `page.headLinks.find(l => l.rel.trim().toLowerCase() === 'canonical')?.href` — the current expression can never be true, so the documented grouping has never run. 2) Stop stripping the query string unconditionally (`u.search = ''`): on WordPress `?p=123`, on i18n sites `?lang=de`, and on any query-routed CMS this merges distinct pages into one group and silently skips the duplicate check for them. Strip only known tracking params (utm_*, fbclid, gclid). 3) Fix the title source: `page.meta?.['title'] ?? page.$?.('title').text()` prefers `<meta name="title">` over the real `<title>`; many themes emit a CONSTANT site-wide `<meta name="title">` alongside per-page `<title>` elements, producing a fabricated 'Duplicate title + description' failure. Prefer `$('head > title').first().text()` and use meta[title] only as a fallback. 4) `$('title')` with no `head >` scope also matches `<title>` inside inline SVG icons in the body and concatenates them via `.text()` — scope the selector. 5) Return `notApplicable()` instead of `pass()` when fewer than 2 distinct pages were scanned; the current vacuous `pass` scores 1.0 and inflates the category for every single-page scan. 6) Normalize whitespace and case before comparing, and add near-duplicate detection (identical description with only the title differing is still a dedup risk).

**False-positive risks:**
- Dead canonical grouping: `page.meta?.['canonical']` is never populated — `parser.ts extractMetaTags` only reads `<meta>` name/property/http-equiv, and canonical is a `<link>`. The entire documented dedup-by-canonical behavior has never executed; every scan silently uses the URL fallback.
- Fabricated duplicates from meta[title] precedence: `(page.meta?.['title'] ?? page.$?.('title').text() ?? '').trim()` — a theme that emits one site-wide `<meta name="title" content="Acme Inc">` on every page while `<title>` varies correctly produces a hard 'Duplicate title + description' fail with priority 'high' on a site that has no duplicates at all.
- Inline SVG contamination: `$('title')` (unscoped) matches `<title>` elements inside inline SVG icons in the body; `.text()` concatenates them all, so the compared 'title' is head title + every icon label. Two pages with identical icon sets and different head titles can still differ, but pages using different icon sets with identical head titles will be wrongly judged unique — the comparison key is not the title.
- Query-stripping merges distinct pages: `u.search = ''` collapses `?p=1` and `?p=2` (WordPress), `?lang=de` and `?lang=fr` (i18n), `?id=` catalog pages into a single group, and `if (!canonicalGroups.has(canon)) canonicalGroups.set(canon, page)` keeps only the first — the duplicate check is silently skipped for all of them (false negative), and a genuinely templated i18n site is never flagged.
- Vacuous pass: `if (uniquePages.length < 2) return this.pass('Only one distinct canonical page scanned; uniqueness check not applicable.', …)` returns score 1.0 while literally saying 'not applicable'. `notApplicable()` exists in the base class and is designed for exactly this. Every single-page scan gets a free point.
- Legitimate duplicates: paginated archives (/blog/page/2), faceted listings, and A/B-tested variants often legitimately share a title+description; a hard fail with priority 'high' is over-strong.
- Small-sample bias: only crawled pages are compared, so a 10,000-page catalog with universally duplicated meta passes if the 5 crawled pages happen to differ.
- No whitespace/case normalization: `Home | Acme` vs `Home  |  Acme` are treated as unique, missing a real duplicate.

**Test gaps:**
- No test with a `<link rel="canonical">` present — meaning the audit's headline feature (canonical grouping) is completely untested, which is why the dead `meta['canonical']` lookup survived.
- No test where a site-wide constant `<meta name="title">` coexists with distinct `<title>` elements — the fabricated-duplicate scenario.
- No inline-SVG-`<title>`-in-body test.
- No query-string variant test (`?p=1` vs `?p=2`).
- No whitespace/case-variant titles.
- No paginated-archive / legitimate-duplicate scenario.
- No >2 page scenario, and no partial-duplicate (2 of 5 pages) scenario.

**Overlaps with:** `4.1`, `4.3`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Graded evidence (2026-08-21)

**Mechanism claim:** A crawler or answer engine keys pages on their `<title>` + `<meta name="description">` pair, so two pages sharing that pair are merged or one of them is dropped, making the dropped page unreachable in generated answers.

**Grade: C** — Google documents that identical titles/descriptions across pages degrade how those pages are presented, which supports the *convention*; but no vendor documents title+description as a deduplication or merge key, and the "invisible in AI-generated answers" step of the claim has no source.

**Evidence:**
- Google on duplicated descriptions: "Identical or similar descriptions on every page of a site aren't helpful when individual pages appear in search results." — https://developers.google.com/search/docs/appearance/snippet (verified 2026-08-21)
- Google on duplicated titles: "It's important to have distinct text that describes the content of the page in the `<title>` element for each page on your site", and boilerplate titles "that vary by only a single piece of information" are called out as bad — https://developers.google.com/search/docs/appearance/title-link (verified 2026-08-21)
- Both signals are real inputs to a named consumer: `description` is on Google's supported-meta-tags list — https://developers.google.com/search/docs/crawling-indexing/special-tags (verified 2026-08-21)

**Counter-evidence:** The documented Google effect is presentational (a less useful snippet, a rewritten title link), not exclusionary — nothing in the cited sources says a duplicate-meta page is merged, skipped, or dropped from the index. Google's own duplicate handling is documented as canonicalization over page *content* and explicit canonical signals, not over meta pairs. No AI vendor documents any retrieval-time dedup keyed on meta tags; OpenAI's crawler documentation mentions no HTML metadata — https://developers.openai.com/api/docs/bots (verified 2026-08-21); Google's AI-features page describes query fan-out and snippet controls with no reference to meta uniqueness — https://developers.google.com/search/docs/appearance/ai-features (verified 2026-08-21). Legitimate duplicates also exist by design (paginated archives, faceted listings), so the current hard fail at priority `high` overstates a C-grade signal.
