---
audit: structured-data/breadcrumb-schema
category: structured-data
source_file: packages/core/src/audits/structured-data/breadcrumb-schema.ts
slug: breadcrumb-schema
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - google-breadcrumb-structured-data
  - google-search-gallery
  - webdatacommons-2024-stats
  - webalmanac-2024-structured-data
  - google-ai-features-trust
  - searchviu-schema-ai-fetch-test
---

# breadcrumb-schema (`3.5`)

> structured-data · source `breadcrumb-schema.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

The v7 runner includes `article` and `general` pages in this check's existing page population. This preserves coverage when the old catch-all classification becomes unknown. The audit body still owns its existing feature and artifact guards. This scope change does not establish a new consumer path.

AI agents use BreadcrumbList to understand your site hierarchy and navigate between parent/child pages. Without breadcrumbs, agents cannot infer where a page sits in your content tree, making it harder to provide contextual answers that reference related pages.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** Google Search parses BreadcrumbList markup in the body of a page and uses it to categorize that page and render a breadcrumb trail in the search result, in place of the raw URL.

**Grade: A** — a vendor doc names the consumer (Google Search), states the behavior verbatim, and specifies the required shape of the signal; adoption is at web scale.

**Evidence:**

- Google: "Google Search uses breadcrumb markup in the body of a web page to categorize the information from the page in search results." Required shape: an `itemListElement` array; each `ListItem` requires `position` ("Position 1 signifies the beginning of the trail"), `name` and `item` (`item` "is not required" for the last element) — https://developers.google.com/search/docs/appearance/structured-data/breadcrumb (verified 2026-08-21)
- Breadcrumb remains a live feature in Google's structured data gallery: "Navigation that indicates the page's position in the site hierarchy." — https://developers.google.com/search/docs/appearance/structured-data/search-gallery (verified 2026-08-21)
- Adoption: BreadcrumbList found on 6.2M domains in the October 2024 Common Crawl, and on 5.66% of mobile pages — https://webdatacommons.org/structureddata/2024-12/stats/stats.html and https://almanac.httparchive.org/en/2024/structured-data (both verified 2026-08-21)

**Counter-evidence:** The audit's stated mechanism — that AI agents use BreadcrumbList to "navigate between parent/child pages" — has no documented consumer; no LLM or assistant vendor names BreadcrumbList, and Apple's Applebot type list does not include it. Google's own guidance contradicts the audit's URL-depth applicability gate: "We recommend providing breadcrumbs that represent a typical user path to a page, instead of mirroring the URL structure." Google also disclaims any special schema requirement for AI Overviews and AI Mode — https://developers.google.com/search/docs/appearance/ai-features (verified 2026-08-21). A controlled fetch test found that data present only in JSON-LD was read by 0 of 5 AI systems on direct retrieval — https://www.searchviu.com/en/schema-markup-and-ai-in-2025-what-chatgpt-claude-perplexity-gemini-really-see/ (verified 2026-08-21)

## Deferred

- The category, product, general and article list is a broad list kept while
  classification changes. Its review against the documented hierarchy
  obligation is open in
  `docs/architecture/audits.md#511-default-scope-and-page-type-restrictions`.
