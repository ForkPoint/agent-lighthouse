---
audit: access-crawl-control/gptbot
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/gptbot.ts
slug: gptbot
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: scored
consumers:
  - GPTBot
signals:
  - name: GPTBot allow/block state in robots.txt
    grade: A
    domain: robots-ai-crawlers
sources:
  - rfc-9309
  - s18
  - cloudflare-ai-crawler-purpose-industry
  - pebblous-blocking-citation-gap
  - consent-in-crisis-arxiv
---

# gptbot (`2.1`)

> crawler-permissions · source `gptbot.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Reads the robots.txt rules that apply to GPTBot — its own group if it has one, otherwise the catch-all — and reports whether they let it fetch the site root. A named group is not required: under RFC 9309 §2.2.1 an open catch-all grants the same access.

## Evidence

### Signal: GPTBot allow/block state in robots.txt — grade A (robots-ai-crawlers)

**Mechanism:** Disallowing GPTBot removes the site's content from OpenAI foundation-model training corpora; allowing it permits training use. It does not affect ChatGPT search visibility (that is OAI-SearchBot).

**Grade: A** — OpenAI states the effect of the directive verbatim: "Disallowing GPTBot indicates a site's content should not be used in training generative AI foundation models." The token, the user agent and a published IP list for verification all come from the vendor, which is the grade-A bar. Two things the grade does not cover, and the audit's copy says so. Blocking GPTBot has only a small measured effect on downstream visibility: sites blocking it retained 88.2% citation presence, because ingested and mirrored content persists. And GPTBot is not a ChatGPT search control — that is OAI-SearchBot.

**Evidence:** OpenAI's bot documentation states verbatim: 'Disallowing GPTBot indicates a site's content should not be used in training generative AI foundation models.' UA 'GPTBot/1.4; +https://openai.com/gptbot', IP ranges published at openai.com/gptbot.json for verification. Activity confirmed at network scale: Cloudflare Radar found ClaudeBot and GPTBot together 'account for nearly half of the observed crawling activity' (Aug 2025), and GPTBot was 17.4% of AI crawl traffic in News & Publications. Documented ACTIVE in 2026.

**Counter-evidence:** Blocking GPTBot has a measurably small effect on downstream visibility: BuzzStream/XOFU found sites blocking GPTBot still retained 88.2% citation presence in AI answers, because already-ingested and third-party-mirrored content persists. Consent in Crisis found OpenAI is the single most-blocked developer, so a GPTBot block is not differentiating. Auditors must not conflate a GPTBot block with an OAI-SearchBot block — they have opposite visibility consequences.

## Implementation deviations

The shared base class `_crawler-bot-audit.ts` grades access, not the shape of the file.

- The audit passes when the rules that apply to GPTBot permit `/`: its own group, the catch-all, or no applicable group. Under RFC 9309 §2.2.1 an open catch-all grants the same access a named group would.
- The message names which of the three applied. A disallow that reaches the token fails.
- An unreadable robots.txt is not applicable: missing, non-200, an empty body, or a 200 that parses to no groups and no sitemaps. RFC 9309 §2.3.1.3 lets a crawler access everything when the file is unavailable.
- The fail remedy warns that a named `Allow: /` group replaces the catch-all for that bot and drops its catch-all `Disallow` lines.

## Deferred

- **A 5xx robots.txt.** RFC 9309 §2.3.1.4 tells a crawler to assume a complete
  disallow when robots.txt is unreachable. This audit reports any non-200 as
  not applicable and does not grade that case.
