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

AI systems assign higher confidence to content from named experts with verifiable credentials. Person schema with jobTitle, sameAs, and affiliation lets AI agents cross-reference author identity across platforms, boosting your content in RAG trust scoring.

## Code review findings (2026-08-20, 11-agent pass)

The pass criteria (name AND jobTitle AND sameAs AND affiliation) are invented — schema.org and Google require none of the last three — so virtually every correctly-marked-up author gets a warn with a list of 'missing' properties that no consumer requires. It also picks the single best Person anywhere on the site, so a complete founder bio can mask anonymous articles.

**Required fix:** Pass on `name` plus any one identity anchor (`url`, `@id`, or a non-empty `sameAs`); demote `jobTitle` and `affiliation` to advisory extras in the message rather than pass-blocking requirements. Handle string authors (credit them, optionally warn that a structured Person is richer) and Organization authors (treat as valid, skip Person-specific props). Restrict the Person search to `author`/`creator` positions on pages the article audit identified as articles, instead of scanning every Person on the site.

**False-positive risks:**
- `const requiredProps = ['name', 'jobTitle', 'sameAs', 'affiliation']` — a site following Google's own author-markup guidance (`author: {"@type":"Person","name":"…","url":"…"}`) is permanently warned 'missing: jobTitle, sameAs, affiliation'. That is advice invented by this audit, presented as a trust-scoring requirement ('boosting your content in RAG trust scoring') with no cited basis.
- `typeof author === 'object'` silently drops the extremely common and fully valid string form `"author": "Jane Smith"`. If that is a site's only author markup, the audit reports 'No Person (author) schema found' at medium priority even though authorship IS marked up. False fail.
- `author` on a NewsArticle is often an `Organization` (wire services, newsroom bylines). It is pushed into `authorFromArticles` and scored against `jobTitle`/`affiliation`, guaranteeing a permanent warn on correct news markup.
- `allPersons.reduce(...)` picks the most complete Person ANYWHERE across every scanned page — a founder bio, a testimonial author, a Review's author. A site whose every article has an anonymous author can pass because one unrelated Person node elsewhere is fully specified. False pass on the audit's actual subject.
- Declared `applicablePageTypes: ['content']` but `allSchemas(ctx)` reads every page, so homepage/product-page Person nodes count.
- `sameAs` is checked for truthiness only — `"sameAs": []` (empty array) is truthy and passes as verifiable cross-platform identity.

**Test gaps:**
- No test for `"author": "Jane Smith"` (string form) — currently reported as no author schema at all
- No test for an Organization author on a NewsArticle
- No test where the best Person is on a different page than the articles (masking false pass)
- No test for `"sameAs": []`
- No test asserting a name+url Person should be acceptable

**Overlaps with:** `3.6`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Evidence (2026-08-21)

**Mechanism claim:** A `Person` author node carrying `jobTitle`, `sameAs` and `affiliation` is read by a named AI system, which cross-references the author across platforms and raises the retrieval/citation weight of the page relative to the same page marked up with `name` alone.

**Grade: C** — the only documented consumer is Google Search. It reads `author.name` plus `url` or `sameAs` to *disambiguate* an author, calls the whole property recommended rather than required, and never states an effect on ranking or trust scoring. No vendor documents `jobTitle` or `affiliation` being read at all, and the "RAG trust scoring" mechanism the audit asserts has no source.

**Evidence:**
- Google's Article structured data doc lists `author` as **recommended**, not required: "The author of the article. To help Google best understand authors across various features, we recommend following the author markup best practices." — https://developers.google.com/search/docs/appearance/structured-data/article (verified 2026-08-21)
- Author markup best practices ask for the `Person` type for people and `Organization` for organizations ("Don't use the `Thing` type"). "Google can understand both `sameAs` and `url` when disambiguating authors", and `jobTitle` is offered only as "the appropriate property if you want to specify that information". The stated purpose is to "best understand and represent the author of the content", with no ranking or trust claim — https://developers.google.com/search/docs/appearance/structured-data/article#author-best-practices (verified 2026-08-21)
- schema.org defines `name`, `jobTitle`, `affiliation` and `sameAs` on `Person` but marks none of them required; `affiliation` is "An organization that this person is affiliated with" — https://schema.org/Person (verified 2026-08-21)
- Structured data of any kind is present on 41% of pages as JSON-LD, up from 34% in 2022. But `Person` does not appear among the leading emitted types: WebSite 12.73%, Organization 7.16%, BreadcrumbList 5.66%, LocalBusiness 3.97%, Product 0.77%. That is partial adoption at best — https://almanac.httparchive.org/en/2024/structured-data (verified 2026-08-21)

**Counter-evidence:** Google states for its AI features: "You don't need to create new machine readable files, AI text files, or markup to appear in these features. There's also no special schema.org structured data that you need to add" (https://developers.google.com/search/docs/appearance/ai-features, verified 2026-08-21) — which directly contradicts the audit's claim that author markup boosts "RAG trust scoring". No vendor documentation was found in which any named AI agent (OpenAI, Anthropic, Perplexity, Microsoft) reads author markup, and no source requires `jobTitle` or `affiliation`; the four-property pass gate is unsupported by any consumer.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
- 2026-08-21 — evidence graded **C** (Google reads name + url/sameAs for disambiguation only; jobTitle/affiliation and the trust-scoring mechanism have no documented consumer).
