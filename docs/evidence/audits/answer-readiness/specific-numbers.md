---
audit: answer-readiness/specific-numbers
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/specific-numbers.ts
slug: specific-numbers
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - geo-paper-arxiv
  - cseo-bench-arxiv
  - google-ai-optimization-mythbusting
---

# specific-numbers (`9.7`)

> answer-engine · source `specific-numbers.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

## What it checks

AI engines prefer answers with concrete data points over vague statements. Include specific numbers, percentages, and metrics in your content.

## Implementation deviations

- 2026-08-26 — the shared text helper this audit reads, `getMainContentText`, changed its selection. Among several `<main>` elements it now returns the one holding the most text rather than the first, it ignores a `<main>` inside a `<template>`, and it falls back to the whole `<body>` only when no `<main>` holds any text. Measured cause (scan evidence gate design, section 2.4): storefronts ship empty or fragmented `<main>` wrappers, and the first one is often a stub. Two consequences for this audit. A page whose real content sits in a later `<main>` is now measured on that content. A page whose every `<main>` is empty is now measured on its body text, page chrome included, where it previously measured as empty.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** Adding concrete statistics to a source document raises the prominence of that source's citations in a generative engine's answer, relative to the same document carrying the same claims in vague quantitative language.

**Grade: B** — this is the one signal in the answer-engine category with a controlled, peer-reviewed measurement of exactly the intervention it describes, on both a 10,000-query benchmark and a live commercial engine.

**Evidence:**

- GEO (Aggarwal et al., KDD '24) tested Statistics Addition as one of nine methods over GEO-bench (10,000 queries, five random seeds). Table 1: Statistics Addition scores 25.2 on the overall Position-Adjusted Word Count metric against a 19.3 no-optimization baseline (Quotation Addition 27.2, Cite Sources 24.6). The paper states its top methods "achieved a relative improvement of 30-40% on the _Position-Adjusted Word Count_ metric and 15-30% on the _Subjective Impression_ metric" — https://arxiv.org/abs/2311.09735 (verified 2026-08-21)
- The abstract generalizes the result: "including citations, quotations from relevant sources, and statistics can significantly boost source visibility, with an increase of over 40% across various queries" — https://arxiv.org/abs/2311.09735 (verified 2026-08-21)
- Confirmed on a live engine, not just a simulated one: "We also demonstrate the efficacy of Generative Engine Optimization on Perplexity.ai, a real-world generative engine and demonstrate visibility improvements up to 37%" — https://arxiv.org/abs/2311.09735 (verified 2026-08-21)
- The benchmark discriminates rather than rewarding any edit: Keyword Stuffing scored 17.7, _below_ the 19.3 unoptimized baseline, and the authors conclude such methods "offer little to no improvement on generative engine's responses" (Table 1, §4) — https://arxiv.org/abs/2311.09735 (verified 2026-08-21)

**Counter-evidence:** The effect is conditional on where the source already ranks. Table 2 of the same paper reports Statistics Addition's relative visibility change by search rank: −20.6% at Rank-1, −3.9% at Rank-2, +8.1% at Rank-3, +10.0% at Rank-4 and +97.9% at Rank-5. For an already top-ranked page the measured effect is negative. This is a signal that helps low-visibility sources and can hurt leaders. Table 3 further shows the gain concentrates in "Law & Gov.", "Debate" and "Opinion" query tags, not uniformly. C-SEO Bench, a later independent benchmark, concludes "Most current C-SEO methods are not only largely ineffective but also frequently have a negative impact on document ranking, which is opposite to what is expected" (https://arxiv.org/abs/2506.11097). Google states "You don't need to write in a specific way just for generative AI search" (https://developers.google.com/search/docs/fundamentals/ai-optimization-guide). The point that matters most for this audit is what was measured. The intervention was _relevant statistics that support the document's claims_. The detector, by contrast, fires on any unit-bearing number anywhere in main content — "30-day", "$19", "3-5 days", a shipping estimate. A page can therefore pass without carrying a single supporting statistic. The grade attaches to the signal, not to this detector. All URLs verified 2026-08-21.
