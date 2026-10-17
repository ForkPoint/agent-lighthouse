---
audit: machine-discovery/ai-crawler-surface-reachability
category: machine-discovery
source_file: packages/core/src/audits/machine-discovery/ai-crawler-surface-reachability.ts
slug: ai-crawler-surface-reachability
evidence_grade: A
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-22"
reviewed: 2026-08-20
graduated: 2026-08-22
sources:
  - s18
  - openai-searchbot-ips
  - sitemaps-protocol
  - rfc9309
---

# AI-crawler reachability of advertised discovery surfaces

> Shipped in v2. Evidence grade **A** · scored tier · unique · implementation: `multi-page`

## What it checks

Evaluates robots.txt per named AI user-agent against the exact URLs the site advertises for indexing: the Sitemap: targets, the autodiscovered RSS and Atom feeds, and a sample of URLs listed inside the sitemap. It flags the self-contradiction of advertising a discovery surface that the same file forbids.

## Claimed mechanism (falsifiable)

The robots.txt Sitemap: directive is host-global and user-agent independent. But the sitemap file itself, the feed files, and every URL they list are subject to per-UA Disallow rules. Under the group-matching rule, a crawler that matches a named group ignores the '_' group entirely. OpenAI documents the consequence at the extreme: 'Sites that are opted out of OAI-SearchBot will not be shown in ChatGPT search answers.' Falsifiable claim: take any UA whose named group disallows the advertised sitemap or feed path, or a majority of the URLs it lists. The site's entire pull-indexing surface is then unreachable by that agent, however good the sitemap is. The high-frequency real-world trigger is a broad pattern (Disallow: /_.xml$, Disallow: /feed/, Disallow: /) added to an AI-bot group by a bot-blocking plugin while the site simultaneously advertises those exact paths.

## Evidence

- **[OpenAI Bots / Crawler documentation](https://developers.openai.com/api/docs/bots)** — OpenAI (vendor-doc, URL verified 2026-08-20)
  - Four distinct user agents, with separate robots.txt tokens and separate published IP-range files. OAI-SearchBot surfaces sites in ChatGPT search — https://openai.com/searchbot.json. OAI-AdsBot validates ad landing pages — https://openai.com/adsbot.json. GPTBot handles model training — https://openai.com/gptbot.json, ChatGPT-User (user-initiated actions: web visits and GPT Actions — https://openai.com/chatgpt-user.json). ChatGPT-User is the agent that fetches on a shopper's behalf. Crucially these are separately controllable: blocking GPTBot does not block OAI-SearchBot or ChatGPT-User, and vice versa.
- **[Sitemaps XML format — protocol](https://www.sitemaps.org/protocol.html)** — sitemaps.org (spec, URL verified 2026-08-20)
  - lastmod must be W3C Datetime (YYYY-MM-DD or full timestamp). Path-scope rule. A sitemap at /catalog/sitemap.xml may only list URLs under /catalog/. All URLs must share protocol and host with the sitemap. A file is capped at 50,000 URLs and 50MB (52,428,800 bytes). An index file is capped at 50,000 sitemaps, and may only reference sitemaps on the same site.
- **[RFC 9309 — Robots Exclusion Protocol](https://www.rfc-editor.org/rfc/rfc9309.html)** — IETF (spec, URL verified 2026-08-20)
  - §2.2.1: 'Crawlers MUST use case-insensitive matching to find the group that matches the product token and then obey the rules of the group.' Groups matching the same token are combined. Critically: 'If no matching group exists, crawlers MUST obey the group with a user-agent line with the "*" value, if present.' The wildcard group is a fallback only — it is never merged with a named group. A named AI-bot group therefore fully shadows every wildcard rule.

## Example failure

A WordPress site installs a bot-blocking plugin that appends `User-agent: GPTBot\nUser-agent: PerplexityBot\nDisallow: /*.xml$`. robots.txt still ends with `Sitemap: https://example.com/sitemap_index.xml`. The site owner believes AI crawlers are only blocked from training. In fact both agents are barred from the one file the site points them at. Because a named group matched, the permissive '*' group is ignored. All sitemap URL discovery is lost for those agents — while every conventional SEO audit reports robots.txt and sitemap as healthy.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Implementation deviations

- **Subpath sitemap scope.** On a subpath homepage, the shared sitemap gatherer
  treats that directory as the site root. It keeps only same-origin URLs under
  it, before the entry cap and sampling. Origin files, probes and feed
  discovery keep origin scope.
- **The quoted line is the deciding rule.** `decidingRule` in
  `gatherers/robots.ts` returns the winning rule, and `isPathAllowed` is built
  on it. The quoted `Disallow:` line cannot disagree with the verdict.
- **Deterministic sample.** `sampleEntries` takes an even stride of 50 sitemap
  URLs, so runs are reproducible.
- **The coverage floor is a share of that sample**, not of the whole tree. The
  finding reports the sample size.
- **Feeds come from `page.headLinks` on every scanned page**, not only the
  homepage and one article.
- **Only on-site surfaces are judged.** A `Sitemap:` value or feed on another
  host is dropped, since this robots.txt does not govern it.
- **`Disallow` outside a group is ignored**, as RFC 9309 requires.
