---
audit: content-extraction/time-element
category: content-extraction
source_file: packages/core/src/audits/content-extraction/time-element.ts
slug: time-element
evidence_grade: C
disposition: "kept — feature scope corrected 2026-10-21"
reviewed: 2026-10-21
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

> semantic-html · source `time-element.ts` · review verdict **corrected** · evidence grade **C** · disposition: **kept — feature scope corrected**

## What it checks

Visible `time` elements or full date strings select pages on every page type. ISO dates, numeric day/month/year and month/day/year forms and English full or abbreviated month dates establish intent independently of markup. Site-level navigation, header and footer regions and hidden containers do not contribute. A page passes the presence check with a nonempty `datetime`, or a recognized machine-readable text value when that attribute is absent. Mixed coverage warns; no covered page fails; no relevant pages returns NA.

## Why it matters

The check remains C/informative with weight 0. It reports time markup, not AI freshness scoring. The [HTML Standard](https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-time-element) permits machine-readable text when datetime is absent (verified 2026-10-21).

## Evidence

### Signal: time element with datetime attribute as a machine-readable date — grade C (semantic-dom-a11y)

**Mechanism:** A <time datetime="YYYY-MM-DD"> exposes the publication or modification date in an unambiguous ISO-8601 form, so date-extraction libraries embedded in LLM corpus-building and RAG pipelines resolve the date deterministically instead of pattern-matching ambiguous prose ('03/04/25', 'last Tuesday'). Pages without it force those pipelines onto text heuristics that are locale-ambiguous and frequently wrong.

**Evidence:** Ratified standard with a clear intent: 'The time element represents its contents, along with a machine-readable form of those contents in the datetime attribute' [whatwg-time-element]. There is at least one real consumer chain. htmldate's fast-path selector explicitly includes the <time> element as a date-extraction target [htmldate-extractors]. htmldate is peer-reviewed, and reported as running 'in production on millions of documents' [htmldate-joss-paper]. And trafilatura, the standard main-text extractor for LLM web corpora, uses it for metadata [trafilatura-corefunctions].

**Counter-evidence:** Substantial, and it caps this at C. (1) HTML-AAM maps <time> to the GENERIC role [w3c-html-aam], meaning the element and its datetime attribute are invisible in the accessibility tree — so Playwright MCP, Chrome DevTools MCP, Anthropic read_page and every other a11y-tree agent never see it. (2) Google's own publication-dates guidance recommends exactly two things, a prominent user-visible date and structured-data datePublished/dateModified, and does not mention <time datetime> [google-publication-dates]. (3) The WHATWG spec defines parsing syntaxes but prescribes no user-agent behaviour for consuming the value [whatwg-time-element]. (4) Even htmldate keys on the element as a text container — its constants match @itemprop and date-ish @class/@id, with no XPath on @datetime itself [htmldate-extractors]. (5) HTML→markdown conversion drops the attribute. The A-grade path to a machine-readable date is JSON-LD datePublished, which belongs to the structured-data domain; <time> is a cheap complement, not a scored requirement.

## Limits

Date detection is deliberately limited, not a multilingual date parser. It reads dates in time, paragraph, span, link, list, table-cell, heading, caption, address and blockquote elements, and in a `<div>` with no block children. The verdict counts pages, not every date on a page. Explicit datetime values receive a nonempty-presence check, not full syntax/calendar validation. Text-only time values recognize a limited set of machine forms; additional HTML time syntaxes remain deferred.

## Implementation deviations

- Date detection also recognizes US month/day/year forms and abbreviated English months, including "15 Jan 2025" and "Sept. 3, 2025". The candidate walk stops after it finds qualifying time markup, because the verdict counts pages rather than dates.

- The 2026-10-21 correction replaces broad page-type filtering with independent feature selection. Runner tests cover all five types and both provenance modes. Mixed samples exclude unrelated and unread pages.
- Dates in site chrome do not select a page. Site chrome is navigation plus a `<header>` or `<footer>` outside article, aside, main, nav and section (or their explicit ARIA roles), which is the HTML-AAM banner and contentinfo scope. A header or footer inside an article is content: post dates, titles and sources often sit there.
- Text is read through the shared `readerText` helper: hidden descendants of a visible element (`hidden`, inline `display:none` or `visibility:hidden`, `aria-hidden`) are pruned before matching. Block boundaries become spaces, so a date split across two cells or lines still reads as one date.
- Dates inside `aside` or `role="complementary"` do not select a page: a "Recent posts" widget would otherwise make every page date-bearing.
- An ISO date may run straight into a time (`2024-03-15T10:00Z`); only a digit after the day is refused.
- A hiding marker on `<html>` or `<body>` does not hide the page. Themes serve `<body style="visibility:hidden">` and reveal it on load; Readability removes the hidden body and rebuilds it from its children, so the text still reaches that reader.

## Deferred

- Broader language and layout recognition requires new fixtures. Do not infer missing obligations from page type alone.
