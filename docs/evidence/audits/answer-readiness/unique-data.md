---
audit: answer-readiness/unique-data
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/unique-data.ts
slug: unique-data
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - geo-paper-arxiv
  - geo-paper
  - geo-critical-survey-arxiv
  - google-helpful-content
---

# unique-data (`10.13`)

> generative-engine · source `unique-data.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

## What it checks

The v7 runner includes `article` and `general` pages in this check's existing page population. This preserves coverage when the old catch-all classification becomes unknown. The audit body still owns its existing feature and artifact guards. This scope change does not establish a new consumer path.

AI generative engines prioritize content with original, citable data points over vague claims. Include specific statistics and metrics.

## Implementation deviations

- Figures are matched in the text of the largest `<main>`, or of the body when no `<main>` holds text (`getMainContentText`).
- A currency figure reads `$`, `€` and `£`, leading or trailing, with comma or dot decimals and comma, dot or no-break-space thousands groups. A percentage may use a comma decimal and a space before the sign. A bare comma decimal with no unit counts as nothing.
- The page-type list (`general`, `article`) keeps the old general-content population. It is a holding scope, not the final feature gate.

## Deferred

- Prices still count as figures. An article or general page that lists prices can pass on them. The in-sentence test is not built.
- The threshold is three figures summed across all pages, not per page.
- The audit is not renamed.
- Page chrome is not excluded when the body fallback applies.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** Adding quantitative statistics to a page's body raises that page's visibility in generative-engine answers — position-adjusted word count and subjective impression — relative to the same page carrying only qualitative claims.

**Grade: B** — a controlled study measures a double-digit gain for exactly this edit on both a synthetic benchmark and a live engine, but no engine documents the behaviour and the effect is query-conditional.

**Evidence:**

- GEO study, "Statistics Addition" — GEO-BENCH: Position-Adjusted Word Count 25.9 vs a 19.5 baseline (+32.8%), Subjective Impression 23.7 vs 19.3 (+22.8%). On live Perplexity.ai: Subjective Impression 33.9 vs 24.7 (+37.2%) — the largest Subjective Impression gain of any method tested there — and PAWC 26.2 vs 24.1 (+8.7%). The paper concludes that "adding relevant statistics wherever possible ensures increased source visibility" and finds the method strongest in domains such as Law & Government and Opinion — https://arxiv.org/abs/2311.09735 (verified 2026-08-21), results at https://arxiv.org/html/2311.09735v3 (verified 2026-08-21)
- The 2026 critical survey independently places quantitative content in its supported tier: "statistics, definitions, comparisons, prices, dates, and references have a plausible advantage" — https://arxiv.org/html/2607.14035v1 (verified 2026-08-21)
- Google's content guidance asks directly for the originality half of the audit's title: "Does the content provide original information, reporting, research, or analysis?" — https://developers.google.com/search/docs/fundamentals/creating-helpful-content (verified 2026-08-21)

**Counter-evidence:** The survey's integrity warning applies squarely to a presence-counting check: "adding a fabricated statistic may increase reuse while degrading epistemic quality", and it finds the gains conditional on "time-sensitive or commercial queries" while lacking universal applicability (https://arxiv.org/html/2607.14035v1, verified 2026-08-21). The GEO measurements are taken inside a fixed retrieval context and share an add-content confound across all three winning methods, so length is not separated from the statistic itself. Critically, nothing in the evidence supports the _unique/original_ framing the audit's title and guidance promise — no source distinguishes primary research from a re-quoted third-party figure, and none supports counting product prices or comma-grouped numbers as statistics.
