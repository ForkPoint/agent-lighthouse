---
audit: answer-readiness/meta-author
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/meta-author.ts
slug: meta-author
evidence_grade: D
disposition: "obsolete tier (2026-10-18)"
reviewed: 2026-10-18
consumers:
  - none (Google ignores meta tags it does not support; author is not one)
sources:
  - google-special-tags
  - whatwg-metadata-names
  - google-article-structured-data
  - s18
recommended_tier: obsolete
---

# meta-author (`4.2`)

> answer-readiness · source `meta-author.ts` · evidence grade **D** · tier **obsolete** (weight 0, never fails)

## What it checks

Whether any sampled article page sets `<meta name="author">`. A missing tag is no longer a finding; the old audit failed it.

| State                                                    | Result                 |
| :------------------------------------------------------- | :--------------------- |
| a non-empty meta author tag on at least one sampled page | `warn`, priority `low` |
| no meta author tag                                       | `notApplicable`        |

## Claimed mechanism (falsifiable)

**Mechanism:** a meta author tag would let a search engine or agent attribute a page to a person. The claim this audit tests is that Google ignores it and no AI vendor reads it.

## Evidence

- Google lists the meta tags it supports; `author` is not among them. Google: "Google will ignore meta tags that it doesn't support." — [Meta tags and attributes that Google supports](https://developers.google.com/search/docs/crawling-indexing/special-tags) (verified 2026-10-18)
- No AI vendor documents reading the tag. Google documents reading `author` in Article structured data instead.

**Counter-evidence:** HTML defines `author` as a standard metadata name, so the tag is valid markup. It is harmless, and the message says so.

## Scoring

**Grade: D** — the main consumer documents ignoring the tag. An obsolete audit carries weight 0 and never returns `fail` (`sunset.test.ts`; `Audit.toCheckResult` lowers a stray `fail` to `warn`). It does not move any score.

## Example finding

An article sets `<meta name="author" content="Jane Smith">`. The report says Google ignores the tag and points to schema.org `author` markup and a visible byline.

## Implementation deviations

- 2026-10-18: moved from informative (grade C) to the obsolete tier (grade D).
- The audit reads every sampled page, not only the first.
- `applicablePageTypes` stays `[Article]`.

## Record before the obsolete tier

The dossier as it stood before the move on 2026-10-18. Kept as the research record; withheld from the public page.

### What it checks

The v7 runner selects article-purpose pages for this check. A `general` declaration does not establish article purpose. Detection can use Open Graph article metadata or primary article prose without author, date, or Article schema fields. Schema-only evidence remains a hint. Detected matches remain informative; a precise `article` declaration uses the existing audit tier.

AI agents use the meta author tag to attribute content to a specific person or organization for E-E-A-T scoring. Without it, your content appears authorless, which reduces trust signals in AI ranking systems that prioritize named expertise.

### Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

### Evidence (2026-08-21)

**Mechanism claim:** A named ranking or answer system reads `<meta name="author">` and uses it to attribute the page to a person or organization, raising the page's trust/authority weighting relative to an otherwise identical page without the tag.

**Grade: C** — `author` is a WHATWG-standard metadata name with long-standing partial adoption, but no vendor documents any system reading it, and the specific E-E-A-T mechanism this audit asserts is contradicted by the one vendor that documents authorship handling.

**Evidence:**

- WHATWG HTML defines `author` as a standard metadata name: "The value must be a free-form string giving the name of one of the page's authors." The spec assigns no consumer behavior to it — https://html.spec.whatwg.org/multipage/semantics.html#standard-metadata-names (verified 2026-08-21)
- Convention is real but consumer-less: the tag predates and is superseded by schema.org `author`, which is the form Google documents for authorship — https://developers.google.com/search/docs/appearance/structured-data/article (verified 2026-08-21)

**Counter-evidence:** Google's list of meta tags Google Search supports does not include `author`, and the same page states "Google will ignore `meta` tags that it doesn't support" — https://developers.google.com/search/docs/crawling-indexing/special-tags (verified 2026-08-21). Google's Article structured-data guidance handles authorship exclusively through schema.org (`author.name`, `author.url`, `Person`/`Organization`) and never mentions the meta tag — https://developers.google.com/search/docs/appearance/structured-data/article (verified 2026-08-21). OpenAI's crawler documentation mentions no HTML metadata of any kind — https://developers.openai.com/api/docs/bots (verified 2026-08-21). The audit's "E-E-A-T scoring" framing is therefore D-grade on its own terms. No shipping AI system is documented to derive a trust signal from this tag. And the page it is currently measured on — the homepage, per the wrong-page bug above — would not carry a byline even on a site that marks up authorship correctly.
