---
audit: structured-data/faqpage-schema
category: structured-data
source_file: packages/core/src/audits/structured-data/faqpage-schema.ts
slug: faqpage-schema
evidence_grade: D
disposition: "obsolete tier (2026-10-18)"
reviewed: 2026-10-18
consumers:
  - none (Google stopped showing FAQ rich results on 2026-05-07)
sources:
  - google-search-updates-faq-2026
  - google-howto-faq-blog
  - google-faqpage-deprecation
  - google-faqpage-structured-data
  - google-search-gallery
  - webalmanac-2024-structured-data
  - microsoft-ads-ai-search-optimization
  - google-ai-features-trust
  - searchviu-schema-ai-fetch-test
  - ahrefs-schema-ai-citations
recommended_tier: obsolete
---

# faqpage-schema (`3.7`)

> structured-data · source `faqpage-schema.ts` · evidence grade **D** · tier **obsolete** (weight 0, never fails)

## What it checks

Whether any sampled page still publishes `FAQPage` structured data.

Question headings without markup are no longer a finding. The visible questions and answers still matter, and `answer-readiness/faq-sections` checks them.

| State                                         | Result                 |
| :-------------------------------------------- | :--------------------- |
| `FAQPage` markup on at least one sampled page | `warn`, priority `low` |
| no `FAQPage` markup                           | `notApplicable`        |

## Claimed mechanism (falsifiable)

**Mechanism:** Google showed FAQ rich results from `FAQPage` markup. The claim this audit tests is that Google retired them and that no AI vendor documents reading the markup.

## Evidence

- Google restricted FAQ rich results to well-known government and health sites in 2023 — [Changes to HowTo and FAQ rich results](https://developers.google.com/search/blog/2023/08/howto-faq-changes) (verified 2026-10-18)
- Google's changelog, 2026-05-08: "Deprecating the FAQ rich result feature … This feature will no longer appear in Google Search starting May 7, 2026." — [Search Central updates](https://developers.google.com/search/updates) (verified 2026-10-18)
- No AI vendor documents reading `FAQPage` markup. A controlled test found that chat assistants fetching a page did not read JSON-LD at all.

**Counter-evidence:** A Microsoft Advertising blog post recommends FAQ schema for AI search but names no system that reads it. Google says unused markup causes no problems. The message therefore says removal is optional and keeps the visible Q&A as the thing that counts.

## Scoring

**Grade: D** — the only documented consumer was retired by its operator; the one vendor recommendation names no consumer. An obsolete audit carries weight 0 and never returns `fail` (`sunset.test.ts`; `Audit.toCheckResult` lowers a stray `fail` to `warn`). It does not move any score.

## Example finding

A help page carries `{"@type":"FAQPage","mainEntity":[…]}`. The report says Google retired FAQ rich results, that removing the markup is optional, and that the visible questions and answers should stay.

## Implementation deviations

- 2026-10-18: moved from informative (grade C) to the obsolete tier (grade D).
- The heading heuristic is gone. The audit looks only for markup.

## Record before the obsolete tier

The dossier as it stood before the move on 2026-10-18. Kept as the research record; withheld from the public page.

### What it checks

AI answer engines like Perplexity and Google SGE extract FAQ-structured content with higher confidence for direct answers. FAQPage schema makes your Q&A content machine-readable, giving it priority in AI-generated responses over unstructured text.

### Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

### Evidence (2026-08-21)

**Mechanism claim:** Google Search parses FAQPage markup and renders its Question/acceptedAnswer pairs as an expandable FAQ rich result beneath the page's search listing.

**Grade: C** — the only documented consumer path for this signal has been withdrawn: Google first restricted the FAQ rich result to authoritative government and health sites, then retired the feature and dropped it from the structured data gallery. No other vendor documents a named consumer, so what remains is a widely-published community convention with a plausible but unproven mechanism.

**Evidence:**

- Google's own FAQPage documentation records the restriction: the FAQ rich result "is only shown for well-known, authoritative government and health websites". It then records the removal of the feature and its documentation. The changelog states that "The FAQ rich result feature is no longer shown in Google Search results", under a deprecation notice effective 7 May 2026 — https://developers.google.com/search/docs/appearance/structured-data/faqpage (verified 2026-08-21)
- FAQ is absent from Google's current structured data gallery. Of the features listed there, Breadcrumb, Article, Local business, Review snippet and Organization all remain; FAQ does not — https://developers.google.com/search/docs/appearance/structured-data/search-gallery (verified 2026-08-21)
- The convention nevertheless persists and is still growing: FAQPage rose from 0.2% of desktop pages in 2022 to 0.6% in 2024 — https://almanac.httparchive.org/en/2024/structured-data (verified 2026-08-21)
- The one remaining vendor gesture toward FAQ markup is a Microsoft Advertising marketing post: "Schema can label your content as a product, review, FAQ, or event, turning plain text into structured data that machines can interpret with confidence". That is a secondary source, and it names no consuming system and no mechanism — https://about.ads.microsoft.com/en/blog/post/october-2025/optimizing-your-content-for-inclusion-in-ai-search-answers (verified 2026-08-21)

**Counter-evidence:** Nothing supports the audit description's specific claim that "AI answer engines like Perplexity and Google SGE extract FAQ-structured content with higher confidence for direct answers". Google states the opposite of the premise: "You don't need to create new machine readable files, AI text files, or markup to appear in these features. There's also no special schema.org structured data that you need to add" — https://developers.google.com/search/docs/appearance/ai-features (verified 2026-08-21). A controlled fetch test found ChatGPT (37.5% of values recovered), Claude (0%), Perplexity (12.5%) and Google AI Mode (25%) all failed to read data present only in JSON-LD — https://www.searchviu.com/en/schema-markup-and-ai-in-2025-what-chatgpt-claude-perplexity-gemini-really-see/ (verified 2026-08-21). A matched difference-in-differences study of 1,885 pages adding JSON-LD found AI Mode +2.4% and ChatGPT +2.2% (both noise) and AI Overviews −4.6% — https://ahrefs.com/blog/schema-ai-citations/ (verified 2026-08-21)
