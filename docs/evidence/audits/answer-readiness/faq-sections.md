---
audit: answer-readiness/faq-sections
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/faq-sections.ts
slug: faq-sections
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - schema-faqpage
  - semrush-ai-overviews-study
  - geo-sfe-structural-arxiv
  - google-faqpage-structured-data
  - google-ai-features-trust
  - google-ai-optimization-mythbusting
  - s18
  - cseo-bench-arxiv
---

# faq-sections (`9.1`)

> answer-engine · source `faq-sections.ts` · review verdict **fix** · evidence grade **C** · disposition: **keep — fix required**

## What it checks

AI answer engines like Perplexity extract FAQ-structured content with higher confidence for direct answers. FAQ sections with clear question headings are the top extraction target for "People Also Ask" results and conversational AI responses.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** A page carrying `FAQPage` JSON-LD or an on-page question/answer block has its Q&A pairs extracted as discrete units and cited by AI answer engines more often than the same content written as continuous prose.

**Grade: C** — `FAQPage` is a ratified schema.org type with very wide adoption. But its one documented consumer withdrew the feature for almost every site, and no AI answer-engine vendor documents reading it. The "Q&A blocks are the top extraction target" claim is nowhere measured.

**Evidence:**

- schema.org defines the type — "A FAQPage is a WebPage presenting one or more 'Frequently asked questions' (see also QAPage)" — and reports adoption of 1M–10M domains in the July 2026 aggregation of Google's web index — https://schema.org/FAQPage (verified 2026-08-21)
- Question-shaped demand on AI answer surfaces is real: Semrush's 200,000-keyword study found "how", "what" and "is" the most common starters, with 35% of desktop and 32% of mobile AI Overview keywords being questions and 80%/76% informational — https://www.semrush.com/blog/ai-overviews-study/ (verified 2026-08-21)
- Structured formats generally extract better than prose: GEO-SFE reports "structured formats (lists, tables) demonstrate 43% higher extraction accuracy than equivalent prose", within an overall 17.3% citation-rate improvement (p<0.001, Cohen's d = 0.64) — https://arxiv.org/html/2603.29979v1 (verified 2026-08-21)

**Counter-evidence:** Google narrowed FAQ rich results in August 2023 so that "the feature is only shown for well-known, authoritative government and health websites" — for almost every site the single documented `FAQPage` consumer no longer renders anything (https://developers.google.com/search/docs/appearance/structured-data/faqpage). Google's AI-features page states "You don't need to create new machine readable files, AI text files, or markup to appear in these features. There's also no special schema.org structured data that you need to add" (https://developers.google.com/search/docs/appearance/ai-features), and its AI optimization guide repeats "Structured data isn't required for generative AI search, and there's no special schema.org markup you need to add" (https://developers.google.com/search/docs/fundamentals/ai-optimization-guide). OpenAI's crawler documentation describes OAI-SearchBot, GPTBot and ChatGPT-User purely by purpose and never mentions any markup, FAQ or otherwise (https://developers.openai.com/api/docs/bots). And C-SEO Bench found that "Most current C-SEO methods are not only largely ineffective but also frequently have a negative impact on document ranking" (https://arxiv.org/abs/2506.11097). GEO-SFE never isolates FAQ blocks from other structured formats, so the 43% figure does not transfer to this signal on its own. All URLs verified 2026-08-21.
