---
check: ai-crawler-reachability-of-advertised-discovery-surfaces
title: "AI-crawler reachability of advertised discovery surfaces"
domain: feeds-indexing
status: proposed
evidence_grade: A
uniqueness: unique
difficulty: multi-page
scoring_tier: scored
reviewed: 2026-08-20
---

# AI-crawler reachability of advertised discovery surfaces

> Proposed check. Evidence grade **A** · unique · implementation: `multi-page`

## What it checks

Evaluates robots.txt per named AI user-agent against the exact URLs the site advertises for indexing — the Sitemap: targets, the autodiscovered RSS/Atom feeds, and a sample of URLs listed inside the sitemap — and flags the self-contradiction of advertising a discovery surface that the same file forbids.

## Claimed mechanism (falsifiable)

The robots.txt Sitemap: directive is host-global and user-agent independent, but the sitemap file itself, the feed files, and every URL they list are subject to per-UA Disallow rules, and under the group-matching rule a crawler that matches a named group ignores the '*' group entirely. OpenAI documents the consequence at the extreme: 'Sites that are opted out of OAI-SearchBot will not be shown in ChatGPT search answers.' Falsifiable claim: for any UA whose named group disallows the advertised sitemap/feed path or a majority of the URLs it lists, the site's entire pull-indexing surface is unreachable by that agent regardless of sitemap quality. The high-frequency real-world trigger is a broad pattern (Disallow: /*.xml$, Disallow: /feed/, Disallow: /) added to an AI-bot group by a bot-blocking plugin while the site simultaneously advertises those exact paths.

## Evidence

- **[OpenAI Bots / Crawler documentation](https://developers.openai.com/api/docs/bots)** — OpenAI (vendor-doc, URL verified 2026-08-20)
  - Four distinct user agents with separate robots.txt tokens and separate published IP-range files: OAI-SearchBot (surfaces sites in ChatGPT search — https://openai.com/searchbot.json), OAI-AdsBot (validates ad landing pages — https://openai.com/adsbot.json), GPTBot (model training — https://openai.com/gptbot.json), ChatGPT-User (user-initiated actions: web visits and GPT Actions — https://openai.com/chatgpt-user.json). ChatGPT-User is the agent that fetches on a shopper's behalf. Crucially these are separately controllable: blocking GPTBot does not block OAI-SearchBot or ChatGPT-User, and vice versa.
- **[Sitemaps XML format — protocol](https://www.sitemaps.org/protocol.html)** — sitemaps.org (spec, URL verified 2026-08-20)
  - lastmod must be W3C Datetime (YYYY-MM-DD or full timestamp). Path-scope rule: a sitemap at /catalog/sitemap.xml may only list URLs under /catalog/; all URLs must share protocol and host with the sitemap. 50,000 URLs / 50MB (52,428,800 bytes) per file; index files limited to 50,000 sitemaps and may only reference sitemaps on the same site.
- **[RFC 9309 — Robots Exclusion Protocol](https://www.rfc-editor.org/rfc/rfc9309.html)** — IETF (spec, URL verified 2026-08-20)
  - §2.2.1: 'Crawlers MUST use case-insensitive matching to find the group that matches the product token and then obey the rules of the group.' Groups matching the SAME token are combined. Critically: 'If no matching group exists, crawlers MUST obey the group with a user-agent line with the "*" value, if present.' The wildcard group is a fallback only — it is never merged with a named group. A named AI-bot group therefore fully shadows every wildcard rule.

## Competitor coverage

SEO crawlers evaluate robots.txt against Googlebot/Bingbot and report AI-bot directives as a flat list of blocked agents; none evaluate the advertised sitemap and feed URLs, or a sample of sitemap contents, per AI user-agent, and none detect the Sitemap-advertised-but-Disallowed contradiction. Lighthouse's agentic category checks llms.txt and WebMCP, not per-UA robots resolution over discovery surfaces.

## Implementation sketch

1) Fetch /robots.txt; parse into UA groups with correct longest-match group selection and longest-match rule precedence, including $ and * wildcards, and record whether a named group exists per UA (named group present => '*' rules do not apply). 2) UA panel: GPTBot, OAI-SearchBot, OAI-AdsBot, ChatGPT-User, ClaudeBot, Claude-User, Claude-SearchBot, PerplexityBot, Perplexity-User, Google-Extended, Googlebot, Bingbot, Amazonbot, Applebot-Extended, meta-externalagent, CCBot, Bytespider. 3) Collect advertised surfaces: every Sitemap: URL, /sitemap.xml, and every <link rel="alternate" type="application/rss+xml|application/atom+xml|application/feed+json"> href on the homepage and on one article page. 4) Reservoir-sample 50 URLs from the sitemap tree. 5) For each UA emit: sitemap_file_allowed (bool), feed_files_allowed (bool per feed), sitemap_url_coverage (% of the 50 allowed). 6) FAIL conditions: any UA where a Sitemap: directive advertises a path that the same robots.txt disallows for that UA (explicit self-contradiction — report the exact conflicting lines); any UA in the panel with sitemap_url_coverage < 50% while the '*' group would have allowed them (i.e. the named group is strictly more restrictive); any feed advertised via <link rel=alternate> but disallowed. 7) WARN when a named AI group exists with Disallow: / — that is a deliberate opt-out, so report it as a policy statement, not a defect, and suppress downstream AI-readiness scoring for that agent.

## Example failure

A WordPress site installs a bot-blocking plugin that appends `User-agent: GPTBot\nUser-agent: PerplexityBot\nDisallow: /*.xml$`. robots.txt still ends with `Sitemap: https://example.com/sitemap_index.xml`. The site owner believes AI crawlers are only blocked from training. In fact both agents are barred from the one file the site points them at, and because a named group matched, the permissive '*' group is ignored — so 100% of sitemap URL discovery is lost for those agents while every conventional SEO audit reports robots.txt and sitemap as healthy.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
