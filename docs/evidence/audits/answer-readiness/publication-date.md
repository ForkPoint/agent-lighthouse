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

Whether an article page carries a publication date. The audit reads the scanned article pages in order and passes on the first one that has a date. It fails when none has one.

A date counts from any of these, in order:

- a `<time datetime>` element;
- a JSON-LD `datePublished`, `dateModified`, `uploadDate` or `dateCreated`;
- an `article:published_time`, `article:modified_time` or `og:updated_time` meta tag;
- any `<time>` element;
- a date written in the main content text.

The audit checks presence only. It does not compare a visible date with the structured value, although Google asks for the two to match.

The runner selects article-purpose pages. A `general` declaration does not establish article purpose. Detection can use Open Graph article metadata or primary article prose. Schema-only evidence remains a hint.

## Implementation deviations

- The audit checks date presence only. It does not compare a visible date with the structured value.
- The first article page with any date passes. Structured dates come from `findStructuredDate` in `dates-on-content.ts`.
- The visible-text fallback reads `getMainContentText`: the largest `<main>`, or the body when no `<main>` holds text.
- `DATE_PATTERN` is a copy of the one in `dates-on-content.ts`.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** A page that exposes a determinable publication date is date-attributable to consumers that act on dates. Google displays it as a byline date, and AI assistants cite measurably fresher pages. An undated page cannot be placed on the recency axis at all.

**Grade: B** — Google is a documented consumer of the date fields and two independent large-scale datasets measure a recency skew in AI citations, but the citation evidence is correlational and the platforms disagree with each other.

**Evidence:**

- Google documents reading the date and acting on it: "When Google can determine the byline date of your page or video, it can expose this information in Search results, if this information is considered to be useful to the user". It also asks that "the date (and optional time and timezone) match between the equivalent user-visible and structured values". This audit checks only that a date is present; it does not test that agreement — https://developers.google.com/search/docs/appearance/publication-dates (verified 2026-10-17)
- Ahrefs analysed 16.975M cited URLs across AI surfaces and organic results. AI-cited pages average 1,064 days since publication, against 1,432 for organic SERP results — about 25.7% fresher. ChatGPT citations are the strongest at 958 days, then Copilot at 1,056, Gemini at 1,118 and Perplexity at 1,166 — https://ahrefs.com/blog/do-ai-assistants-prefer-to-cite-fresh-content (verified 2026-08-21)
- Seer Interactive's ChatGPT bot log-file study over 5,000+ dated URLs: "Nearly 65% of log hits were for content published within the past year", 79% within two years, 89% within three — https://www.seerinteractive.com/insights/study-ai-brand-visibility-and-content-recency (verified 2026-08-21)
- The 2026 critical survey rates recency as moderately supported, with effects for "time-sensitive or commercial queries" — https://arxiv.org/html/2607.14035v1 (verified 2026-08-21)

**Counter-evidence:** The two largest datasets contradict each other on Google AI Overviews. Ahrefs measures AI Overviews citing pages averaging 1,432 days, statistically indistinguishable from the 1,416-day organic baseline. Seer reports that "About 85% of AIO's citations are from 2023–2025", the strongest recency bias it found. Platform-specific recency claims are therefore unsafe. Both datasets are correlational: fresher pages may simply cover fresher topics, and the average AI-cited page is still 2.9 years old, making recency a tilt rather than a gate. The survey calls dates "useful but non-universal signals". Google's guidance also treats date manipulation as an anti-pattern, asking whether site owners are "changing the date of pages to make them seem fresh when the content has not substantially changed?" (https://developers.google.com/search/docs/fundamentals/creating-helpful-content, verified 2026-08-21). The defensible scored property is therefore date _presence_, which is what this audit measures — not recency.
