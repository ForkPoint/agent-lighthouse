---
audit: content-discoverability/rss-feed
audit_id: "1.11"
category: content-discoverability
source_file: packages/core/src/audits/content-discoverability/rss-feed.ts
slug: rss-feed
review_verdict: fix
severity: medium
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# rss-feed (`1.11`)

> content-discoverability · source `rss-feed.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

## What it checks

RSS/Atom feeds let AI agents track new and updated content without re-crawling your entire site.

## Code review findings (2026-08-20, 11-agent pass)

Looks for a feed via <link rel=alternate> then /rss.xml, /feed.xml, /atom.xml. Feeds remain a genuine freshness channel, so the signal is worth keeping — but discovery uses exact case-sensitive string equality on rel/type, only resolves '/'-prefixed hrefs, and passes on a bare 200 with zero validation that the body is a feed. It also fails brochure sites that have no periodic content and for which a feed is meaningless.

**Required fix:** Extract `findFeedResult()` into a shared `_feed.ts` used by 1.11 and 1.12 (one discovery pass per scan). Tokenize and lowercase rel, match type by prefix, and resolve hrefs with `new URL(href, page.url)`. Add `/feed/`, `/index.xml`, `/rss`, `/feed.atom` to the candidate list. Require the body to parse as XML with an `<rss>`/`<feed>`/`<rdf:RDF>` root before passing. Return notApplicable when no article/blog-type pages were scanned.

**False-positive risks:**
- `link.rel === 'alternate'` — `extractHeadLinks()` does not lowercase or tokenize rel, so `rel="Alternate"`, `rel="alternate home"` (WordPress emits multi-token rels) miss entirely.
- `link.type === 'application/rss+xml'` exact — `application/rss+xml; charset=utf-8`, `application/atom+xml;charset=UTF-8`, `text/xml` and `application/xml` all miss.
- `if (feedUrl.startsWith('/')) feedUrl = baseUrl + feedUrl` — hrefs like `feed.xml`, `./rss`, or `../feed` are passed unresolved to ctx.fetch and fail. Should be `new URL(link.href, page.url)`.
- No content validation: a 200 HTML soft-404 at /rss.xml (SPA catch-all) yields PASS 'RSS/Atom feed found at https://…/rss.xml'.
- Common real paths are missing: `/feed/`, `/blog/rss.xml`, `/index.xml` (Hugo), `/feed.atom`, `/rss` — a Hugo or WordPress site with a working feed is reported as having none.
- No page-type gating: a single-page brochure or SaaS landing site with no periodic content is failed at medium priority for lacking a feed, which improves nothing.
- Fires an extra live /atom.xml request even after rootFiles already answered, and audit 1.12 repeats the whole discovery independently — duplicate load on the scanned origin.

**Test gaps:**
- rel="alternate home" / rel="Alternate" (multi-token, mixed case)
- type with a charset parameter
- Relative href without a leading slash ('feed.xml', './rss')
- 200 HTML soft-404 at /rss.xml — currently a false PASS
- Hugo /index.xml and WordPress /feed/ paths
- A site with no blog at all (should be N/A, currently FAIL)

**Overlaps with:** `1.12`

## Evidence

### Signal: RSS/Atom feed published (with autodiscovery link) as an AI content-ingestion surface — grade B (discovery-infra)

**Mechanism:** Publishing an RSS 2.0 or Atom 1.0 feed gives crawlers and AI ingestion pipelines a low-cost, change-ordered surface for detecting new and updated content, accelerating discovery of new URLs relative to full-site re-crawl. Falsifiable: if no AI-serving crawler ever fetches the feed and new-URL discovery latency is unchanged with the feed present vs absent, the claim fails.

**Evidence:** Google's sitemap documentation states outright that 'Google accepts RSS 2.0 and Atom 1.0 feeds' as valid sitemap formats alongside XML and mRSS — meaning a feed is not merely a syndication artifact but a first-class, vendor-documented URL-discovery channel into the index that gates AI Overviews and AI Mode eligibility. Apple's archived Applebot page independently listed 'RSS feeds' among the resources Applebot accesses. Microsoft's NLWeb project builds its ingestion layer directly on feeds, arguing that 'Schema.org and related semi-structured formats like RSS — used by over 100 million websites — have become not just de facto syndication mechanisms, but also a semantic layer for the web', and its tooling consumes RSS alongside JSON-LD and XML sitemaps while exposing the result over MCP. Atom itself is a ratified IETF Standards Track specification (RFC 4287), so the format carries no interoperability risk. Google's own pagination guidance also recommends 'sitemaps or feeds' as the fallback when JavaScript-driven navigation is not crawlable.

**Counter-evidence:** No LLM vendor — OpenAI, Anthropic, or Perplexity — documents consuming RSS or Atom feeds anywhere. Apple's current June 2026 Applebot page dropped the RSS mention entirely. OpenAI's Agentic Commerce product feed spec goes further and explicitly excludes syndication formats: 'JSON, spreadsheet, XML, RSS, and Atom sources are not part of this compatibility path.' NLWeb adoption remains negligible in absolute terms. RFC 4287 does not itself define HTML <link rel=alternate> autodiscovery, so the autodiscovery half of this audit rests on convention rather than the ratified spec. Net: the feed is a documented discovery input for Google and (historically) Apple, but there is no evidence any LLM ingests feeds directly.
**Consumers:** Googlebot (accepts RSS 2.0 and Atom 1.0 as sitemap formats), Applebot (per archived Apple documentation), NLWeb / MCP-exposed site agents · **Recommended tier:** scored

**Sources:** [Build and Submit a Sitemap | Google Search Central](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) · [About Applebot — archived snapshot, 2 March 2025 (Wayback Machine)](https://web.archive.org/web/20250302012726/https://support.apple.com/en-us/119829) · [NLWeb — reference implementation](https://github.com/nlweb-ai/NLWeb) · [RFC 4287 — The Atom Syndication Format](https://www.rfc-editor.org/rfc/rfc4287.html) · [Ecommerce Pagination and Incremental Page Loading | Google Search Central](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading) · [Product Feed Spec — Agentic Commerce | OpenAI Developers](https://developers.openai.com/commerce/specs/feed) · [About Applebot](https://support.apple.com/en-us/119829) · [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots) · [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
