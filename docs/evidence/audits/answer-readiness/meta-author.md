---
audit: answer-readiness/meta-author
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/meta-author.ts
slug: meta-author
evidence_grade: C
disposition: "informative with an unconsumed notice (2026-10-18)"
reviewed: 2026-10-18
consumers:
  - none documented (Google ignores meta tags it does not support; author is not one)
sources:
  - google-special-tags
  - whatwg-metadata-names
  - google-article-structured-data
  - s18
recommended_tier: informative
---

# meta-author (`4.2`)

> answer-readiness · source `meta-author.ts` · evidence grade **C** · tier **informative** (weight 0, never warns or fails)

## What it checks

Whether any sampled page, of any page type, sets `<meta name="author">`. A missing tag is not a finding.

| State                                                    | Result          |
| :------------------------------------------------------- | :-------------- |
| a non-empty meta author tag on at least one sampled page | `pass`          |
| no meta author tag                                       | `notApplicable` |

The pass message says that no AI vendor documents reading the tag and that Google ignores it.

## Claimed mechanism (falsifiable)

**Mechanism:** a meta author tag would let a search engine or agent attribute a page to a person. The claim this audit tests is that no AI vendor documents reading it, and that Google ignores it.

## Evidence

- Google lists the meta tags it supports; `author` is not among them. Google: "Google will ignore meta tags that it doesn't support." — [Meta tags and attributes that Google supports](https://developers.google.com/search/docs/crawling-indexing/special-tags) (verified 2026-10-18)
- No AI vendor documents reading the tag. Google documents reading `author` in Article structured data instead.

**Counter-evidence:** HTML defines `author` as a standard metadata name, so the tag is valid, live markup. It is harmless, and the message says so.

## Scoring

**Grade: C** — `author` is a live HTML standard with no documented consumer. Google never supported the tag, so no consumer withdrew it; that makes it informative, not obsolete (`docs/evidence/policy.md`, "Informative or obsolete"). The audit carries weight 0 and an `unconsumed` notice, never warns or fails, and does not move any score.

## Example finding

An article sets `<meta name="author" content="Jane Smith">`. The report says no AI vendor reads the tag, that Google ignores it, and points to schema.org `author` markup and a visible byline.

## Implementation deviations

- 2026-10-18: moved from informative (grade C) to the obsolete tier (grade D), then, after independent review the same day, back to informative (grade C) with an `unconsumed` notice. "Obsolete" requires a withdrawal, a documented refusal or a dead specification; a tag Google never read has none of these.
- The audit reads every sampled page, not only the first.
- `applicablePageTypes` is removed. The tag is usually site-wide, so a homepage-only tag must be seen; the audit returns `notApplicable` when no page carries one.

## Record before the 2026-10-18 changes

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
