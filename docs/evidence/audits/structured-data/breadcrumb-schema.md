---
audit: structured-data/breadcrumb-schema
category: structured-data
source_file: packages/core/src/audits/structured-data/breadcrumb-schema.ts
slug: breadcrumb-schema
evidence_grade: A
disposition: "kept — feature scope corrected 2026-10-21"
reviewed: 2026-10-21
sources:
  - google-breadcrumb-structured-data
  - google-search-gallery
  - webdatacommons-2024-stats
  - webalmanac-2024-structured-data
  - google-ai-features-trust
  - searchviu-schema-ai-fetch-test
---

# breadcrumb-schema (`3.5`)

> structured-data · source `breadcrumb-schema.ts` · review verdict **corrected** · evidence grade **A** · disposition: **kept — feature scope corrected**

## What it checks

Common scope replaces the page-type list and URL-depth test. Existing BreadcrumbList markup or a visible breadcrumb-labelled container with at least two steps selects a page. The visible trail must include a link. Class, id and aria-label breadcrumb tokens are recognized; hidden trails and lone home links do not establish the feature. All relevant pages with markup pass; mixed coverage warns; observed trails without markup fail; no feature returns NA.

## Why it matters

Grade A and weight 1 remain tied to Google Search, not to an undocumented AI navigation path. [Google recommends typical user paths rather than mirroring URL structure](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb) (verified 2026-10-21). A visible trail supplies independent evidence of hierarchy, including on a flat URL.

## Evidence

## Evidence (2026-08-21)

**Mechanism claim:** Google Search parses BreadcrumbList markup in the body of a page and uses it to categorize that page and render a breadcrumb trail in the search result, in place of the raw URL.

**Grade: A** — a vendor doc names the consumer (Google Search), states the behavior verbatim, and specifies the required shape of the signal; adoption is at web scale.

**Evidence:**

- Google: "Google Search uses breadcrumb markup in the body of a web page to categorize the information from the page in search results." Required shape: an `itemListElement` array; each `ListItem` requires `position` ("Position 1 signifies the beginning of the trail"), `name` and `item` (`item` "is not required" for the last element) — https://developers.google.com/search/docs/appearance/structured-data/breadcrumb (verified 2026-08-21)
- Breadcrumb remains a live feature in Google's structured data gallery: "Navigation that indicates the page's position in the site hierarchy." — https://developers.google.com/search/docs/appearance/structured-data/search-gallery (verified 2026-08-21)
- Adoption: BreadcrumbList found on 6.2M domains in the October 2024 Common Crawl, and on 5.66% of mobile pages — https://webdatacommons.org/structureddata/2024-12/stats/stats.html and https://almanac.httparchive.org/en/2024/structured-data (both verified 2026-08-21)

**Counter-evidence:** The audit's stated mechanism — that AI agents use BreadcrumbList to "navigate between parent/child pages" — has no documented consumer; no LLM or assistant vendor names BreadcrumbList, and Apple's Applebot type list does not include it. Google's own guidance contradicts the audit's URL-depth applicability gate: "We recommend providing breadcrumbs that represent a typical user path to a page, instead of mirroring the URL structure." Google also disclaims any special schema requirement for AI Overviews and AI Mode — https://developers.google.com/search/docs/appearance/ai-features (verified 2026-08-21). A controlled fetch test found that data present only in JSON-LD was read by 0 of 5 AI systems on direct retrieval — https://www.searchviu.com/en/schema-markup-and-ai-in-2025-what-chatgpt-claude-perplexity-gemini-really-see/ (verified 2026-08-21)

## Limits

This remains a markup-presence check, not full validation of ListItem fields, positions, URL resolution or agreement with the visible trail. JSON-LD graphs, arrays, array types and gathered microdata/RDFa remain supported. A localized or custom trail without a breadcrumb token may remain undetected; arbitrary URL depth does not fill that gap.

## Implementation deviations

- Every visible breadcrumb-labelled candidate (`nav`, `ol`, `ul`, `div`, `section`, `p`, `span` or `role="navigation"`) is assessed on its own steps, and a plain `<nav>` or `role="navigation"` inside one is assessed too. A trail is two list items, or two steps counting the current page: an `aria-current` marker or plain text beside the links, as in `Home / Product`. A link needs a target, not text, because a home step is often an icon. A lone link, with or without a separator glyph, is not a trail. Candidates containing main, header or article regions are page wrappers, not trails. State and toggle classes such as `has-breadcrumbs`, `no-breadcrumbs` or `breadcrumbs-disabled` do not label a trail.

- The 2026-10-21 correction replaces broad page-type filtering with independent feature selection. Runner tests cover all five types and both provenance modes. Mixed samples exclude unrelated and unread pages.

## Deferred

- Broader language and layout recognition requires new fixtures. Do not infer missing obligations from page type alone.
