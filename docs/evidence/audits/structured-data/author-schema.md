---
audit: structured-data/author-schema
audit_id: "3.15"
category: structured-data
source_file: packages/core/src/audits/structured-data/author-schema.ts
slug: author-schema
review_verdict: fix
severity: medium
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# author-schema (`3.15`)

> structured-data · source `author-schema.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

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

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
