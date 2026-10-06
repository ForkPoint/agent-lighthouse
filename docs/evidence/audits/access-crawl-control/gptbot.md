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

## Code review findings (2026-08-20, 11-agent pass)

GPTBot is the single most valuable token in the category and detecting a real Disallow is worth keeping — but the pass bar is cargo cult and the implementation misreads common files. Passing requires an explicit `User-agent: GPTBot\nAllow: /` group, which under RFC 9309 is functionally identical to having no group at all; the audit warns (0.5) on the equivalent state and justifies it with 'signals to the crawler that your site is AI-friendly', a mechanism no crawler implements. Worse, the fix it prescribes is actively harmful: adding a GPTBot group causes crawlers to ignore the wildcard group entirely, silently discarding any `Disallow: /private/` the site had. Real value here is the block-detection, not the allow-declaration.

**Required fix:** 1) In `_robots-txt-helpers.ts`, strip a leading BOM and prefix/version-normalize UA tokens before comparison. 2) Extend `isBlanketBlocked` to accept `/`, `/*` and `*`. 3) Reframe scoring: PASS when the bot is not blocked (explicit group or not), FAIL when blocked, and drop the 'not explicit' warn entirely — or demote it to `notApplicable`. 4) Remove the `Allow: /` recommendation, or gate it behind a check that the wildcard group carries no Disallow rules the bot group would shadow. 5) Add a live UA probe: refetch `/` as GPTBot and compare status to the baseline fetch; report that as the primary evidence.

**False-positive risks:**

- Exact-match UA lookup `g.userAgent.toLowerCase() === botName.toLowerCase()` misses `User-agent: GPTBot/1.1`; that group's `Disallow: /` is invisible and the audit reports 'allowed by default' on a blocked site.
- BOM'd robots.txt: `parseRobotsTxt` produces zero groups, so `isAllowed` hits its `No robots.txt rules at all` branch and reports allowed-by-default even when the file blocks everything.
- Cloudflare 'Block AI Scrapers' enabled: scanner fetches with `User-Agent: AgentLighthouse/1.0`, sees a normal robots.txt, PASSes — while GPTBot gets a 403 at the edge. Complete false negative on the most common real-world block mechanism.
- SPA soft-404: `/robots.txt` returns 200 + HTML; `robotsFile.status !== 200` gate passes, HTML parses to zero groups, audit warns 'allowed by default' rather than reporting no robots.txt.
- `isBlanketBlocked` only matches path `/`, so `User-agent: GPTBot\nDisallow: /*` is reported as allowed.

**Test gaps:**

- No test with a versioned token (`User-agent: GPTBot/1.1`).
- No BOM or CRLF robots.txt fixture.
- No `Disallow: /*` or `Disallow: *` case.
- No multi-group file where a GPTBot group supersedes a restrictive wildcard.
- No HTML soft-404 body served at /robots.txt with status 200.
- No test that a UA-based edge block is (currently) undetectable.

**Overlaps with:** `2.22`, `2.28`

## Evidence

### Signal: GPTBot allow/block state in robots.txt — grade A (robots-ai-crawlers)

**Mechanism:** Disallowing GPTBot removes the site's content from OpenAI foundation-model training corpora; allowing it permits training use. It does not affect ChatGPT search visibility (that is OAI-SearchBot).

**Grade: A** — OpenAI states the effect of the directive verbatim: "Disallowing GPTBot indicates a site's content should not be used in training generative AI foundation models." The token, the user agent and a published IP list for verification all come from the vendor, which is the grade-A bar. Two things the grade does not cover, and the audit's copy says so. Blocking GPTBot has only a small measured effect on downstream visibility: sites blocking it retained 88.2% citation presence, because ingested and mirrored content persists. And GPTBot is not a ChatGPT search control — that is OAI-SearchBot.

**Evidence:** OpenAI's bot documentation states verbatim: 'Disallowing GPTBot indicates a site's content should not be used in training generative AI foundation models.' UA 'GPTBot/1.4; +https://openai.com/gptbot', IP ranges published at openai.com/gptbot.json for verification. Activity confirmed at network scale: Cloudflare Radar found ClaudeBot and GPTBot together 'account for nearly half of the observed crawling activity' (Aug 2025), and GPTBot was 17.4% of AI crawl traffic in News & Publications. Documented ACTIVE in 2026.

**Counter-evidence:** Blocking GPTBot has a measurably small effect on downstream visibility: BuzzStream/XOFU found sites blocking GPTBot still retained 88.2% citation presence in AI answers, because already-ingested and third-party-mirrored content persists. Consent in Crisis found OpenAI is the single most-blocked developer, so a GPTBot block is not differentiating. Auditors must not conflate a GPTBot block with an OAI-SearchBot block — they have opposite visibility consequences.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Implementation deviations

### Inherited access passes (2026-10-06)

The audit scored the shape of the file, not the access it grants. The shared
base class `_crawler-bot-audit.ts` passed only when a group named GPTBot. It
warned at 0.5 when GPTBot was allowed through `User-agent: *` or by no rule
at all.

Nothing in the evidence supports that split. The grade rests on what a
disallow does, which is a fact about the block state. RFC 9309 §2.2.1 makes a
crawler obey the group that names its product token and fall back to `*`
only when none does. An open catch-all therefore grants the same access a
named group would.

The rule now asks one question: do the rules that apply to GPTBot permit `/`?
Allowed by its own group, through the catch-all, or by no applicable group
all pass. The message names which one applied. A disallow that reaches the
token still fails.

An unreadable robots.txt is not applicable rather than a warn: missing,
non-200, an empty body, or a 200 that parses to no groups and no directives.
RFC 9309 §2.3.1.3 lets a crawler access everything when the file is
unavailable, and no source here documents a cost for its absence.

The old fix, add `User-agent: GPTBot` / `Allow: /`, is withdrawn as advice for
an allowed site. A named group replaces the catch-all for that bot, so it
drops every catch-all `Disallow` the site still meant to apply. The fail
remedy now says so.

`access-crawl-control/meta-external-agent` and
`access-crawl-control/anthropic-ai` made the same change on 2026-08-24. The
base class now matches them.

This closes items 3 and 4 of the 2026-08-20 required fix. Item 5, the live
user-agent probe, is out of scope here.

Grade, tier and weight are unchanged.

## Deferred

- **A 5xx robots.txt.** RFC 9309 §2.3.1.4 tells a crawler to assume a complete
  disallow when robots.txt is unreachable. This audit reports any non-200 as
  not applicable and does not grade that case.
