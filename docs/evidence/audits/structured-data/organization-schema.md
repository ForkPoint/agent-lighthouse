---
audit: structured-data/organization-schema
category: structured-data
source_file: packages/core/src/audits/structured-data/organization-schema.ts
slug: organization-schema
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - google-organization-structured-data
  - google-search-gallery
  - apple-app-search-web-markup
  - webdatacommons-2024-stats
  - webalmanac-2024-structured-data
  - google-ai-features-trust
  - ahrefs-schema-ai-citations
---

# organization-schema (`3.3`)

> structured-data · source `organization-schema.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

AI agents use Organization schema to identify your brand, logo, and contact info. Without it, agents cannot confidently attribute content to your organization or display your branding in AI-generated answers. Add this JSON-LD to your homepage <head>.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** Google Search parses Organization markup on a site's home page. It uses the `logo`, `name` and `url` to choose the logo and organization details rendered in Search results and in the knowledge panel. Applebot extracts Organization markup for Siri and Spotlight Suggestions.

**Grade: A** — two vendor docs name a consumer and state what it does with the signal, and adoption is at web scale.

**Evidence:**

- Google states that "Adding organization structured data to your home page can help Google better understand your organization's administrative details and disambiguate your organization in search results". The properties determine "which `logo` is shown in Search results", and "can influence visual elements in Search results... your knowledge panel" — along with merchant knowledge panel and brand profile details — https://developers.google.com/search/docs/appearance/structured-data/organization (verified 2026-08-21)
- Organization is still a live feature in Google's structured data gallery: "Information about your organization, such as your logo, legal name of the organization, address." — https://developers.google.com/search/docs/appearance/structured-data/search-gallery (verified 2026-08-21)
- Apple's web-markup guide lists Organization among the schema.org types Applebot supports for Siri and Spotlight Suggestions (alongside AggregateRating, Offers, PriceRange, InteractionCount, Recipe, SearchAction, ImageObject) — https://developer.apple.com/library/archive/documentation/General/Conceptual/AppSearch/WebContent.html (verified 2026-08-21)
- Adoption: Organization JSON-LD found on 6.6M domains in the October 2024 Common Crawl, and on 7.16% of mobile pages — https://webdatacommons.org/structureddata/2024-12/stats/stats.html and https://almanac.httparchive.org/en/2024/structured-data (both verified 2026-08-21)

**Counter-evidence:** Google states plainly that for Organization, "There are no required properties; instead, we recommend adding as many properties that are relevant to your organization". `name`, `url` and `logo` are therefore recommendations, not a contract. Warning a site for a missing one overstates the documented consequence. Google's AI guidance disclaims the AI-agent framing in the audit's own description: "You don't need to create new machine readable files, AI text files, or markup to appear in these features. There's also no special schema.org structured data that you need to add" — https://developers.google.com/search/docs/appearance/ai-features (verified 2026-08-21). A matched difference-in-differences study of 1,885 pages that added JSON-LD against ~4,000 controls found no citation uplift on any AI platform (AI Mode +2.4%, ChatGPT +2.2% — both indistinguishable from noise; AI Overviews −4.6%) — https://ahrefs.com/blog/schema-ai-citations/ (verified 2026-08-21)
