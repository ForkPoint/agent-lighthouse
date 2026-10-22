---
audit: answer-readiness/unique-data
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/unique-data.ts
slug: unique-data
evidence_grade: C
disposition: "kept — informative observation 2026-10-21"
reviewed: 2026-10-21
sources:
  - geo-paper-arxiv
  - geo-paper
  - geo-critical-survey-arxiv
  - google-helpful-content
---

# Statistics in research context

> Evidence grade C · informative · weight 0. The audit ID remains unchanged.

## What it checks

Reports numeric figures in visible paragraphs with an English research or measurement cue: survey, study, research, benchmark, respondents, participants, sampled or measured. Prices are removed before matching. Percentages, grouped thousands and selected population/measurement units can then count. Site-level navigation, header and footer regions, asides and their equivalent ARIA landmarks do not contribute. An observed contextual figure yields an informative pass; absence returns NA.

## Why it matters

These observations can help a human inspect supporting material. They do not establish a site-wide obligation or predict AI citation quality.

## Evidence

**Grade C for the implemented detector.** The [GEO paper](https://arxiv.org/html/2311.09735v3) studied adding relevant statistics and credible citations in a fixed experimental context (verified 2026-10-21). It did not validate arbitrary link or number counts as a site-quality measure. The old grade B described the study intervention; the current detector does not reproduce that intervention. The previous numeric threshold therefore cannot govern scoring.

## Limits

This lexical heuristic does not prove originality, truth, sampling quality or causal relevance. Figures followed by offer words such as "satisfaction", "guaranteed", "off" or "cotton" are dropped, so "100% satisfaction guaranteed, backed by research" does not match. Other marketing phrasing can still match; a pass reports the lexical observation, not verified research. It misses other languages and statistics outside paragraphs. Currency exclusion covers dollar, euro and pound forms. The check has no minimum figure count, and never asks a site to invent statistics.

## How it scores

This check carries weight 0 and informative display. Pass means an observation exists, not that the site meets a proven quality threshold. No observation returns not applicable. It emits no fail or warning for absent sources or statistics.

## Implementation deviations

- The 2026-10-21 correction changes B/scored to C/informative, removes the broad type list and the unsupported count threshold, and corrects the display title. This is a major contract change.
- Runner tests cover every page type, both provenance modes, empty features, mixed samples and unread pages.
- Paragraphs in site chrome and in asides are ignored. Site chrome is navigation plus a `<header>` or `<footer>` outside article, aside, main, nav and section (or their explicit ARIA roles), which is the HTML-AAM banner and contentinfo scope. A header or footer inside an article is content: post dates, titles and sources often sit there.
- Bare durations such as "24 hours" or "30 seconds" are not counted as figures. Support copy like "our research team replies within 24 hours" would otherwise read as a statistic.
- Text is read through the shared `readerText` helper: hidden descendants of a visible element (`hidden`, inline `display:none` or `visibility:hidden`, `aria-hidden`) are pruned before matching.

## Deferred

- Scoring requires evidence that validates the implemented feature detector, its population and any threshold. The historical study alone does not supply that proof.

## Historical evidence (2026-08-21)

**Mechanism claim:** Adding quantitative statistics to a page's body raises that page's visibility in generative-engine answers — position-adjusted word count and subjective impression — relative to the same page carrying only qualitative claims.

**Grade: B** — a controlled study measures a double-digit gain for exactly this edit on both a synthetic benchmark and a live engine, but no engine documents the behaviour and the effect is query-conditional.

**Evidence:**

- GEO study, "Statistics Addition" — GEO-BENCH: Position-Adjusted Word Count 25.9 vs a 19.5 baseline (+32.8%), Subjective Impression 23.7 vs 19.3 (+22.8%). On live Perplexity.ai: Subjective Impression 33.9 vs 24.7 (+37.2%) — the largest Subjective Impression gain of any method tested there — and PAWC 26.2 vs 24.1 (+8.7%). The paper concludes that "adding relevant statistics wherever possible ensures increased source visibility" and finds the method strongest in domains such as Law & Government and Opinion — https://arxiv.org/abs/2311.09735 (verified 2026-08-21), results at https://arxiv.org/html/2311.09735v3 (verified 2026-08-21)
- The 2026 critical survey independently places quantitative content in its supported tier: "statistics, definitions, comparisons, prices, dates, and references have a plausible advantage" — https://arxiv.org/html/2607.14035v1 (verified 2026-08-21)
- Google's content guidance asks directly for the originality half of the audit's title: "Does the content provide original information, reporting, research, or analysis?" — https://developers.google.com/search/docs/fundamentals/creating-helpful-content (verified 2026-08-21)

**Counter-evidence:** The survey's integrity warning applies squarely to a presence-counting check: "adding a fabricated statistic may increase reuse while degrading epistemic quality", and it finds the gains conditional on "time-sensitive or commercial queries" while lacking universal applicability (https://arxiv.org/html/2607.14035v1, verified 2026-08-21). The GEO measurements are taken inside a fixed retrieval context and share an add-content confound across all three winning methods, so length is not separated from the statistic itself. Critically, nothing in the evidence supports the _unique/original_ framing the audit's title and guidance promise — no source distinguishes primary research from a re-quoted third-party figure, and none supports counting product prices or comma-grouped numbers as statistics.
