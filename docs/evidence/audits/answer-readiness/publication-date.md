---
audit: answer-readiness/publication-date
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/publication-date.ts
slug: publication-date
evidence_grade: B
disposition: "keep"
reviewed: 2026-08-21
sources:
  - google-publication-dates
  - ahrefs-freshness-17m
  - seer-recency-study
  - geo-critical-survey-arxiv
  - google-helpful-content
---

# publication-date (`10.9`)

> generative-engine · source `publication-date.ts` · review verdict **keep** · evidence grade **B** · disposition: **keep**

## What it checks

AI engines use visible dates to assess content freshness. Undated content is deprioritized for recency-weighted queries.

## Code review findings (2026-08-20, 11-agent pass)

The best-built audit in this category and a real signal: dates drive recency weighting on every major AI answer surface, and `datePublished`/`<time datetime>` are genuinely machine-consumed. It is the only audit here that uses `notApplicable()` correctly, the only one that gates on page type properly (`isArticleContentPage`), and it guards against XML sitemaps being scored as articles. Remaining issues are minor: English-only month names, no dotted-European date form, an unscoped `<time>` search that a footer copyright can satisfy, and passing the whole site on one dated page.

**Required fix:** Optional hardening rather than defect repair: scope the `<time>` search to `<article>`/`<main>` before falling back to the document; validate the extracted value with `Date.parse` and reject unparseable strings; prefer `datePublished` over `dateModified` and label the source accordingly; report the proportion of content pages carrying a date instead of short-circuiting on the first; add dotted-date and locale month names driven off the page `lang`.

**False-positive risks:**

- DATE_PATTERN's month names are English-only, and the numeric branches cover `YYYY-MM-DD` and `D/M/YY` but not the dotted European form `15.01.2025`. A German article rendering '15. Januar 2025' or '15.01.2025' as plain text matches nothing and FAILS.
- The loop returns on the first content page with a date, so a 10-post blog where a single post is dated reports a clean PASS without disclosing that the others were never assessed.
- `findStructuredDate` accepts `p.$('time[datetime]').first()` from anywhere in the document. A footer copyright `<time datetime="2026">2026</time>` or a `<time>` inside an unrelated events widget satisfies the audit for an undated article. There is no scoping to the article body.
- The `<time>` fallback accepts arbitrary text: `<time>Reading time: 5 min</time>` — a real pattern on Medium-style themes — is returned as a date and PASSES.
- `findJsonLdDate` accepts `dateModified`/`dateCreated`/`uploadDate` as a _publication_ date, so a page with only `dateModified` passes an audit titled 'Publication date visible', blurring the line with 10.10.
- No validity check on the returned value: `"datePublished": "0000-00-00"` or `"TBD"` passes.
- On a client-rendered SPA with no JSON-LD, `getMainContentText` returns near-empty text and the audit FAILs an article whose date renders fine in a browser.

**Test gaps:**

- No test for non-English month names or the dotted European date format.
- No test for a footer `<time>` satisfying the audit on an otherwise undated article — the main false-pass path.
- No test for `<time>Reading time: 5 min</time>`.
- No test for a multi-page blog where only one post is dated.
- No test for a malformed or unparseable date value.
- No test for an SPA shell body.

**Overlaps with:** `10.10`

## Implementation deviations

- 2026-08-26 — the shared text helper this audit reads, `getMainContentText`, changed its selection. Among several `<main>` elements it now returns the one holding the most text rather than the first, it ignores a `<main>` inside a `<template>`, and it falls back to the whole `<body>` only when no `<main>` holds any text. Measured cause (scan evidence gate design, section 2.4): storefronts ship empty or fragmented `<main>` wrappers, and the first one is often a stub. Two consequences for this audit. A page whose real content sits in a later `<main>` is now measured on that content. A page whose every `<main>` is empty is now measured on its body text, page chrome included, where it previously measured as empty.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** A page that exposes a determinable publication date — visible text agreeing with a machine-readable value — is date-attributable to consumers that act on dates. Google displays it as a byline date, and AI assistants cite measurably fresher pages. An undated page cannot be placed on the recency axis at all.

**Grade: B** — Google is a documented consumer of the date fields and two independent large-scale datasets measure a recency skew in AI citations, but the citation evidence is correlational and the platforms disagree with each other.

**Evidence:**

- Google documents reading the date and acting on it: "When Google can determine the byline date of your page or video, it can expose this information in Search results, if this information is considered to be useful to the user". It also requires that "the date (and optional time and timezone) match between the equivalent user-visible and structured values" — precisely the visible-plus-machine-readable pairing this audit checks — https://developers.google.com/search/docs/appearance/publication-dates (verified 2026-08-21)
- Ahrefs analysed 16.975M cited URLs across AI surfaces and organic results. AI-cited pages average 1,064 days since publication, against 1,432 for organic SERP results — about 25.7% fresher. ChatGPT citations are the strongest at 958 days, then Copilot at 1,056, Gemini at 1,118 and Perplexity at 1,166 — https://ahrefs.com/blog/do-ai-assistants-prefer-to-cite-fresh-content (verified 2026-08-21)
- Seer Interactive's ChatGPT bot log-file study over 5,000+ dated URLs: "Nearly 65% of log hits were for content published within the past year", 79% within two years, 89% within three — https://www.seerinteractive.com/insights/study-ai-brand-visibility-and-content-recency (verified 2026-08-21)
- The 2026 critical survey rates recency as moderately supported, with effects for "time-sensitive or commercial queries" — https://arxiv.org/html/2607.14035v1 (verified 2026-08-21)

**Counter-evidence:** The two largest datasets contradict each other on Google AI Overviews. Ahrefs measures AI Overviews citing pages averaging 1,432 days, statistically indistinguishable from the 1,416-day organic baseline. Seer reports that "About 85% of AIO's citations are from 2023–2025", the strongest recency bias it found. Platform-specific recency claims are therefore unsafe. Both datasets are correlational: fresher pages may simply cover fresher topics, and the average AI-cited page is still 2.9 years old, making recency a tilt rather than a gate. The survey calls dates "useful but non-universal signals". Google's guidance also treats date manipulation as an anti-pattern, asking whether site owners are "changing the date of pages to make them seem fresh when the content has not substantially changed?" (https://developers.google.com/search/docs/fundamentals/creating-helpful-content, verified 2026-08-21). The defensible scored property is therefore date _presence and visible/structured agreement_, which is what this audit measures — not recency.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
