---
audit: generative-engine/publication-date
audit_id: "10.9"
category: generative-engine
source_file: packages/core/src/audits/generative-engine/publication-date.ts
slug: publication-date
review_verdict: keep
severity: low
evidence_grade: unrated
disposition: "keep"
reviewed: 2026-08-21
---

# publication-date (`10.9`)

> generative-engine · source `publication-date.ts` · review verdict **keep** · evidence grade **unrated** · disposition: **keep**

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
- `findJsonLdDate` accepts `dateModified`/`dateCreated`/`uploadDate` as a *publication* date, so a page with only `dateModified` passes an audit titled 'Publication date visible', blurring the line with 10.10.
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

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
