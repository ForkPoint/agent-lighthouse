---
audit: answer-readiness/named-author
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/named-author.ts
slug: named-author
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - google-article-structured-data
  - google-helpful-content
  - geo-critical-survey-arxiv
  - google-ai-features-trust
---

# named-author (`10.1`)

> generative-engine · source `named-author.ts` · review verdict **fix** · evidence grade **C** · disposition: **keep — fix required**

## What it checks

The v7 runner selects article-purpose pages for this check. A `general` declaration does not establish article purpose. Detection can use Open Graph article metadata or primary article prose without author, date, or Article schema fields. Schema-only evidence remains a hint. Detected matches remain informative; a precise `article` declaration uses the existing audit tier.

AI systems assign higher confidence to content from named experts. Generic authors like "Staff" or "Admin" reduce trust scoring because agents cannot verify expertise.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** Replacing a generic author label ("Staff", "Admin", "Team") with a named person in schema.org `author` / the visible byline raises the page's confidence or citation rate in generative answer engines.

**Grade: C** — the field itself is a documented Google Search input, with wide adoption. But no vendor documents any AI answer engine reading author identity, and no study measures a citation delta for named against generic authorship. The "AI trust scoring" half of the claim is convention, not proof.

**Evidence:**

- Google documents that it parses `author` markup, and prescribes its shape. "To help Google best understand and represent the author of the content, we recommend following these best practices when specifying authors in markup". "In the `author.name` property, only specify the name of the author. Don't add any other piece of information", "Use the `Person` type for people, and the `Organization` type for organizations." This is a named consumer reading the exact field the audit inspects, and it independently justifies rejecting byline blobs and Organization authors — https://developers.google.com/search/docs/appearance/structured-data/article (verified 2026-08-21)
- Google's content guidance treats a real byline as an expected quality signal. It states: "We strongly encourage adding accurate authorship information, such as bylines to content where readers might expect it." Two of its self-assessment questions ask the same thing. "Do pages carry a byline, where one might be expected?" And: "Is this content written or reviewed by an expert or enthusiast who demonstrably knows the topic well?" — https://developers.google.com/search/docs/fundamentals/creating-helpful-content (verified 2026-08-21)

**Counter-evidence:** The 2026 critical GEO survey rates authority-flavoured signals as the weakest family it reviewed. "Authoritative tone" has "weak and unstable" support, and "may conflict with credibility". The survey finds no dedicated research on E-E-A-T signals for generative engines at all (https://arxiv.org/html/2607.14035v1, verified 2026-08-21). Google's own AI-features documentation states there are "no additional requirements to appear in AI Overviews or AI Mode, nor other special optimizations necessary" and "There's also no special schema.org structured data that you need to add" (https://developers.google.com/search/docs/appearance/ai-features, verified 2026-08-21). Nothing published distinguishes the _named_ case from the _generic_ case in any engine's behaviour; the documented consumption proves the field is read, not that its value changes an outcome.
