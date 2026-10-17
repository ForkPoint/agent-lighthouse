---
audit: access-crawl-control/ccbot
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/ccbot.ts
slug: ccbot
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: scored
consumers:
  - CCBot
signals:
  - name: CCBot allow/block state in robots.txt
    grade: A
    domain: robots-ai-crawlers
sources:
  - rfc-9309
  - commoncrawl-ccbot
  - consent-in-crisis-arxiv
---

# ccbot (`2.6`)

> crawler-permissions · source `ccbot.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Reads the robots.txt rules that apply to CCBot — its own group if it has one, otherwise the catch-all — and reports whether they let it fetch the site root. A named group is not required: under RFC 9309 §2.2.1 an open catch-all grants the same access.

## Evidence

### Signal: CCBot allow/block state in robots.txt — grade A (robots-ai-crawlers)

**Mechanism:** Disallowing CCBot keeps the site out of the Common Crawl corpus. That corpus is the upstream source for C4, RefinedWeb and Dolma, and therefore for many LLM training sets. A block here has downstream training effects far beyond one operator.

**Grade: A** — Common Crawl publishes the exact user agent and the canonical opt-out snippet. The downstream leverage is measured rather than asserted. The Data Provenance Initiative's "Consent in Crisis" audited 14,000 domains. Within a single year, robots.txt restrictions had rendered "~5%+ of all tokens in C4, or 28%+ of the most actively maintained, critical sources in C4, fully restricted from use". A documented token with a measured corpus effect is grade A.

**Evidence:** Common Crawl publishes UA 'CCBot/2.0 (https://commoncrawl.org/faq/)' and the canonical opt-out snippet 'User-agent: CCBot / Disallow: /'. The training-corpus leverage is quantified by the Data Provenance Initiative's 'Consent in Crisis', which audited 14,000 domains. Within a single year (2023-2024), robots.txt restrictions rendered '~5%+ of all tokens in C4, or 28%+ of the most actively maintained, critical sources in C4, fully restricted from use'. CCBot is therefore the highest-leverage single token for training-data opt-out.

**Counter-evidence:** Blocking CCBot is retroactively useless — historical Common Crawl snapshots are already published and permanently redistributable, so a block only affects future crawls. Common Crawl warns that 'crawlers falsely identifying themselves as CCBot' exist, so a disallow does not stop spoofers; operators should verify by reverse DNS against published IP ranges. Common Crawl's own page states no crawl-delay position and does not frame itself as AI training infrastructure.

## Implementation deviations

The shared base class `_crawler-bot-audit.ts` grades access, not the shape of the file.

- The audit passes when the rules that apply to CCBot permit `/`: its own group, the catch-all, or no applicable group. Under RFC 9309 §2.2.1 an open catch-all grants the same access a named group would.
- The message names which of the three applied. A disallow that reaches the token fails.
- An unreadable robots.txt is not applicable: missing, non-200, an empty body, or a 200 that parses to no groups and no sitemaps. RFC 9309 §2.3.1.3 lets a crawler access everything when the file is unavailable.
- The fail remedy warns that a named `Allow: /` group replaces the catch-all for that bot and drops its catch-all `Disallow` lines.

## Deferred

- **A 5xx robots.txt.** RFC 9309 §2.3.1.4 tells a crawler to assume a complete
  disallow when robots.txt is unreachable. This audit reports any non-200 as
  not applicable and does not grade that case.
