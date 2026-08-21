---
audit: access-crawl-control/chatgpt-user
audit_id: "2.14"
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/chatgpt-user.ts
slug: chatgpt-user
review_verdict: fix
severity: medium
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# chatgpt-user (`2.14`)

> crawler-permissions · source `chatgpt-user.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Without an explicit robots.txt rule, ChatGPT-User may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.

## Code review findings (2026-08-20, 11-agent pass)

One of the four checks in this category that genuinely matter — ChatGPT-User is the realtime fetcher behind ChatGPT browsing and Agent Mode, and blocking it directly costs referral traffic. The signal deserves a higher weight than the training crawlers it is scored equally with. The implementation, however, is the same base class with the same defects, and for a realtime user-initiated fetcher the scanner's inability to probe by UA is especially costly: user-initiated fetches are the ones most often caught by edge bot rules, so the most common real-world failure mode is precisely the one this audit cannot see.

**Required fix:** Raise `weight` above the training-crawler tier (realtime fetchers drive measurable referral traffic; training crawlers do not). Add a live UA probe refetching `/` as `ChatGPT-User` and fail on a status/body divergence from baseline — that is the check that catches the real-world blocking mechanism. Apply the shared helper fixes from 2.1.

**False-positive risks:**
- Cloudflare/Akamai bot rules that 403 `ChatGPT-User` at the edge produce a clean PASS here, because the scanner fetches as `AgentLighthouse/1.0` and only reads robots.txt intent.
- Exact-match miss on `User-agent: ChatGPT-User/1.0`.
- Prefix collision: a site writing `User-agent: ChatGPT` to cover the family matches neither `ChatGPT-User` nor `GPTBot`, so a deliberate block reads as 'allowed by default'.
- Shared BOM / soft-404 / `Disallow: /*` misreads.

**Test gaps:**
- No `User-agent: ChatGPT` prefix-family case.
- No versioned-token case.
- No coverage of the edge-block false negative (no UA probe exists to test).
- Same missing real-world robots.txt variants as 2.1.

**Overlaps with:** `2.22`, `2.28`

## Evidence

### Signal: ChatGPT-User allow/block state in robots.txt — grade A (robots-ai-crawlers)

**Mechanism:** Disallowing ChatGPT-User is intended to stop user-initiated ChatGPT fetches of the site, but OpenAI reserves an exemption and field measurement shows the disallow is frequently not honored — so the directive's presence does not reliably predict agent behavior in either direction.

**Evidence:** OpenAI documents the agent (UA 'ChatGPT-User/1.0; +https://openai.com/bot', IPs at openai.com/chatgpt-user.json) as handling 'user-initiated actions in ChatGPT and Custom GPTs'. It is the dominant user-action agent by volume: Cloudflare Radar attributes 'nearly three quarters of the request traffic' in the user-action category to ChatGPT-User (July 2025), and 14.9% of News & Publications AI traffic.

**Counter-evidence:** Two independent refutations of the block mechanism. (1) Vendor exemption, stated verbatim: 'Because these actions are initiated by a user, robots.txt rules may not apply.' (2) Field measurement — TollBit's H1 2026 'State of the Bots' found ChatGPT-User 'reached disallowed pages on more sites than any other bot', and that ChatGPT-User, Bytespider and Youbot 'each accessed disallowed pages on nearly half of the European sites that had explicitly listed them'. Blocking also costs visibility: BuzzStream found the lowest citation retention of any bot studied (70.6%) among sites blocking ChatGPT-User. Do not score a ChatGPT-User disallow as a positive; report it as informative with this caveat.
**Consumers:** ChatGPT-User · **Recommended tier:** informative

**Sources:** [OpenAI Bots / Crawlers documentation](https://developers.openai.com/api/docs/bots) · [A deeper look at AI crawlers: breaking down traffic by purpose and industry](https://blog.cloudflare.com/ai-crawler-traffic-by-purpose-and-industry/) · [15% of AI page fetchers in Europe reached disallowed URLs, TollBit finds](https://ppc.land/15-of-ai-page-fetchers-in-europe-reached-disallowed-urls-tollbit-finds/) · [The Paradox of Blocking AI Crawlers: You Lose Visitors, Not Citations](https://blog.pebblous.ai/report/ai-crawler-blocking-citation-gap/en/)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
