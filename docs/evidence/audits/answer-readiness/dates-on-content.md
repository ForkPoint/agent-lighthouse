---
audit: answer-readiness/dates-on-content
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/dates-on-content.ts
slug: dates-on-content
evidence_grade: A
disposition: "merged 2026-08-22 (Plan 4, Task 6) — absorbs last-updated-indicator (9.10)"
reviewed: 2026-08-22
sources:
  - google-publication-dates
  - google-ai-features-trust
  - htmldate-docs
  - trafilatura-corefunctions
  - bing-sitemaps-ai-search
  - s18
---

# dates-on-content (`9.8`, `9.10`)

> answer-readiness · source `dates-on-content.ts` · merged freshness audit, absorbs last-updated-indicator (9.10) · evidence grade **A** · tier **scored** (weight 1.0)

## What it checks

The v7 runner selects article-purpose pages for this check. A `general` declaration does not establish article purpose. Detection can use Open Graph article metadata or primary article prose without author, date, or Article schema fields. Schema-only evidence remains a hint. Detected matches remain informative; a precise `article` declaration uses the existing audit tier.

One freshness question per article page, scored once: **can a date extractor date this page, and can it tell how current it is?**

| State                                                                                                                                                                                                   | Result                       |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--------------------------- |
| a modification date — JSON-LD `dateModified`, `article:modified_time` / `og:updated_time`, a `<time>` carrying an "updated/modified/revised" label, or that wording beside a parseable date in the text | `pass`                       |
| a publication date only — `<time datetime>`, JSON-LD `datePublished`/`uploadDate`/`dateCreated`, `article:published_time`, a bare `<time>`, or a visible date pattern                                   | `warn` (0.5), priority `low` |
| neither, on any scanned article page                                                                                                                                                                    | `fail`, priority `medium`    |
| no article page scanned                                                                                                                                                                                 | `na`                         |

The update signal wins wherever it is found: every article page is checked for one before the first publication-only date is reported.

## Implementation deviations

- The audit merges the former `last-updated-indicator` audit, whose record is in `docs/evidence/merged/answer-readiness/`. Its B-grade update signal is the upper state of one ternary scale, so the merged audit keeps grade A and weight 1.0.
- Update wording counts only with a parseable date beside it. There is no keyword-only branch.
- A publication date alone warns at priority `low`. An unrevised article is correct as it stands.
- The visible-text fallback reads `getMainContentText`: the largest `<main>`, or the body when no `<main>` holds text.
- The first page with an update signal decides the pass. Otherwise the first publication date decides the warn. There is no per-page coverage.
- `DATE_PATTERN` is duplicated in `publication-date.ts`.

## Deferred

- Read only the immediate sibling of a `<time>` for update wording, not `.parent().text()`.
- Prefer a `<time>` inside `<article>` over the first in source order, and the `Article`/`BlogPosting` JSON-LD node over the first dated node.
- Plausibility-check the numeric date branch.
- Support month names and update wording beyond English, gated on the page `lang`.
- Report per-page coverage instead of the first hit.
- Tighten `isArticleContentPage`, which is shared with three other audits.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** An article page carrying a machine-readable date yields a byline date to Google's date extractor and to the htmldate and trafilatura extraction stack. That date can be a `<time datetime>` element, `datePublished` or `dateModified` in JSON-LD, an `article:published_time` meta tag, or a clearly labeled visible date. A page carrying none of these yields no date at all, so no downstream consumer can attach a publication time to the document.

**Grade: A** — a vendor doc states in so many words that Google reads exactly these signals off the page, and prescribes exactly the markup this audit checks. The same fields are what the open extraction stack that builds RAG and training corpora reads.

**Evidence:**

- Google Search Central documents the consumer behavior directly: "A _byline date_ is the date that Google estimates that the web page was updated or published. When Google can determine the byline date of your page or video, it can expose this information in Search results, if this information is considered to be useful to the user." It then prescribes both halves of what this audit detects. One half is a prominently displayed visible date with clear labeling ("Posted", "Published", "Last updated"). The other is "a subtype of `CreativeWork` (such as `Article`, `BlogPosting`, or `VideoObject`)" specifying "the `datePublished` and/or `dateModified` fields". Google asks that "the date (and optional time and timezone) match between the equivalent user-visible and structured values" — https://developers.google.com/search/docs/appearance/publication-dates (verified 2026-08-21)
- The Search path is the AI-answer path, per Google's own eligibility rule: "To be eligible to be shown as a supporting link in AI Overviews or AI Mode, a page must be indexed and eligible to be shown in Google Search with a snippet" — https://developers.google.com/search/docs/appearance/ai-features (verified 2026-08-21)
- The open extraction stack reads the same fields in the same priority order the audit uses. htmldate identifies "original and updated publication dates" in three passes: "`link` and `meta` elements including Open Graph protocol attributes", then "`abbr` or `time` elements and a series of attributes", then page text. It is "used in production on millions of documents" — https://htmldate.readthedocs.io/en/latest/ (verified 2026-08-21). It sits under trafilatura, whose extraction keeps structure and metadata — https://trafilatura.readthedocs.io/en/latest/corefunctions.html (verified 2026-08-21)
- A second vendor ties freshness to AI answers explicitly: Bing states that freshness signals "directly influence how quickly updates are reflected in search results and AI generated answers" — https://blogs.bing.com/webmaster/July-2025/Keeping-Content-Discoverable-with-Sitemaps-in-AI-Powered-Search (verified 2026-08-21)

**Counter-evidence:** The audit's _stated impact_ — "Undated content is deprioritized in AI answers" — is not documented anywhere. Google's AI-features and AI-optimization pages never mention dates or freshness at all, and both state that no special structured data is required ("There's also no special schema.org structured data that you need to add", https://developers.google.com/search/docs/appearance/ai-features). Bing's freshness statement is about sitemap `<lastmod>`, not on-page dates, so it does not transfer directly. No OpenAI, Anthropic or Perplexity crawler documentation mentions dates; OpenAI's bots page describes OAI-SearchBot, GPTBot and ChatGPT-User purely by purpose (https://developers.openai.com/api/docs/bots). The grade therefore covers the extraction claim above, not a ranking claim. Note also that the audit's visible-text fallback regex matches any date-shaped string in main content — a copyright year, an event date, a comment timestamp — none of which is a byline date. Only the structured branch is what the vendor documentation supports. All URLs verified 2026-08-21.
