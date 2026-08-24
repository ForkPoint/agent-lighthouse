---
audit: access-crawl-control/gptbot
audit_id: "2.1"
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/gptbot.ts
slug: gptbot
review_verdict: fix
severity: high
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# gptbot (`2.1`)

> crawler-permissions · source `gptbot.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Without an explicit robots.txt rule, GPTBot may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.

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

**Mechanism:** Disallowing GPTBot removes the site's content from OpenAI foundation-model training corpora; allowing it permits training use. It does NOT affect ChatGPT search visibility (that is OAI-SearchBot).

**Evidence:** OpenAI's bot documentation states verbatim: 'Disallowing GPTBot indicates a site's content should not be used in training generative AI foundation models.' UA 'GPTBot/1.4; +https://openai.com/gptbot', IP ranges published at openai.com/gptbot.json for verification. Activity confirmed at network scale: Cloudflare Radar found ClaudeBot and GPTBot together 'account for nearly half of the observed crawling activity' (Aug 2025), and GPTBot was 17.4% of AI crawl traffic in News & Publications. Documented ACTIVE in 2026.

**Counter-evidence:** Blocking GPTBot has a measurably small effect on downstream visibility: BuzzStream/XOFU found sites blocking GPTBot still retained 88.2% citation presence in AI answers, because already-ingested and third-party-mirrored content persists. Consent in Crisis found OpenAI is the single most-blocked developer, so a GPTBot block is not differentiating. Auditors must not conflate a GPTBot block with an OAI-SearchBot block — they have opposite visibility consequences.
**Consumers:** GPTBot · **Recommended tier:** scored

**Sources:** [OpenAI Bots / Crawlers documentation](https://developers.openai.com/api/docs/bots) (verified 2026-08-20) · [A deeper look at AI crawlers: breaking down traffic by purpose and industry](https://blog.cloudflare.com/ai-crawler-traffic-by-purpose-and-industry/) (verified 2026-08-20) · [The Paradox of Blocking AI Crawlers: You Lose Visitors, Not Citations](https://blog.pebblous.ai/report/ai-crawler-blocking-citation-gap/en/) (verified 2026-08-20) · [Consent in Crisis: The Rapid Decline of the AI Data Commons](https://arxiv.org/abs/2407.14933) (verified 2026-08-20)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
