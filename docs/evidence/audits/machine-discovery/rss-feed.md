---
audit: machine-discovery/rss-feed
audit_id: "1.11, 4.16"
category: machine-discovery
source_file: packages/core/src/audits/machine-discovery/rss-feed.ts
slug: rss-feed
review_verdict: fix
severity: medium
evidence_grade: B
disposition: "merged 2026-08-22 (Plan 4, Task 4) — absorbs rss-feed-link (4.16)"
reviewed: 2026-08-22
---

# rss-feed (`1.11`)

> machine-discovery · source `rss-feed.ts` · absorbs rss-feed-link (4.16) · evidence grade **B** · tier **scored** (weight 0.6)

## What it checks

Whether the site publishes a reachable RSS/Atom feed — discovered from the `<head>` autodiscovery links of every scanned page, then from the well-known paths (`/rss.xml`, `/feed.xml`, `/atom.xml`). The autodiscovery link's own state is appended to `found` (`autodiscovery <link> present (<url>)` or `no autodiscovery <link> in <head>`); it is reported, never scored on its own.

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

**Sources:** [Build and Submit a Sitemap | Google Search Central](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) (verified 2026-08-20) · [About Applebot — archived snapshot, 2 March 2025 (Wayback Machine)](https://web.archive.org/web/20250302012726/https://support.apple.com/en-us/119829) (verified 2026-08-20) · [NLWeb — reference implementation](https://github.com/nlweb-ai/NLWeb) (verified 2026-08-20) · [RFC 4287 — The Atom Syndication Format](https://www.rfc-editor.org/rfc/rfc4287.html) (verified 2026-08-20) · [Ecommerce Pagination and Incremental Page Loading | Google Search Central](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading) (verified 2026-08-20) · [Product Feed Spec — Agentic Commerce | OpenAI Developers](https://developers.openai.com/commerce/specs/feed) (verified 2026-08-20) · [About Applebot](https://support.apple.com/en-us/119829) (verified 2026-08-20) · [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots) (verified 2026-08-20) · [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518) (verified 2026-08-20)

## Absorbed evidence — rss-feed-link (4.16)

4.16 checked for `<link rel="alternate" type="application/rss+xml">` in the head. That is this audit's first discovery step, so the C3 collapse makes them one audit: the reachable feed is the signal, the autodiscovery link is how it is advertised.

Its dossier is kept verbatim at [merged/machine-discovery/rss-feed-link.md](../../merged/machine-discovery/rss-feed-link.md) (grade **C**).

### Grade decision: stays **B**

4.16 graded **C**: autodiscovery is a stable convention with browser and aggregator consumers, but the only documented *Google* consumption path for a feed is submitting it as a sitemap, and no AI vendor documents crawling the head-level link — "none-known for any AI answer engine". The target's own signal (a published, reachable feed as an ingestion surface) grades **B**. Weaker evidence, and not proven for the merged signal, so the audit keeps **B**, `tier: scored`, `weight 0.6`.

Consequently the link never decides the result on its own: a site with a reachable feed and no `<link>` passes, and a site with a `<link>` but no reachable feed fails.

### Required fixes from 4.16 — landed 2026-08-22

- **Atom and JSON Feed are feeds.** `type === 'application/rss+xml'` was the only accepted value, so Blogger/Hugo/Jekyll defaults (`application/atom+xml`) and JSON Feed sites were reported as having no feed link — the review calls it "probably the highest-frequency false failure in the whole category". The type set now covers rss, atom, feed+json and rdf+xml.
- **MIME parameters stripped.** `application/rss+xml; charset=UTF-8` no longer misses.
- **Normalized `rel`.** `rel="Alternate"` and WordPress' multi-token `rel="alternate home"` are accepted (this also fixes the same defect in 1.11's own discovery).
- **Every page inspected.** v1 4.16 read `ctx.pages[0]` only, so a feed declared on the blog index and not the homepage was invisible.
- **Relative hrefs resolved.** 1.11 resolved `/`-prefixed hrefs only; `feed.xml` and `./rss` are now resolved with `new URL(href, page.url)`.

Not addressed by this fold (they belong to 1.11's own "fix required" backlog, not to the merge): validating that the feed body parses as XML before passing, the extra candidate paths (`/feed/`, `/index.xml`, `/rss`), the shared `_feed.ts` with rss-feed-content, and returning `na` for sites with no periodic content.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources) on both source audits.
- 2026-08-21 — dispositions approved: 1.11 keep-with-fixes, 4.16 folds in (C3 collapse).
- 2026-08-22 — 4.16 folded in with its required fixes (Plan 4, Task 4); registry 171 → 170.
