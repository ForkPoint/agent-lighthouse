---
audit: access-crawl-control/crawl-delay
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/crawl-delay.ts
slug: crawl-delay
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: informative
consumers:
  - ClaudeBot / Claude-User / Claude-SearchBot (Anthropic)
  - YouBot
  - Bingbot (historical)
signals:
  - name: Crawl-delay directive in robots.txt
    grade: C
    domain: robots-ai-crawlers
sources:
  - rfc9309
  - google-robots-txt-spec
  - amazonbot-docs
  - anthropic-crawlers
  - youbot-docs
---

# crawl-delay (`2.24`)

> crawler-permissions · source `crawl-delay.ts` · review verdict **fix** · evidence grade **C** · disposition: **keep — fix required**

## What it checks

The `Crawl-delay` values a site's robots.txt sets, and whether any is above 10 seconds. Only the crawlers that implement the directive slow down for it. Anthropic documents support for it; Google and Amazon document that they ignore it.

| State                               | Result                  |
| :---------------------------------- | :---------------------- |
| no robots.txt                       | `na`                    |
| robots.txt sets no `Crawl-delay`    | `na`                    |
| every `Crawl-delay` is 10 s or less | `pass`                  |
| any `Crawl-delay` is above 10 s     | `fail`, priority `high` |

The audit is informative and carries weight 0, so no verdict changes a score. The directive is not part of RFC 9309, so its absence is not a defect.

## Evidence

### Signal: Crawl-delay directive in robots.txt — grade C (robots-ai-crawlers)

**Mechanism:** A Crawl-delay line throttles fetch rate only for the specific crawlers that implement it. It is not part of RFC 9309, and the largest consumers explicitly do not support it. Its presence cannot be scored as a general readiness improvement.

**Evidence:** Support is genuinely split and each side is vendor-documented. Supporting: Anthropic explicitly names support for 'the non-standard Crawl-delay extension to robots.txt' for its bots (https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler, verified 2026-10-17); You.com states 'YouBot fully respects robots.txt directives, including user-agent specific rules and crawl-delay settings'. Not supporting: Google states 'Google supports the following fields (other fields such as crawl-delay aren't supported)' — only user-agent, allow, disallow and sitemap (https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt, verified 2026-10-17); Amazon states of Amazonbot 'They do not support the crawl-delay directive.'

**Counter-evidence:** RFC 9309 defines no crawl-delay directive at all — the only accommodation is §2.2.4, which merely permits crawlers to 'interpret other records that are not part of the robots.txt protocol'. There is no interoperable value semantics (seconds vs. requests-per-second is unspecified), no vendor consensus, and the two highest-volume AI crawlers in Cloudflare's data (GPTBot, ClaudeBot's operator aside) publish no crawl-delay commitment. OpenAI, Perplexity, Meta, Mistral and DuckDuckGo document no crawl-delay support in either direction. A crawl-delay line is at best a per-vendor hint; never score its presence or absence.

## Implementation deviations

- A missing robots.txt and a robots.txt with no `Crawl-delay` are not applicable. Both used to warn or pass, which judged a directive that was not there.
