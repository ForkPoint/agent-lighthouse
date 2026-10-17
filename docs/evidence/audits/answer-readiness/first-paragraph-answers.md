---
audit: answer-readiness/first-paragraph-answers
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/first-paragraph-answers.ts
slug: first-paragraph-answers
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - indig-chatgpt-citation-study-sel
  - geo-sfe-structural-arxiv
  - google-ai-optimization-mythbusting
  - cseo-bench-arxiv
---

# first-paragraph-answers (`9.3`)

> answer-engine · source `first-paragraph-answers.ts` · review verdict **fix** · evidence grade **C** · disposition: **keep — fix required**

## What it checks

The v7 runner selects article-purpose pages for this check. A `general` declaration does not establish article purpose. Detection can use Open Graph article metadata or primary article prose without author, date, or Article schema fields. Schema-only evidence remains a hint. Detected matches remain informative; a precise `article` declaration uses the existing audit tier.

AI search engines score the first paragraph highest for extractive QA. Preamble text like "In this article" or "Welcome" wastes this prime position, causing agents to extract low-value content as the page's representative answer.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** On an article page, the first substantive paragraph may be written as a direct declarative answer, rather than an "In this article…" preamble. The claim is that such a paragraph is more likely to be the passage an AI answer engine extracts and cites than a paragraph further down the page.

**Grade: C** — the positional half of the claim has real observational support. But the specific thing this audit measures — the absence of five English preamble phrases — has no documented consumer and no measured effect. The same dataset that supplies the positional evidence argues against first-sentence extraction.

**Evidence:**

- Position matters, and it has been measured at scale. Kevin Indig analysed 1.2 million AI answers and 18,012 verified citations. The finding: "44.2% of citations come from the first 30% of content", "31.1% come from the middle (30–70%)" and "24.7% come from the final third, with a sharp drop near the footer". The figures are drawn from a wider corpus of 3 million ChatGPT responses and 30 million citations, matched with sentence-transformer embeddings — https://searchengineland.com/chatgpt-citations-content-study-469483 (verified 2026-08-21)
- Sentence-level positioning is a measurable structural factor: GEO-SFE attributes 15.4% of an overall 17.3% citation-rate improvement (p<0.001, Cohen's d = 0.64) to micro-structure, which includes keyword positioning — https://arxiv.org/html/2603.29979v1 (verified 2026-08-21)

**Counter-evidence:** The same Indig dataset cuts against the audit's framing at sentence granularity. "53% of citations come from the middle of paragraphs", against only "24.5% come from first sentences" and 22.5% from last sentences. The lead sentence is the _least_ cited position within a paragraph (https://searchengineland.com/chatgpt-citations-content-study-469483). Google states plainly "You don't need to write in a specific way just for generative AI search" and "There's no requirement to break your content into tiny pieces for AI to better understand it" (https://developers.google.com/search/docs/fundamentals/ai-optimization-guide). C-SEO Bench found "Most current C-SEO methods are not only largely ineffective but also frequently have a negative impact on document ranking" (https://arxiv.org/abs/2506.11097). Neither GEO-SFE nor the GEO benchmark ever tested opener phrasing. The weak-opener regex list is a copywriting convention, not a documented consumer input. Nothing establishes that a page whose lead reads "In this article…" is cited less than the same page with the preamble removed. All URLs verified 2026-08-21.
