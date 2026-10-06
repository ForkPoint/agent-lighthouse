---
audit: access-crawl-control/duckassistbot
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/duckassistbot.ts
slug: duckassistbot
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: scored
consumers:
  - DuckAssistBot
signals:
  - name: DuckAssistBot allow/block state in robots.txt
    grade: A
    domain: robots-ai-crawlers
sources:
  - rfc-9309
  - duckduckgo-duckassistbot
  - knownagents-directory
---

# duckassistbot (`2.19`)

> crawler-permissions · source `duckassistbot.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Reads the robots.txt rules that apply to DuckAssistBot — its own group if it has one, otherwise the catch-all — and reports whether they let it fetch the site root. A named group is not required: under RFC 9309 §2.2.1 an open catch-all grants the same access.

## Code review findings (2026-08-20, 11-agent pass)

Real, active token behind DuckDuckGo's DuckAssist answers — a legitimate keep, but a modest surface that does not warrant weight parity with GPTBot. Note DuckAssist is substantially grounded in DuckDuckGo's existing index (which derives from Bing), so a site's DuckAssistBot directive is not the only or even the primary gate on appearing there; the audit's implied causality is stronger than reality. Unmodified base class, all shared defects apply.

**Required fix:** Reduce weight relative to the top-tier realtime fetchers and soften the `impact` causality claim. Apply the shared helper fixes from 2.1.

**False-positive risks:**

- `impact` implies DuckAssistBot access is the gate on DuckAssist visibility, when DuckDuckGo's underlying index (Bing-derived) is the larger determinant — a site can be blocked here and still appear.
- Exact-match miss on versioned tokens.
- Weight 1.0 equal to GPTBot.
- Shared BOM / soft-404 / `Disallow: /*` misreads.

**Test gaps:**

- No versioned-token case.
- Template-only coverage; same missing real-world robots.txt variants as 2.1.

**Overlaps with:** `2.22`, `2.28`

## Evidence

### Signal: DuckAssistBot allow/block state in robots.txt — grade A (robots-ai-crawlers)

**Mechanism:** Disallowing DuckAssistBot removes the site as a real-time source for DuckDuckGo's AI-assisted answers (effective after ~72 hours) without affecting organic DuckDuckGo search rankings; the crawl is documented as never used for model training.

**Grade: A** — DuckDuckGo's help page is unusually precise. It publishes the token, and states that the crawler "crawls pages in real-time for our AI-assisted answers" and that "This data is not used in any way to train AI models". It even names the enforcement lag: a disallow takes effect after roughly 72 hours. A vendor documenting the token, the use and the timing is well past the grade-A bar. The practical stakes are small, since the bot does not appear in Cloudflare Radar's named top-five breakdowns, but that is a question of volume rather than of evidence.

**Evidence:** DuckDuckGo publishes an unusually precise help page. It names the token, 'DuckAssistBot/1.2; (+http://duckduckgo.com/duckassistbot.html)', and the purpose: 'DuckAssistBot is a web crawler for DuckDuckGo Search that crawls pages in real-time for our AI-assisted answers'. It rules out training use: 'This data is not used in any way to train AI models'. It states the latency of an opt-out. A disallow 'will take effect after 72 hours and DuckAssistBot will stop crawling your site'. It also gives a decoupling guarantee: 'Opting out of DuckAssistBot does not impact organic search rankings.' All three audit-relevant facts — compliance, latency and non-training use — are vendor-stated and falsifiable.

**Counter-evidence:** DuckAssistBot does not appear in Cloudflare Radar's named AI-crawler top-five breakdowns, so its traffic volume — and therefore the practical stakes of allowing or blocking it — is small relative to GPTBot/ClaudeBot/ChatGPT-User. The 72-hour enforcement lag means a disallow is not immediate.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Implementation deviations

### Inherited access passes (2026-10-06)

The audit scored the shape of the file, not the access it grants. The shared
base class `_crawler-bot-audit.ts` passed only when a group named DuckAssistBot. It
warned at 0.5 when DuckAssistBot was allowed through `User-agent: *` or by no rule
at all.

Nothing in the evidence supports that split. The grade rests on what a
disallow does, which is a fact about the block state. RFC 9309 §2.2.1 makes a
crawler obey the group that names its product token and fall back to `*`
only when none does. An open catch-all therefore grants the same access a
named group would.

The rule now asks one question: do the rules that apply to DuckAssistBot permit `/`?
Allowed by its own group, through the catch-all, or by no applicable group
all pass. The message names which one applied. A disallow that reaches the
token still fails.

An unreadable robots.txt is not applicable rather than a warn: missing,
non-200, an empty body, or a 200 that parses to no groups and no directives.
RFC 9309 §2.3.1.3 lets a crawler access everything when the file is
unavailable, and no source here documents a cost for its absence.

The old fix, add `User-agent: DuckAssistBot` / `Allow: /`, is withdrawn as advice for
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
