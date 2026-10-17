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

Excessive Crawl-delay values (over 10 seconds) dramatically slow AI indexing, meaning your latest content may take days or weeks to appear in AI search results.

## Evidence

### Signal: Crawl-delay directive in robots.txt — grade C (robots-ai-crawlers)

**Mechanism:** A Crawl-delay line throttles fetch rate only for the specific crawlers that implement it. It is not part of RFC 9309, and the largest consumers explicitly do not support it. Its presence cannot be scored as a general readiness improvement.

**Evidence:** Support is genuinely split and each side is vendor-documented. Supporting: Anthropic explicitly names support for the 'Crawl-delay extension to robots.txt' for its bots; You.com states 'YouBot fully respects robots.txt directives, including user-agent specific rules and crawl-delay settings'. Not supporting: Google states 'Google supports the following fields (other fields such as crawl-delay aren't supported)' — only user-agent, allow, disallow and sitemap; Amazon states of Amazonbot 'They do not support the crawl-delay directive.'

**Counter-evidence:** RFC 9309 defines no crawl-delay directive at all — the only accommodation is §2.2.4, which merely permits crawlers to 'interpret other records that are not part of the robots.txt protocol'. There is no interoperable value semantics (seconds vs. requests-per-second is unspecified), no vendor consensus, and the two highest-volume AI crawlers in Cloudflare's data (GPTBot, ClaudeBot's operator aside) publish no crawl-delay commitment. OpenAI, Perplexity, Meta, Mistral and DuckDuckGo document no crawl-delay support in either direction. A crawl-delay line is at best a per-vendor hint; never score its presence or absence.
