---
audit: content-extraction/time-element
audit_id: "6.11"
category: content-extraction
source_file: packages/core/src/audits/content-extraction/time-element.ts
slug: time-element
review_verdict: fix
severity: medium
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# time-element (`6.11`)

> semantic-html · source `time-element.ts` · review verdict **fix** · evidence grade **C** · disposition: **keep — fix required**

## What it checks

AI agents use <time datetime> elements to reliably parse dates for freshness scoring and temporal reasoning. Without machine-readable dates, agents must regex-parse human-readable date formats, which frequently fails across locales and ambiguous formats like "01/02/2025".

## Code review findings (2026-08-20, 11-agent pass)

Presence-only and site-wide: 'if (page.$('time[datetime]').length > 0) pagesWithTime++' then pass if any page anywhere has one. One <time datetime> in a footer copyright line makes a 500-post blog with zero article dates pass. Conversely it hard-fails (priority medium) any site that legitimately has no dates — a SaaS pricing site, a restaurant, a portfolio — because detectPageType classifies almost everything as 'content'. It also never validates the attribute, so datetime="last Tuesday" or datetime="15/01/2025" satisfies the check that exists specifically to guarantee unambiguous parsing.

**Required fix:** Validate the attribute against the HTML datetime grammar (at minimum /^\d{4}-\d{2}(-\d{2})?/ plus the duration/time forms) and count only valid ones. Report a per-page ratio over applicablePageTypes pages instead of an any-page boolean. Downgrade the no-dates case to notApplicable() unless the page carries date-bearing signals (Article/BlogPosting JSON-LD, a published/updated meta tag, or a date-shaped string in the main content).

**False-positive risks:**
- 'pagesWithTime > 0' — a single footer <time datetime="2026"> passes the whole crawl while every article is undated.
- No validation of the datetime value: datetime="last Tuesday", datetime="01/02/2025", or datetime="" all pass, defeating the audit's stated purpose of avoiding ambiguous formats.
- Hard fail for legitimately date-free sites; detectPageType's 'content' fallback means the applicablePageTypes gate almost never spares them.
- applicablePageTypes ['content'] gates the run but the loop counts all pages, so the reported denominator mixes types.
- Dates rendered client-side (relative-time web components, dayjs formatting after hydration) are absent from server HTML → fail.
- Does not distinguish publication date from an event date or an opening-hours <time>, though the impact copy is entirely about freshness scoring.

**Test gaps:**
- No invalid-datetime fixture (datetime="last Tuesday", datetime="") — the core validation gap is untested.
- No multi-page fixture showing one footer <time> passes a crawl of undated articles.
- No date-free-site fixture asserting the fail is appropriate.
- No relative-time web component / client-rendered date fixture.

**Overlaps with:** _none_

## Evidence

### Signal: time element with datetime attribute as a machine-readable date — grade C (semantic-dom-a11y)

**Mechanism:** A <time datetime="YYYY-MM-DD"> exposes the publication or modification date in an unambiguous ISO-8601 form, so date-extraction libraries embedded in LLM corpus-building and RAG pipelines resolve the date deterministically instead of pattern-matching ambiguous prose ('03/04/25', 'last Tuesday'). Pages without it force those pipelines onto text heuristics that are locale-ambiguous and frequently wrong.

**Evidence:** Ratified standard with a clear intent: 'The time element represents its contents, along with a machine-readable form of those contents in the datetime attribute' [whatwg-time-element]. There is at least one real consumer chain: htmldate's FAST_PREPEND XPath explicitly includes 'self::time' as a date-extraction target [htmldate-extractors], htmldate is peer-reviewed and reported as running 'in production on millions of documents' [htmldate-joss-paper], and trafilatura — the standard main-text extractor for LLM web corpora — uses it for metadata [trafilatura-corefunctions].

**Counter-evidence:** Substantial, and it caps this at C. (1) HTML-AAM maps <time> to the GENERIC role [w3c-html-aam], meaning the element and its datetime attribute are invisible in the accessibility tree — so Playwright MCP, Chrome DevTools MCP, Anthropic read_page and every other a11y-tree agent never see it. (2) Google's own publication-dates guidance recommends exactly two things, a prominent user-visible date and structured-data datePublished/dateModified, and does NOT mention <time datetime> [google-publication-dates]. (3) The WHATWG spec defines parsing syntaxes but prescribes no user-agent behaviour for consuming the value [whatwg-time-element]. (4) Even htmldate keys on the element as a text container — its constants match @itemprop and date-ish @class/@id, with no XPath on @datetime itself [htmldate-extractors]. (5) HTML→markdown conversion drops the attribute. The A-grade path to a machine-readable date is JSON-LD datePublished, which belongs to the structured-data domain; <time> is a cheap complement, not a scored requirement.
**Consumers:** htmldate, trafilatura (metadata extraction), none-known among agentic browsers or AI search crawlers · **Recommended tier:** informative

**Sources:** [HTML Standard — the time element](https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-time-element) · [htmldate extractors.py (date XPath constants)](https://raw.githubusercontent.com/adbar/htmldate/master/htmldate/extractors.py) · [htmldate: A Python package to extract publication dates from web pages](https://joss.theoj.org/papers/10.21105/joss.02439) · [trafilatura core functions documentation](https://trafilatura.readthedocs.io/en/latest/corefunctions.html) · [HTML Accessibility API Mappings 1.0](https://www.w3.org/TR/html-aam-1.0/) · [Add a Byline Date to Google Search Results](https://developers.google.com/search/docs/appearance/publication-dates)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
