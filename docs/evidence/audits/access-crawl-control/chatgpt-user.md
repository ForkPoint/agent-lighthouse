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

**Mechanism:** Disallowing ChatGPT-User is intended to stop user-initiated ChatGPT fetches of the site. But OpenAI reserves an exemption, and field measurement shows the disallow is frequently not honored. The directive's presence therefore does not reliably predict agent behavior in either direction.

**Evidence:** OpenAI documents the agent (UA 'ChatGPT-User/1.0; +https://openai.com/bot', IPs at openai.com/chatgpt-user.json) as handling 'user-initiated actions in ChatGPT and Custom GPTs'. It is the dominant user-action agent by volume: Cloudflare Radar attributes 'nearly three quarters of the request traffic' in the user-action category to ChatGPT-User (July 2025), and 14.9% of News & Publications AI traffic.

**Counter-evidence:** Two independent refutations of the block mechanism. (1) Vendor exemption, stated verbatim: 'Because these actions are initiated by a user, robots.txt rules may not apply.' (2) Field measurement. TollBit's H1 2026 'State of the Bots' found that ChatGPT-User 'reached disallowed pages on more sites than any other bot'. It also found that ChatGPT-User, Bytespider and Youbot 'each accessed disallowed pages on nearly half of the European sites that had explicitly listed them'. Blocking also costs visibility: BuzzStream found the lowest citation retention of any bot studied (70.6%) among sites blocking ChatGPT-User. Do not score a ChatGPT-User disallow as a positive; report it as informative with this caveat.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Implementation deviations

### Inherited access passes (2026-10-06)

The audit scored the shape of the file, not the access it grants. The shared
base class `_crawler-bot-audit.ts` passed only when a group named ChatGPT-User. It
warned at 0.5 when ChatGPT-User was allowed through `User-agent: *` or by no rule
at all.

Nothing in the evidence supports that split. The grade rests on what a
disallow does, which is a fact about the block state. RFC 9309 §2.2.1 makes a
crawler obey the group that names its product token and fall back to `*`
only when none does. An open catch-all therefore grants the same access a
named group would.

The rule now asks one question: do the rules that apply to ChatGPT-User permit `/`?
Allowed by its own group, through the catch-all, or by no applicable group
all pass. The message names which one applied. A disallow that reaches the
token still fails.

An unreadable robots.txt is not applicable rather than a warn: missing,
non-200, an empty body, or a 200 that parses to no groups and no directives.
RFC 9309 §2.3.1.3 lets a crawler access everything when the file is
unavailable, and no source here documents a cost for its absence.

The old fix, add `User-agent: ChatGPT-User` / `Allow: /`, is withdrawn as advice for
an allowed site. A named group replaces the catch-all for that bot, so it
drops every catch-all `Disallow` the site still meant to apply. The fail
remedy now says so.

`access-crawl-control/meta-external-agent` and
`access-crawl-control/anthropic-ai` made the same change on 2026-08-24. The
base class now matches them.

Grade, tier and weight are unchanged.

## Deferred

- **A 5xx robots.txt.** RFC 9309 §2.3.1.4 tells a crawler to assume a complete
  disallow when robots.txt is unreachable. This audit reports any non-200 as
  not applicable and does not grade that case.
