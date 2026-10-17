---
audit: structured-data/article-schema
category: structured-data
source_file: packages/core/src/audits/structured-data/article-schema.ts
slug: article-schema
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - google-article-structured-data
  - google-search-gallery
  - webdatacommons-2024-stats
  - webalmanac-2024-structured-data
  - google-ai-features-trust
  - ahrefs-schema-ai-citations
---

# article-schema (`3.6`)

> structured-data · source `article-schema.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

The v7 runner selects article-purpose pages for this check. A `general` declaration does not establish article purpose. Detection can use Open Graph article metadata or primary article prose without author, date, or Article schema fields. Schema-only evidence remains a hint. Detected matches remain informative; a precise `article` declaration uses the existing audit tier.

AI agents extract Article schema to identify content freshness (datePublished/dateModified), authorship, and topic (headline). Without it, your blog content is treated as generic text with no provenance, reducing its chances of being cited in AI-generated answers.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** Google Search parses Article/NewsArticle/BlogPosting markup and uses it to select the title text, image and date information shown for that page in Google Search and other Google properties (Google News, Assistant).

**Grade: A** — a vendor doc names the consumer and states the behavior verbatim; the type is a live Google search feature with web-scale adoption.

**Evidence:**

- Google states the effect directly. Adding `Article` structured data "can help Google understand more about the web page and show better title text, images, and date information for the article in search results on Google Search and other properties (for example, Google News and the Google Assistant)." — https://developers.google.com/search/docs/appearance/structured-data/article (verified 2026-08-21)
- Article remains a live feature in Google's structured data gallery: "A news, sports, or blog article displayed in various rich result features." — https://developers.google.com/search/docs/appearance/structured-data/search-gallery (verified 2026-08-21)
- Adoption: Article found on 2.4M domains in the October 2024 Common Crawl; BlogPosting on 1.40% and Article on 0.18% of mobile pages — https://webdatacommons.org/structureddata/2024-12/stats/stats.html and https://almanac.httparchive.org/en/2024/structured-data (both verified 2026-08-21)

**Counter-evidence:** Google's contract is far weaker than the audit's required-property set: "There are no required properties; instead, add the properties that apply to your content", and `headline`, `datePublished`, `dateModified`, `author` and `image` are **all** listed as _recommended_. Blocking a pass on a missing `dateModified` therefore has no basis in the documented consumer behavior. Google's news features do not need the markup either — Top stories eligibility does not require Article structured data. The audit's AI-attribution framing is separately disclaimed by Google: "There's also no special schema.org structured data that you need to add" to appear in AI Overviews or AI Mode — https://developers.google.com/search/docs/appearance/ai-features (verified 2026-08-21). A matched difference-in-differences study over 1,885 pages adding JSON-LD found no AI-citation uplift — https://ahrefs.com/blog/schema-ai-citations/ (verified 2026-08-21)

## Implementation deviations

- The audit runs on article pages only.
