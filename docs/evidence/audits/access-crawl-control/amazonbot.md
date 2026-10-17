---
audit: access-crawl-control/amazonbot
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/amazonbot.ts
slug: amazonbot
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: scored
consumers:
  - Amazonbot
  - Amzn-SearchBot
signals:
  - name: Amazonbot allow/block state in robots.txt
    grade: A
    domain: robots-ai-crawlers
sources:
  - rfc-9309
  - amazonbot-docs
  - cloudflare-ai-crawler-purpose-industry
---

# amazonbot (`2.8`)

> crawler-permissions · source `amazonbot.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Reads the robots.txt rules that apply to Amazonbot — its own group if it has one, otherwise the catch-all — and reports whether they let it fetch the site root. A named group is not required: under RFC 9309 §2.2.1 an open catch-all grants the same access.

## Evidence

### Signal: Amazonbot allow/block state in robots.txt — grade A (robots-ai-crawlers)

**Mechanism:** Disallowing Amazonbot stops Amazon crawling the site for product/service improvement and possible Amazon AI model training; Amazon states the bot honors user-agent and allow/disallow directives but ignores crawl-delay.

**Grade: A** — Amazon publishes a crawler page naming the exact product token. It states the purpose: "Amazonbot is used to improve our products and services", and content "may be used to train Amazon AI models". It asserts robots.txt compliance for that user agent. That is documented consumer behaviour for the directive this audit reads, which is the grade-A bar. What Amazon does _not_ publish is any statement of what blocking costs, so the audit reports the directive's state and does not argue a visibility case.

**Evidence:** Amazon documents the UA as 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Amazonbot/0.1) Chrome/W.X.Y.Z Safari/537.36'. It states the purpose — 'Amazonbot is used to improve our products and services' — and that the data 'may be used to train Amazon AI models'. It states compliance too: 'Automated crawling from these listed user agents respects the Robots Exclusion Protocol, honoring the user-agent and the allow/disallow directives.' The bot is active at scale: Cloudflare Radar ranked Amazonbot second only to GPTBot in the Computer & Electronics vertical (Aug 2025). Amazon also now documents a separate Amzn-SearchBot which 'does not crawl content for generative AI model training', so audits should treat the two tokens distinctly.

**Counter-evidence:** Explicit vendor negative on a related directive: 'They do not support the crawl-delay directive' — so any audit that recommends crawl-delay for Amazonbot is recommending a no-op. Amazon publishes no consequence statement for blocking (no equivalent of OpenAI's search-exclusion warning), so the visibility cost of a block is undocumented.

## Implementation deviations

The shared base class `_crawler-bot-audit.ts` grades access, not the shape of the file.

- The audit passes when the rules that apply to Amazonbot permit `/`: its own group, the catch-all, or no applicable group. Under RFC 9309 §2.2.1 an open catch-all grants the same access a named group would.
- The message names which of the three applied. A disallow that reaches the token fails.
- An unreadable robots.txt is not applicable: missing, non-200, an empty body, or a 200 that parses to no groups and no sitemaps. RFC 9309 §2.3.1.3 lets a crawler access everything when the file is unavailable.
- The fail remedy warns that a named `Allow: /` group replaces the catch-all for that bot and drops its catch-all `Disallow` lines.

## Deferred

- **A 5xx robots.txt.** RFC 9309 §2.3.1.4 tells a crawler to assume a complete
  disallow when robots.txt is unreachable. This audit reports any non-200 as
  not applicable and does not grade that case.
