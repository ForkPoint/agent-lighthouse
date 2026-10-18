---
audit: structured-data/howto-schema
category: structured-data
source_file: packages/core/src/audits/structured-data/howto-schema.ts
slug: howto-schema
evidence_grade: D
disposition: "obsolete tier (2026-10-18)"
reviewed: 2026-10-18
consumers:
  - none (Google retired How-to rich results in September 2023)
signals:
  - name: HowTo JSON-LD as an ingestion-quality hint
    grade: C
    domain: structured-data
sources:
  - google-howto-faq-blog
  - google-search-updates-howto
  - google-howto-faq-changes-2023
  - schemaorg-howto
  - geo-16-study
recommended_tier: obsolete
---

# howto-schema (`3.11`)

> structured-data · source `howto-schema.ts` · evidence grade **D** · tier **obsolete** (weight 0, never fails)

## What it checks

Whether any sampled general or article page still publishes `HowTo` structured data.

Numbered steps without markup are no longer a finding. The old audit failed them and asked the owner to add the markup.

| State                                       | Result                 |
| :------------------------------------------ | :--------------------- |
| `HowTo` markup on at least one sampled page | `warn`, priority `low` |
| no `HowTo` markup                           | `notApplicable`        |

## Claimed mechanism (falsifiable)

**Mechanism:** Google showed How-to rich results from `HowTo` markup. The claim this audit tests is that Google retired them and that no AI vendor reads the markup.

## Evidence

- Google: "As of September 13, Google Search no longer shows How-to rich results on desktop, which means this result type is now deprecated." — [Changes to HowTo and FAQ rich results](https://developers.google.com/search/blog/2023/08/howto-faq-changes) (verified 2026-10-18)
- The same post: "there's no need to proactively remove it. Structured data that's not being used does not cause problems for Search."
- Google removed the How-to structured data documentation on 2023-09-14 — [Search Central updates](https://developers.google.com/search/updates) (verified 2026-10-18)
- No AI vendor documents reading `HowTo` markup.

**Counter-evidence:** Schema.org still defines `HowTo`, and the markup does no harm. The message says removal is optional.

## Scoring

**Grade: D** — the only documented consumer was retired by its operator. An obsolete audit carries weight 0 and never returns `fail` (`sunset.test.ts`; `Audit.toCheckResult` lowers a stray `fail` to `warn`). It does not move any score.

## Example finding

A tutorial page carries `{"@type":"HowTo","step":[…]}`. The report says Google retired How-to rich results and that removing the markup is optional.

## Implementation deviations

- 2026-10-18: moved from informative (grade C) to the obsolete tier (grade D).
- `applicablePageTypes` stays `[General, Article]`; widening it is a separate decision.
- The heading heuristic is gone. The audit looks only for markup.

## Record before the obsolete tier

The dossier as it stood before the move on 2026-10-18. Kept as the research record; withheld from the public page.

### What it checks

The v7 runner includes `article` and `general` pages in this check's existing page population. This preserves coverage when the old catch-all classification becomes unknown. The audit body still owns its existing feature and artifact guards. This scope change does not establish a new consumer path.

AI agents use HowTo schema to present step-by-step instructions as structured answers. Without it, agents must parse your numbered headings heuristically, which often breaks step ordering or misses steps entirely.

### Evidence

#### Signal: HowTo JSON-LD as an ingestion-quality hint — grade C (structured-data)

**Mechanism:** A page with sequential instructions that emits `HowTo` JSON-LD hands a reader an unambiguous ordered `step[]` array. The reader no longer has to infer step boundaries and ordering from headings and prose. That is an ingestion-quality benefit which would survive the loss of any rich result.

**Grade: C** — the type is genuinely widely deployed, and still first-class in the schema.org vocabulary. Structured data as a class is associated with citation. But no vendor documents any consumer reading `HowTo` today, and Google explicitly deprecated the only consumer that ever existed.

**Evidence:**

- The type is alive and broadly deployed: schema.org/HowTo carries no deprecated, attic or pending marker and reports 100K–1M domains (Google web index, July 2026) — https://schema.org/HowTo (verified 2026-08-21)
- Pillar-level empirical support, not type-level. The GEO-16 study audited 1,702 citations across Brave Summary, Google AI Overviews and Perplexity. It found that "pillars related to Metadata and Freshness, Semantic HTML, and Structured Data showed the strongest associations with citation" — https://arxiv.org/abs/2509.10762 (verified 2026-08-21)

**Counter-evidence:** Explicit and strong. Google deprecated the rich result: "As of September 13, Google Search no longer shows How-to rich results on desktop, which means this result type is now deprecated" (https://developers.google.com/search/blog/2023/08/howto-faq-changes, verified 2026-08-21). It then removed the documentation — "Removed the How-to structured data documentation, as this rich result is no longer shown in search results" — and the old documentation URL now 301-redirects to an anchor Google named `#how-to-deprecation` (https://developers.google.com/search/updates#how-to-deprecation, verified 2026-08-21). Google also states that unused markup is inert: "Structured data that's not being used does not cause problems for Search, but also has no visible effects in Google Search." The assistant path is gone as well: `developers.google.com/assistant/content/howto` returns HTTP 404, and the surviving "Actions from web content" overview lists only FAQs, Media, News and Podcasts. Beyond Google: Microsoft's NLWeb codebase contains zero mentions of HowTo, Apple's Applebot documentation names only `isAccessibleForFree`, and OpenAI's commerce specification excludes JSON-LD sources entirely. The GEO-16 finding supports emitting structured data in general; it does not isolate this type.

### Deferred

- The general and article list is a broad list kept while classification
  changes. Its review against the sequential-heading intent test is open in
  `docs/architecture/audits.md#511-default-scope-and-page-type-restrictions`.
