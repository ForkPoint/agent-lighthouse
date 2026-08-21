---
audit: meta-tags/rss-feed-link
audit_id: "4.16"
category: meta-tags
source_file: packages/core/src/audits/meta-tags/rss-feed-link.ts
slug: rss-feed-link
review_verdict: fix
severity: high
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# rss-feed-link (`4.16`)

> meta-tags · source `rss-feed-link.ts` · review verdict **fix** · evidence grade **C** · disposition: **keep — fix required**

## What it checks

AI agents use RSS feeds to efficiently monitor your site for new content without re-crawling every page. Without an RSS link, agents must perform expensive full-site crawls to detect updates, meaning your new content takes longer to appear in AI-generated answers.

## Code review findings (2026-08-20, 11-agent pass)

Sound signal, but the type match is so narrow that it produces a high-volume false failure: it recognizes only `application/rss+xml` and therefore reports 'No RSS feed link found' on every site that publishes an Atom or JSON Feed — which includes Blogger, most Hugo/Jekyll/Eleventy defaults, and a large share of static-site-generated blogs. It also fails brochure sites that have no content stream at all, where a feed is genuinely meaningless.

**Required fix:** 1) Widen the type set: `l.type === 'application/rss+xml'` must also accept `application/atom+xml`, `application/feed+json`, `application/json` when the href looks like a feed, and `application/rss+xml; charset=utf-8` (strip MIME parameters at `;`). Today an Atom-only site — a very large population — gets a 'medium' priority hard fail while being perfectly discoverable. 2) Normalize `rel`: exact `l.rel === 'alternate'` rejects `rel="Alternate"` and multi-token rel values. 3) Return `notApplicable()` for sites with no periodic content (no blog/news/article pages among `ctx.pages`) instead of failing them for lacking a feed they have no use for. 4) Prefer feeds discovered in `ctx.rootFiles` (/feed, /rss.xml, /atom.xml) before failing on the head-link alone. 5) Iterate `ctx.pages` — feeds are often declared on the blog index, not the homepage.

**False-positive risks:**
- Atom feeds are invisible: `l.type === 'application/rss+xml'` is the only accepted value, so `<link rel="alternate" type="application/atom+xml" href="/atom.xml">` — the default output of Blogger, Hugo, Jekyll and many others — is reported as 'No RSS feed link found in <head>' at medium priority. This is probably the highest-frequency false failure in the whole category.
- JSON Feed (`application/feed+json`) likewise unrecognized.
- Charset parameter breaks the match: `type="application/rss+xml; charset=UTF-8"` fails the exact comparison.
- `rel="Alternate"` / `rel="alternate home"` fail the exact `l.rel === 'alternate'` test.
- Brochure/SaaS marketing sites with no periodic content are failed for lacking a feed that would have nothing to publish — the audit has no applicability gate.
- Only `ctx.pages[0]` is examined; many sites declare the feed on /blog rather than on the homepage, so a site with correct autodiscovery on its blog index fails.
- `extractHeadLinks` scans the whole document, so a feed link in a footer widget counts as head autodiscovery when crawlers would not treat it that way.
- No verification the feed URL resolves — a dangling `/feed.xml` passes.

**Test gaps:**
- No Atom feed test — the single most impactful gap, and the reason the narrow type match survived review.
- No JSON Feed test.
- No charset-parameter MIME test.
- No uppercase/multi-token `rel` test.
- No multi-page test (feed declared on /blog, not /).
- No no-content-stream site test that should be `na`.
- No dangling-feed-URL test.

**Overlaps with:** _none_

## Evidence

### Signal: RSS/Atom feed link tag (<link rel="alternate" type="application/rss+xml">) — grade C (meta-head)

**Mechanism:** A feed autodiscovery <link> in the head gives AI crawlers and agents a machine-readable index of recent content, improving discovery and recrawl freshness. Falsifiable: no AI vendor documents autodiscovering feeds from the head, and the one documented feed consumer requires the feed to be submitted as a sitemap instead.

**Evidence:** Autodiscovery is a stable, near-universally deployed convention (RSS Advisory Board, in use since 2002) with real aggregator consumers. Google does accept feeds as a content-discovery format: "Google accepts RSS 2.0 and Atom 1.0 feeds" as a sitemap type, with the caveat that "this feed only provides information on recent URLs."

**Counter-evidence:** The consumption path Google documents is sitemap submission or robots.txt reference — not the head-level autodiscovery link, which no vendor documents crawling. Searches for any AI assistant (ChatGPT/Pulse, NotebookLM, Perplexity, Copilot) documenting RSS autodiscovery returned nothing primary. OpenAI's, Anthropic's and Perplexity's crawler docs never mention feeds. Report the feed link as a freshness-discovery nicety and, where the site has a feed, recommend the evidenced path (list it as a sitemap) rather than scoring the head link as an AI signal.
**Consumers:** Browsers and feed aggregators (per RSS Advisory Board), Googlebot — but only for a feed submitted/referenced as a sitemap, not via the head link, none-known for any AI answer engine · **Recommended tier:** informative

**Sources:** [RSS Autodiscovery](https://www.rssboard.org/rss-autodiscovery) · [Build and submit a sitemap (accepted formats)](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) · [Overview of OpenAI Crawlers](https://developers.openai.com/api/docs/bots) · [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) · [Perplexity Crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
