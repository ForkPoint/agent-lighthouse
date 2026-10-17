---
audit: access-crawl-control/perplexitybot
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/perplexitybot.ts
slug: perplexitybot
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: scored
consumers:
  - PerplexityBot
signals:
  - name: PerplexityBot allow/block state in robots.txt
    grade: A
    domain: robots-ai-crawlers
sources:
  - rfc-9309
  - perplexity-bots-docs
  - cloudflare-ai-crawler-purpose-industry
---

# perplexitybot (`2.4`)

> crawler-permissions · source `perplexitybot.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Reads the robots.txt rules that apply to PerplexityBot — its own group if it has one, otherwise the catch-all — and reports whether they let it fetch the site root. A named group is not required: under RFC 9309 §2.2.1 an open catch-all grants the same access.

## Evidence

### Signal: PerplexityBot allow/block state in robots.txt — grade A (robots-ai-crawlers)

**Mechanism:** Allowing PerplexityBot is required for the site to be indexed and cited in Perplexity search results; disallowing it removes the site from Perplexity's index. Perplexity states the crawl is not used for model training.

**Grade: A** — Perplexity publishes an explicit allow-side recommendation: "To ensure your site appears in search results, we recommend allowing PerplexityBot in your site's robots.txt file." It publishes the user agent and an IP list alongside it, and states that the crawl is "not used for AI model training". Vendor documentation of a named token and its effect is grade A. Enforcement is a separate question the audit does not overstate: Perplexity was publicly accused in 2025 of crawling from undeclared agents and rotating addresses, so a disallow here is a declaration rather than a guarantee.

**Evidence:** Perplexity documents an explicit allow-side recommendation: 'To ensure your site appears in search results, we recommend allowing PerplexityBot in your site's robots.txt file'. The UA is 'PerplexityBot/1.0; +https://perplexity.ai/perplexitybot', and IPs at perplexity.com/perplexitybot.json, and states it is 'not used for AI model training'. Perplexity also has by far the best crawl-to-refer ratio of the major AI operators in Cloudflare Radar's data: 118:1 overall, and 32.7:1 in News & Publications, against OpenAI at 887:1 and Anthropic at about 50,000:1. An allow here returns more actual referral traffic per page crawled than any other AI operator.

**Counter-evidence:** Perplexity has been publicly accused of crawling from undeclared user agents and rotating IPs to evade blocks (a widely reported 2025 dispute), so a PerplexityBot disallow may not be sufficient to prevent access. Independent 2026 reporting also indicates Perplexity's crawl-to-refer ratio has worsened (~225:1), eroding the referral argument. The 'not used for training' claim is vendor-asserted and unverifiable externally.

## Implementation deviations

The shared base class `_crawler-bot-audit.ts` grades access, not the shape of the file.

- The audit passes when the rules that apply to PerplexityBot permit `/`: its own group, the catch-all, or no applicable group. Under RFC 9309 §2.2.1 an open catch-all grants the same access a named group would.
- The message names which of the three applied. A disallow that reaches the token fails.
- An unreadable robots.txt is not applicable: missing, non-200, an empty body, or a 200 that parses to no groups and no sitemaps. RFC 9309 §2.3.1.3 lets a crawler access everything when the file is unavailable.
- The fail remedy warns that a named `Allow: /` group replaces the catch-all for that bot and drops its catch-all `Disallow` lines.

## Deferred

- **A 5xx robots.txt.** RFC 9309 §2.3.1.4 tells a crawler to assume a complete
  disallow when robots.txt is unreachable. This audit reports any non-200 as
  not applicable and does not grade that case.
