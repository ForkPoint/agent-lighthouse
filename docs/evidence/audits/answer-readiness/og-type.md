---
audit: answer-readiness/og-type
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/og-type.ts
slug: og-type
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - ogp-me-spec
  - ogp-types
  - meta-sharing-webmasters
  - s18
  - google-ai-features-trust
  - google-special-tags
  - google-article-structured-data
---

# og-type (`4.7`)

> meta-tags · source `og-type.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

## What it checks

AI agents use og:type to classify page content as either a website, article, product, or other entity type. Without it, agents default to treating the page as generic content, missing opportunities for type-specific handling like article freshness scoring.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** Open Graph consumers read `og:type` to decide which object vocabulary applies to the page — `article`, `website`, `product`, `video.*` and so on. That choice decides which additional properties they look for and render. A page declaring the wrong type is interpreted as the wrong kind of object.

**Grade: B** — `og:type` is one of the four required properties in the de-facto Open Graph protocol, and adoption is enormous. Meta names it as a tag that changes distribution handling. But the type-selects-behavior effect is documented only in spec terms, and no vendor documents the value-appropriateness effect this audit actually scores.

**Evidence:**

- The Open Graph protocol lists `og:type` among the four required basic properties and ties it to further requirements: "The type of your object, e.g., 'video.movie'. Depending on the type you specify, other properties may also be required." — https://ogp.me/ (verified 2026-08-21)
- The protocol defines the type vocabulary the audit should validate against (`article`, `book`, `profile`, `website`, `music.*`, `video.*`) — https://ogp.me/#types (verified 2026-08-21)
- Meta's webmaster guide lists `og:type` among the tags to add to "improve distribution of your content", alongside the core four read by `facebookexternalhit/1.1` — https://developers.facebook.com/docs/sharing/webmasters/ (verified 2026-08-21)

**Counter-evidence:** The audit's stated mechanism — that AI agents apply "article freshness scoring" or recency weighting keyed on `og:type="article"` — has no source. OpenAI's crawler documentation mentions no HTML metadata — https://developers.openai.com/api/docs/bots (verified 2026-08-21). Google's AI-features page describes query fan-out and snippet controls, with no reference to Open Graph — https://developers.google.com/search/docs/appearance/ai-features (verified 2026-08-21); and `og:*` properties are absent from Google's supported-meta-tags list — https://developers.google.com/search/docs/crawling-indexing/special-tags (verified 2026-08-21). Where an engine does consume content typing, the documented vehicle is schema.org structured data (e.g. `Article` with `datePublished`), not `og:type` — https://developers.google.com/search/docs/appearance/structured-data/article (verified 2026-08-21). The B grade covers presence of a valid OGP type only. The "appropriate" half of this audit is URL-substring blog detection, warning on non-`article` values. No source supports it, and per the review findings above it is effectively dead code in production.
