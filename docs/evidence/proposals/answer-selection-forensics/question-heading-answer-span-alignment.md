---
check: question-heading-answer-span-alignment
title: "Question-Heading Answer Span Alignment"
domain: answer-selection-forensics
status: retired
evidence_grade: D
uniqueness: unique
difficulty: llm-assisted
scoring_tier: rejected
reviewed: 2026-10-19
consumers: []
---

# Question-Heading Answer Span Alignment

> Retired proposal. Evidence grade **D** · no documented consumer · implementation: `llm-assisted`

## What it checks

For every question-shaped heading, whether the content right after it is a self-contained answer. The 2026-08-20 sketch set an envelope: the answer starts within about 320 characters of the heading, sits in one block element, repeats a content word from the heading, runs 8 to 40 words, and is not a teaser. A model would judge whether the span answers the question.

## Claimed mechanism (falsifiable)

The 2026-08-20 claim: a citing surface can lift an answer only as a contiguous span inside one block element. Google's featured snippets link to such spans with text fragments. Heading-based chunkers keep the heading and answer together only when the answer is near the heading.

## Evidence

- web.dev documents that clicking a featured snippet uses "automatically created Text Fragments URLs". It also states: "Each of prefix-, start, end, and -suffix can only match text within a single block-level element, but full start,end ranges can span multiple blocks." — https://web.dev/articles/text-fragments (verified 2026-10-19)
- The Text Fragments specification is a WICG Community Group draft (`Status: CG-DRAFT`). It defines matching within "a single block-level container" — https://github.com/WICG/scroll-to-text-fragment/blob/main/index.bs (verified 2026-10-19). The rendered spec at wicg.github.io timed out twice on 2026-10-19.
- Google's featured-snippets page: "How can I mark my page as a featured snippet? You can't. Google systems determine whether a page would make a good featured snippet". Scrolling to the snippet "happens automatically, without any additional annotation by the site" — https://developers.google.com/search/docs/appearance/featured-snippets (verified 2026-10-19)
- Google's generative-AI guide, updated 2026-07-10: "For Google Search, you can ignore tactics like 'chunking' content". It recommends "headings that provide a clear structure to navigate content" — https://developers.google.com/search/docs/fundamentals/ai-optimization-guide (verified 2026-10-19)

## What the evidence does and does not support

- Documented: Google links featured snippets with text fragments, and each fragment term matches within one block.
- Contradicted: the claim that an answer spread across several paragraphs "has no single span that a citing surface can lift". A start,end range can span blocks.
- Contradicted: the chunking rationale. Google says to ignore chunking tactics for Search.
- Unproven: the 320-character window, the 8 to 40 word envelope and the content-word overlap rule. No source sets any of them. They were invented.
- Unproven: that any answer engine prefers an answer placed directly under a question heading. No vendor documents this.

## Overlap with shipped audits

- `answer-readiness/text-fragment-addressability` (grade A, scored) already checks whether answer spans are fragment-addressable within one block.
- `answer-readiness/question-headings` (grade C, informative) already reports question-form headings, with Google's counter-evidence recorded.

What is left for this proposal is the semantic judgement, and no consumer is documented for it.

## Competitor coverage

Content tools score keyword coverage and heading counts. Some consultancies advise "answer in the first 40 words". That advice traces to no vendor source, so it is not evidence.

## Scoring

Tier: **rejected**. Grade D: the mechanism has no documented consumer, its thresholds are invented, and Google's guidance argues against it. The checkable part ships already. Nothing is gained by shipping the rest.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
- 2026-10-19 — evidence review. Grade C lowered to D and the proposal retired. Three of the four cited sources (Playwright actionability, MCP caching, MCP versioning) had no bearing on this check. The mechanism's labels S2, S3 and S5 point to those unrelated registry entries. Google's guidance contradicts the chunking rationale, and web.dev contradicts the cross-block claim. The deterministic gates duplicate `text-fragment-addressability` and `question-headings`.
- 2026-10-19 — the TODO stub `packages/core/src/audits/proposed/answer-selection-forensics/question-heading-answer-span-alignment.ts` was deleted. The check was never registered, so no audit id was removed. This dossier stays in `proposals/` and is listed in the README's retired table. It does not move to `sunset/`: that folder holds audits that shipped and were removed, and `scripts/audits/build-audit-map.ts` counts every file in it as a sunset audit dossier.
