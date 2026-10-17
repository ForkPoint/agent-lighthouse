---
audit: answer-readiness/meta-author
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/meta-author.ts
slug: meta-author
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - whatwg-metadata-names
  - google-article-structured-data
  - google-special-tags
  - s18
---

# meta-author (`4.2`)

> meta-tags · source `meta-author.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

## What it checks

The v7 runner selects article-purpose pages for this check. A `general` declaration does not establish article purpose. Detection can use Open Graph article metadata or primary article prose without author, date, or Article schema fields. Schema-only evidence remains a hint. Detected matches remain informative; a precise `article` declaration uses the existing audit tier.

AI agents use the meta author tag to attribute content to a specific person or organization for E-E-A-T scoring. Without it, your content appears authorless, which reduces trust signals in AI ranking systems that prioritize named expertise.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** A named ranking or answer system reads `<meta name="author">` and uses it to attribute the page to a person or organization, raising the page's trust/authority weighting relative to an otherwise identical page without the tag.

**Grade: C** — `author` is a WHATWG-standard metadata name with long-standing partial adoption, but no vendor documents any system reading it, and the specific E-E-A-T mechanism this audit asserts is contradicted by the one vendor that documents authorship handling.

**Evidence:**

- WHATWG HTML defines `author` as a standard metadata name: "The value must be a free-form string giving the name of one of the page's authors." The spec assigns no consumer behavior to it — https://html.spec.whatwg.org/multipage/semantics.html#standard-metadata-names (verified 2026-08-21)
- Convention is real but consumer-less: the tag predates and is superseded by schema.org `author`, which is the form Google documents for authorship — https://developers.google.com/search/docs/appearance/structured-data/article (verified 2026-08-21)

**Counter-evidence:** Google's list of meta tags Google Search supports does not include `author`, and the same page states "Google will ignore `meta` tags that it doesn't support" — https://developers.google.com/search/docs/crawling-indexing/special-tags (verified 2026-08-21). Google's Article structured-data guidance handles authorship exclusively through schema.org (`author.name`, `author.url`, `Person`/`Organization`) and never mentions the meta tag — https://developers.google.com/search/docs/appearance/structured-data/article (verified 2026-08-21). OpenAI's crawler documentation mentions no HTML metadata of any kind — https://developers.openai.com/api/docs/bots (verified 2026-08-21). The audit's "E-E-A-T scoring" framing is therefore D-grade on its own terms. No shipping AI system is documented to derive a trust signal from this tag. And the page it is currently measured on — the homepage, per the wrong-page bug above — would not carry a byline even on a site that marks up authorship correctly.

## Implementation deviations (v7 P3, 2026-10-07)

The page-purpose gate now excludes general pages. Body-level aggregation and narrower specialist populations remain under review in the v7 applicability ledger. This change preserves the evidence grade, tier, weight, and audit ID.
