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

AI agents use BreadcrumbList to understand your site hierarchy and navigate between parent/child pages. Without breadcrumbs, agents cannot infer where a page sits in your content tree, making it harder to provide contextual answers that reference related pages.

## Code review findings (2026-08-20, 11-agent pass)

BreadcrumbList is a real, still-consumed signal, but the applicability gate is a raw URL-segment count that has no relationship to site hierarchy, and the 'nothing to assess' branch returns warn (0.5) instead of notApplicable, docking flat-URL sites for a structure they do not have.

**Required fix:** Return `this.notApplicable(...)` when no deep pages exist. Drive applicability off `pageType` (product/category/content) rather than segment count, resolve depth from `fetchResult.finalUrl`, and strip a leading locale segment (`/xx/` or `/xx-yy/`) before counting. Additionally require `itemListElement` to be a non-empty array with sequential `position` values before passing.

**False-positive risks:**
- `urlDepth(p.url) > 1` is pure URL shape. A locale-prefixed site (`/en-us/about`, `/de/kontakt`) has depth 2 on every page and is required to carry breadcrumbs even though it is logically flat — a false fail driven entirely by an i18n path segment.
- Conversely a genuinely deep site using flat slugs (`/blue-running-shoe`) is exempted from breadcrumbs entirely, so the audit passes sites that most need the fix.
- Uses `p.url` rather than `p.fetchResult.finalUrl`. After a `/category/sub-page` → `/sub-page` redirect the page is still counted as deep and required to have breadcrumbs describing a hierarchy that no longer exists.
- The no-deep-pages branch returns `this.warn(...)` (score 0.5), not `this.notApplicable(...)`, so a single-level marketing site takes a permanent half-point deduction for a check the base class explicitly documents as an `na` case (audit.ts:38-46).
- Only `@type === 'BreadcrumbList'` is accepted, with no check that `itemListElement` exists or that positions are sequential — an empty `"itemListElement": []` BreadcrumbList counts as a pass.
- Which pages count as 'deep' depends entirely on which URLs the crawler happened to sample, so the same site can score pass/warn/fail across runs with different page discovery.

**Test gaps:**
- No test for a locale-prefixed URL (`/en-us/about`) being wrongly classed as deep
- No test where `url` and `fetchResult.finalUrl` differ (redirect)
- No test for a BreadcrumbList with an empty or malformed `itemListElement`
- No test asserting the no-deep-pages branch should be `na` rather than `warn`
- No Microdata/RDFa breadcrumb test (`itemtype=".../BreadcrumbList"` is very common on legacy commerce platforms)

**Overlaps with:** _none_

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Evidence (2026-08-21)

**Mechanism claim:** Google Search parses BreadcrumbList markup in the body of a page and uses it to categorize that page and render a breadcrumb trail in the search result, in place of the raw URL.

**Grade: A** — a vendor doc names the consumer (Google Search), states the behavior verbatim, and specifies the required shape of the signal; adoption is at web scale.

**Evidence:**
- Google: "Google Search uses breadcrumb markup in the body of a web page to categorize the information from the page in search results." Required shape: an `itemListElement` array; each `ListItem` requires `position` ("Position 1 signifies the beginning of the trail"), `name` and `item` (`item` "is not required" for the last element) — https://developers.google.com/search/docs/appearance/structured-data/breadcrumb (verified 2026-08-21)
- Breadcrumb remains a live feature in Google's structured data gallery: "Navigation that indicates the page's position in the site hierarchy." — https://developers.google.com/search/docs/appearance/structured-data/search-gallery (verified 2026-08-21)
- Adoption: BreadcrumbList found on 6.2M domains in the October 2024 Common Crawl, and on 5.66% of mobile pages — https://webdatacommons.org/structureddata/2024-12/stats/stats.html and https://almanac.httparchive.org/en/2024/structured-data (both verified 2026-08-21)

**Counter-evidence:** The audit's stated mechanism — that AI agents use BreadcrumbList to "navigate between parent/child pages" — has no documented consumer; no LLM or assistant vendor names BreadcrumbList, and Apple's Applebot type list does not include it. Google's own guidance contradicts the audit's URL-depth applicability gate: "We recommend providing breadcrumbs that represent a typical user path to a page, instead of mirroring the URL structure." Google also disclaims any special schema requirement for AI Overviews and AI Mode — https://developers.google.com/search/docs/appearance/ai-features (verified 2026-08-21). A controlled fetch test found that data present only in JSON-LD was read by 0 of 5 AI systems on direct retrieval — https://www.searchviu.com/en/schema-markup-and-ai-in-2025-what-chatgpt-claude-perplexity-gemini-really-see/ (verified 2026-08-21)
