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
  - duckduckgo-duckassistbot
  - knownagents-directory
---

# duckassistbot (`2.19`)

> crawler-permissions · source `duckassistbot.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Without an explicit robots.txt rule, DuckAssistBot may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.

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

**Evidence:** DuckDuckGo publishes an unusually precise help page. It names the token, 'DuckAssistBot/1.2; (+http://duckduckgo.com/duckassistbot.html)', and the purpose: 'DuckAssistBot is a web crawler for DuckDuckGo Search that crawls pages in real-time for our AI-assisted answers'. It rules out training use — 'This data is not used in any way to train AI models' — and states the latency of an opt-out: a disallow 'will take effect after 72 hours and DuckAssistBot will stop crawling your site'. It also gives a decoupling guarantee: 'Opting out of DuckAssistBot does not impact organic search rankings.' All three audit-relevant facts — compliance, latency and non-training use — are vendor-stated and falsifiable.

**Counter-evidence:** DuckAssistBot does not appear in Cloudflare Radar's named AI-crawler top-five breakdowns, so its traffic volume — and therefore the practical stakes of allowing or blocking it — is small relative to GPTBot/ClaudeBot/ChatGPT-User. The 72-hour enforcement lag means a disallow is not immediate.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
