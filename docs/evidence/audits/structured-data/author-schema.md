---
audit: structured-data/author-schema
category: structured-data
source_file: packages/core/src/audits/structured-data/author-schema.ts
slug: author-schema
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - google-article-structured-data
  - google-article-author
  - schema-person
  - webalmanac-2024-structured-data
  - google-ai-features-trust
---

# author-schema (`3.15`)

> structured-data · source `author-schema.ts` · review verdict **fix** · evidence grade **C** · disposition: **keep — fix required**

## What it checks

The v7 runner selects article-purpose pages for this check. A `general` declaration does not establish article purpose. Detection can use Open Graph article metadata or primary article prose without author, date, or Article schema fields. Schema-only evidence remains a hint. Detected matches remain informative; a precise `article` declaration uses the existing audit tier.

AI systems assign higher confidence to content from named experts with verifiable credentials. Person schema with jobTitle, sameAs, and affiliation lets AI agents cross-reference author identity across platforms, boosting your content in RAG trust scoring.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** A `Person` author node can carry `jobTitle`, `sameAs` and `affiliation`. The claim is that a named AI system reads it, cross-references the author across platforms, and raises the retrieval and citation weight of the page relative to the same page marked up with `name` alone.

**Grade: C** — the only documented consumer is Google Search. It reads `author.name` plus `url` or `sameAs` to _disambiguate_ an author, calls the whole property recommended rather than required, and never states an effect on ranking or trust scoring. No vendor documents `jobTitle` or `affiliation` being read at all, and the "RAG trust scoring" mechanism the audit asserts has no source.

**Evidence:**

- Google's Article structured data doc lists `author` as **recommended**, not required: "The author of the article. To help Google best understand authors across various features, we recommend following the author markup best practices." — https://developers.google.com/search/docs/appearance/structured-data/article (verified 2026-08-21)
- Author markup best practices ask for the `Person` type for people and `Organization` for organizations ("Don't use the `Thing` type"). "Google can understand both `sameAs` and `url` when disambiguating authors", and `jobTitle` is offered only as "the appropriate property if you want to specify that information". The stated purpose is to "best understand and represent the author of the content", with no ranking or trust claim — https://developers.google.com/search/docs/appearance/structured-data/article#author-best-practices (verified 2026-08-21)
- schema.org defines `name`, `jobTitle`, `affiliation` and `sameAs` on `Person` but marks none of them required; `affiliation` is "An organization that this person is affiliated with" — https://schema.org/Person (verified 2026-08-21)
- Structured data of any kind is present on 41% of pages as JSON-LD, up from 34% in 2022. But `Person` does not appear among the leading emitted types: WebSite 12.73%, Organization 7.16%, BreadcrumbList 5.66%, LocalBusiness 3.97%, Product 0.77%. That is partial adoption at best — https://almanac.httparchive.org/en/2024/structured-data (verified 2026-08-21)

**Counter-evidence:** Google states for its AI features: "You don't need to create new machine readable files, AI text files, or markup to appear in these features. There's also no special schema.org structured data that you need to add" (https://developers.google.com/search/docs/appearance/ai-features, verified 2026-08-21) — which directly contradicts the audit's claim that author markup boosts "RAG trust scoring". No vendor documentation was found in which any named AI agent (OpenAI, Anthropic, Perplexity, Microsoft) reads author markup, and no source requires `jobTitle` or `affiliation`; the four-property pass gate is unsupported by any consumer.

## Implementation deviations

- The audit runs on article pages only.
