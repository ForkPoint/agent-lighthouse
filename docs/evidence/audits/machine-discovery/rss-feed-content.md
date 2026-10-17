---
audit: machine-discovery/rss-feed-content
category: machine-discovery
source_file: packages/core/src/audits/machine-discovery/rss-feed-content.ts
slug: rss-feed-content
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - rss-content-module
  - rfc-4287-atom
  - google-sitemap-formats
  - rss-2-specification
  - s18
  - perplexity-crawlers-docs
  - google-ai-optimization-mythbusting
---

# rss-feed-content (`1.12`)

> content-discoverability · source `rss-feed-content.ts` · review verdict **fix** · evidence grade **C** · disposition: **keep — fix required**

## What it checks

Full-content feeds allow AI agents to index your articles without visiting each page, reducing crawl load and improving content quality in AI responses.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** A crawler that fetches a site's RSS or Atom feed ingests each item's `<content:encoded>` or `<atom:content>` as the article body, and therefore does not request the article page. When items carry only a truncated excerpt, the crawler must fetch every article individually.

**Grade: C** — full-text feed content is a published, widely implemented convention with real consumers in feed readers. But the only vendor that documents machine consumption of feeds is Google, and it documents reading them for URLs rather than for article bodies. No AI vendor documents ingesting article text from a feed.

**Evidence:**

- The RSS 1.0 content module defines `content:encoded` as "An element whose contents are the entity-encoded or CDATA-escaped version of the content of the item" — i.e. the item's full body carried inside the feed — https://web.resource.org/rss/1.0/modules/content/ (verified 2026-08-21)
- RFC 4287 (Atom Syndication Format, standards track, December 2005) defines `atom:content` as the entry's content element and constrains its cardinality — a ratified standard for the same signal — https://www.rfc-editor.org/rfc/rfc4287.html (verified 2026-08-21)
- Google documents machine consumption of feeds: "Google accepts RSS 2.0 and Atom 1.0 feeds" as sitemaps, so a named crawler demonstrably parses these documents — https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap (verified 2026-08-21)
- The RSS 2.0 specification acknowledges the full-content usage explicitly: "An item may also be complete in itself, if so, the description contains the text" — https://www.rssboard.org/rss-specification (verified 2026-08-21)

**Counter-evidence:** The strongest documented feed consumer reads feeds only as a source of recent URLs. Google's sitemap documentation describes RSS and Atom as providing "information about recent URLs", not article bodies. The claimed "index without visiting each page" path is therefore not documented for any named crawler (https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap, verified 2026-08-21). The RSS 2.0 spec blesses excerpt feeds as an equal, conformant choice: "its description is a synopsis of the story, and the link points to the full story". A truncated feed is therefore a publishing decision, not a defect (https://www.rssboard.org/rss-specification, verified 2026-08-21). RFC 4287 goes further: "the absence of atom:summary is not an error, and Atom Processors MUST NOT fail to function correctly as a consequence of such an absence" (https://www.rfc-editor.org/rfc/rfc4287.html, verified 2026-08-21). Neither OpenAI's (https://developers.openai.com/api/docs/bots) nor Perplexity's (https://docs.perplexity.ai/docs/resources/perplexity-crawlers) crawler documentation mentions feeds at all (both verified 2026-08-21), and Google states that no additional files or markup are needed for its AI features (https://developers.google.com/search/docs/fundamentals/ai-optimization-guide, verified 2026-08-21). The audit's 500-character bar has no source in any specification.
