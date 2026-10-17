---
audit: access-crawl-control/chatgpt-user
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/chatgpt-user.ts
slug: chatgpt-user
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: informative
consumers:
  - ChatGPT-User
signals:
  - name: ChatGPT-User allow/block state in robots.txt
    grade: A
    domain: robots-ai-crawlers
sources:
  - rfc-9309
  - s18
  - cloudflare-ai-crawler-purpose-industry
  - tollbit-robots-noncompliance
  - pebblous-blocking-citation-gap
---

# chatgpt-user (`2.14`)

> crawler-permissions · source `chatgpt-user.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Reads the robots.txt rules that apply to ChatGPT-User — its own group if it has one, otherwise the catch-all — and reports whether they let it fetch the site root. A named group is not required: under RFC 9309 §2.2.1 an open catch-all grants the same access.

## Evidence

### Signal: ChatGPT-User allow/block state in robots.txt — grade A (robots-ai-crawlers)

**Mechanism:** Disallowing ChatGPT-User is intended to stop user-initiated ChatGPT fetches of the site. But OpenAI reserves an exemption, and field measurement shows the disallow is frequently not honored. The directive's presence therefore does not reliably predict agent behavior in either direction.

**Evidence:** OpenAI documents the agent (UA 'ChatGPT-User/1.0; +https://openai.com/bot', IPs at openai.com/chatgpt-user.json) as handling 'user-initiated actions in ChatGPT and Custom GPTs'. It is the dominant user-action agent by volume: Cloudflare Radar attributes 'nearly three quarters of the request traffic' in the user-action category to ChatGPT-User (July 2025), and 14.9% of News & Publications AI traffic.

**Counter-evidence:** Two independent refutations of the block mechanism. (1) Vendor exemption, stated verbatim: 'Because these actions are initiated by a user, robots.txt rules may not apply.' (2) Field measurement. TollBit's H1 2026 'State of the Bots' found that ChatGPT-User 'reached disallowed pages on more sites than any other bot'. It also found that ChatGPT-User, Bytespider and Youbot 'each accessed disallowed pages on nearly half of the European sites that had explicitly listed them'. Blocking also costs visibility: BuzzStream found the lowest citation retention of any bot studied (70.6%) among sites blocking ChatGPT-User. Do not score a ChatGPT-User disallow as a positive; report it as informative with this caveat.

## Implementation deviations

The shared base class `_crawler-bot-audit.ts` grades access, not the shape of the file.

- The audit passes when the rules that apply to ChatGPT-User permit `/`: its own group, the catch-all, or no applicable group. Under RFC 9309 §2.2.1 an open catch-all grants the same access a named group would.
- The message names which of the three applied. A disallow that reaches the token fails.
- An unreadable robots.txt is not applicable: missing, non-200, an empty body, or a 200 that parses to no groups and no sitemaps. RFC 9309 §2.3.1.3 lets a crawler access everything when the file is unavailable.
- The fail remedy warns that a named `Allow: /` group replaces the catch-all for that bot and drops its catch-all `Disallow` lines.

## Deferred

- **A 5xx robots.txt.** RFC 9309 §2.3.1.4 tells a crawler to assume a complete
  disallow when robots.txt is unreachable. This audit reports any non-200 as
  not applicable and does not grade that case.
