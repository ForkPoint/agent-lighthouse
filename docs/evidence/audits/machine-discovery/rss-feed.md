---
audit: machine-discovery/rss-feed
category: machine-discovery
source_file: packages/core/src/audits/machine-discovery/rss-feed.ts
slug: rss-feed
evidence_grade: B
disposition: "merged 2026-08-22 (Plan 4, Task 4) — absorbs rss-feed-link (4.16)"
reviewed: 2026-08-22
recommended_tier: scored
consumers:
  - Googlebot (accepts RSS 2.0 and Atom 1.0 as sitemap formats)
  - Applebot (per archived Apple documentation)
  - NLWeb / MCP-exposed site agents
signals:
  - name: RSS/Atom feed published (with autodiscovery link) as an AI content-ingestion surface
    grade: B
    domain: discovery-infra
sources:
  - google-sitemap-formats
  - apple-applebot-archived-2025
  - nlweb-repo-howto
  - rfc-4287-atom
  - google-pagination-ecommerce
  - openai-feed-spec-confirm
  - applebot-doc
  - s18
  - anthropic-crawler-docs
---

# rss-feed (`1.11`)

> machine-discovery · source `rss-feed.ts` · absorbs rss-feed-link (4.16) · evidence grade **B** · tier **scored** (weight 0.6)

## What it checks

Whether the site publishes a reachable RSS/Atom feed — discovered from the `<head>` autodiscovery links of every scanned page, then from the well-known paths (`/rss.xml`, `/feed.xml`, `/atom.xml`). The autodiscovery link's own state is appended to `found` (`autodiscovery <link> present (<url>)` or `no autodiscovery <link> in <head>`); it is reported, never scored on its own.

## Evidence

### Signal: RSS/Atom feed published (with autodiscovery link) as an AI content-ingestion surface — grade B (discovery-infra)

**Mechanism:** Publishing an RSS 2.0 or Atom 1.0 feed gives crawlers and AI ingestion pipelines a low-cost, change-ordered surface for detecting new and updated content, accelerating discovery of new URLs relative to full-site re-crawl. Falsifiable: if no AI-serving crawler ever fetches the feed and new-URL discovery latency is unchanged with the feed present vs absent, the claim fails.

**Grade: B** — One documented consumer, stated plainly. Google's sitemap documentation says "Google accepts RSS 2.0 and Atom 1.0 feeds" as valid sitemap formats. That makes a feed a first-class URL-discovery channel into the index behind AI Overviews, not a syndication artifact. Nothing stronger exists. No LLM vendor documents consuming feeds anywhere. Apple's June 2026 Applebot page dropped its RSS mention, and OpenAI's product feed specification excludes the format outright: "JSON, spreadsheet, XML, RSS, and Atom sources are not part of the spec." A real consumer with an explicit non-consumer beside it is grade B, so the audit informs rather than penalises.

**Evidence:** Google's sitemap documentation states outright that 'Google accepts RSS 2.0 and Atom 1.0 feeds' as valid sitemap formats, alongside XML and mRSS. A feed is therefore not merely a syndication artifact. It is a first-class, vendor-documented URL-discovery channel into the index that gates AI Overviews and AI Mode eligibility. Apple's archived Applebot page independently listed 'RSS feeds' among the resources Applebot accesses. Microsoft's NLWeb project builds its ingestion layer directly on feeds. It argues that 'Schema.org and related semi-structured formats like RSS — used by over 100 million websites — have become not just de facto syndication mechanisms, but also a semantic layer for the web'. Its tooling consumes RSS alongside JSON-LD and XML sitemaps, and exposes the result over MCP. Atom itself is a ratified IETF Standards Track specification (RFC 4287), so the format carries no interoperability risk. Google's own pagination guidance also recommends 'sitemaps or feeds' as the fallback when JavaScript-driven navigation is not crawlable.

**Counter-evidence:** No LLM vendor — OpenAI, Anthropic, or Perplexity — documents consuming RSS or Atom feeds anywhere. Apple's current June 2026 Applebot page dropped the RSS mention entirely. OpenAI's Agentic Commerce product feed spec goes further and explicitly excludes syndication formats: 'JSON, spreadsheet, XML, RSS, and Atom sources are not part of this compatibility path.' NLWeb adoption remains negligible in absolute terms. RFC 4287 does not itself define HTML <link rel=alternate> autodiscovery, so the autodiscovery half of this audit rests on convention rather than the ratified spec. Net: the feed is a documented discovery input for Google and (historically) Apple, but there is no evidence any LLM ingests feeds directly.

## Implementation deviations

- **Absorbs `rss-feed-link` (4.16).** Its dossier is kept at
  [merged/machine-discovery/rss-feed-link.md](../../merged/machine-discovery/rss-feed-link.md).
  Its C evidence is weaker, so the grade stays B.
- **The link never decides the result on its own.** A reachable feed with no
  `<link>` passes. A `<link>` with no reachable feed fails, and the message
  names the advertised URL.
- **No feed and no link is not applicable.** The grade says the audit informs
  rather than penalises. Advertising is the site's own statement that a feed
  exists, so no page-type gate is used.
- **Discovery comes from the shared `gatherers/feeds.ts`.** It reads every
  scanned page's head links, accepts rss, atom, feed+json and rdf+xml types,
  and counts only feeds that parse.
