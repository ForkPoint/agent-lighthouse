---
audit: content-extraction/time-element
category: content-extraction
source_file: packages/core/src/audits/content-extraction/time-element.ts
slug: time-element
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: informative
consumers:
  - htmldate
  - trafilatura (metadata extraction)
  - none-known among agentic browsers or AI search crawlers
signals:
  - name: time element with datetime attribute as a machine-readable date
    grade: C
    domain: semantic-dom-a11y
sources:
  - whatwg-time-element
  - htmldate-extractors
  - htmldate-joss-paper
  - trafilatura-corefunctions
  - w3c-html-aam
  - google-publication-dates
---

# time-element (`6.11`)

> semantic-html · source `time-element.ts` · review verdict **fix** · evidence grade **C** · disposition: **keep — fix required**

## What it checks

The v7 runner includes `article` and `general` pages in this check's existing page population. This preserves coverage when the old catch-all classification becomes unknown. The audit body still owns its existing feature and artifact guards. This scope change does not establish a new consumer path.

AI agents use <time datetime> elements to reliably parse dates for freshness scoring and temporal reasoning. Without machine-readable dates, agents must regex-parse human-readable date formats, which frequently fails across locales and ambiguous formats like "01/02/2025".

## Evidence

### Signal: time element with datetime attribute as a machine-readable date — grade C (semantic-dom-a11y)

**Mechanism:** A <time datetime="YYYY-MM-DD"> exposes the publication or modification date in an unambiguous ISO-8601 form, so date-extraction libraries embedded in LLM corpus-building and RAG pipelines resolve the date deterministically instead of pattern-matching ambiguous prose ('03/04/25', 'last Tuesday'). Pages without it force those pipelines onto text heuristics that are locale-ambiguous and frequently wrong.

**Evidence:** Ratified standard with a clear intent: 'The time element represents its contents, along with a machine-readable form of those contents in the datetime attribute' [whatwg-time-element]. There is at least one real consumer chain. htmldate's fast-path selector explicitly includes the <time> element as a date-extraction target [htmldate-extractors]. htmldate is peer-reviewed, and reported as running 'in production on millions of documents' [htmldate-joss-paper]. And trafilatura, the standard main-text extractor for LLM web corpora, uses it for metadata [trafilatura-corefunctions].

**Counter-evidence:** Substantial, and it caps this at C. (1) HTML-AAM maps <time> to the GENERIC role [w3c-html-aam], meaning the element and its datetime attribute are invisible in the accessibility tree — so Playwright MCP, Chrome DevTools MCP, Anthropic read_page and every other a11y-tree agent never see it. (2) Google's own publication-dates guidance recommends exactly two things, a prominent user-visible date and structured-data datePublished/dateModified, and does not mention <time datetime> [google-publication-dates]. (3) The WHATWG spec defines parsing syntaxes but prescribes no user-agent behaviour for consuming the value [whatwg-time-element]. (4) Even htmldate keys on the element as a text container — its constants match @itemprop and date-ish @class/@id, with no XPath on @datetime itself [htmldate-extractors]. (5) HTML→markdown conversion drops the attribute. The A-grade path to a machine-readable date is JSON-LD datePublished, which belongs to the structured-data domain; <time> is a cheap complement, not a scored requirement.

## Implementation deviations (v7 P3, 2026-10-07)

The added labels preserve the old general-content population while classification changes. This is not the final feature-gate migration. The evidence grade, tier, weight, and audit ID stay unchanged.
