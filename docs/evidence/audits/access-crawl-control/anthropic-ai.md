---
audit: access-crawl-control/anthropic-ai
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/anthropic-ai.ts
slug: anthropic-ai
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-24
recommended_tier: informative
tier_rationale: "The recommendation graded the retired `anthropic-ai` token. The audit now scores the live `ClaudeBot` token, which Anthropic documents by name, so the grade-A signal it rests on is not the one the recommendation weighed (contradiction sweep, 2026-08-24)."
consumers: []
signals:
  - name: ClaudeBot allow/block state in robots.txt
    grade: A
    domain: robots-ai-crawlers
  - name: anthropic-ai (legacy token) present in robots.txt
    grade: C
    domain: robots-ai-crawlers
sources:
  - anthropic-crawlers
  - cloudflare-ai-crawler-purpose-industry
  - knownagents-claudebot
  - knownagents-anthropic-ai
---

# anthropic-ai (`2.3`)

> access-crawl-control · source `anthropic-ai.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

ClaudeBot collects web content that may contribute to Anthropic's model training, and Anthropic states its bots honour robots.txt.

This reads the robots.txt rules that actually apply to `ClaudeBot` — its own group if it has one, otherwise the catch-all — and reports whether they let it fetch the site root. A named group is not required: under RFC 9309 §2.2.1 an open catch-all grants a named crawler the same access a named group would.

The legacy `anthropic-ai` and `Claude-Web` tokens are detected and reported on the result when a group names them, but they never change the status or the score.

## Evidence

### Signal: ClaudeBot allow/block state in robots.txt — grade A (robots-ai-crawlers)

**Mechanism:** Disallowing ClaudeBot stops Anthropic from collecting the site's content for potential model training; Anthropic states its bots honor robots.txt.

**Grade: A** — Anthropic's current crawler article names ClaudeBot, and describes it as "collecting web content that could potentially contribute to their training". It asserts that "Anthropic's Bots respect do not crawl signals by honoring industry standard directives in robots.txt". It publishes an IP list for verification. A named agent, a named directive and a stated behaviour is the grade-A bar.

**Evidence:** Anthropic documents ClaudeBot as 'collecting web content that could potentially contribute to their training' and states 'Anthropic's Bots respect do not crawl signals by honoring industry standard directives in robots.txt', with IP verification at claude.com/crawling/bots.json. It is very much active in 2026, and often the highest-volume AI crawler. Cloudflare Radar had ClaudeBot and GPTBot together at nearly half of all AI crawl activity. Known Agents records 21% of top websites blocking ClaudeBot as of 2026-08-19 — the highest block rate of any Anthropic token.

**Counter-evidence:** Anthropic has by far the worst crawl-to-refer ratio measured by Cloudflare Radar (~50,000:1 overall, 2,500:1 in News & Publications), so allowing ClaudeBot buys essentially no referral traffic — the allow-side case is about training/corpus inclusion, not visibility. Note the canonical support URL moved from support.anthropic.com to support.claude.com; audits hard-coding the old host will 301.

### Signal: anthropic-ai (legacy token) present in robots.txt — grade C (robots-ai-crawlers)

**Mechanism:** 'anthropic-ai' is a legacy/undocumented token widely copy-pasted into robots.txt boilerplate; it appears in no current Anthropic documentation, so blocking or allowing it has no vendor-confirmed consequence.

**Grade: C** — The token is genuinely widespread — 16% of top sites carry it — but that is adoption by publishers, not consumption by an agent. It appears in no current Anthropic documentation, has no published IP range and no traffic breakout, so nothing confirms any consequence of allowing or blocking it. Wide adoption plus an unproven mechanism is grade C, which is why this signal is reported and never scored.

**Evidence:** Known Agents classifies anthropic-ai as an 'Undocumented AI Agent' — 'Crawls websites without disclosing its purpose, collecting data for an unknown AI use case' — while attributing it to Anthropic. Adoption is nevertheless substantial: 16% of top websites block anthropic-ai, evidence of how deeply it is embedded in circulated robots.txt templates. Claude-Web is in the same category: 'currently unclear exactly what it's used for, since there's no official documentation.'

**Counter-evidence:** Decisive negative: Anthropic's current, canonical crawler support article names only ClaudeBot, Claude-User and Claude-SearchBot. Neither 'anthropic-ai' nor 'Claude-Web' appears anywhere on it. There is no vendor doc, no published IP range, and no Cloudflare Radar breakout for anthropic-ai. Treat its presence as harmless legacy cruft — never as evidence a site has configured Anthropic access, and never award or deduct points for it. The same applies to Claude-Web.

## Implementation deviations

- Only `ClaudeBot` decides the status: `isPathAllowed(groups, 'ClaudeBot', '/')`. A group naming `anthropic-ai` or `Claude-Web` never changes the status or the score.
- A legacy-token group is reported, at weight zero. The `found` string gains a note that Anthropic's current documentation does not name it, and `details.legacyTokens` lists the tokens. The note stops at "no documented consumer" and does not claim the token configures nothing.
- The audit grades access, not file shape. Allowed by its own group, through the catch-all, or by no applicable group all pass. A disallow that reaches the token fails. There is no `warn` band.
- An unreadable robots.txt is not applicable: missing, non-200, an empty body, or a 200 that parses to no groups and no sitemaps. A `Sitemap:`-only file passes.
- The failure states what a block does: exclusion from the content Anthropic collects for potential model training. Its priority is `medium`. The text makes no visibility claim, because the evidence shows almost no referral traffic from Anthropic.
- The legacy signal is a note on this result, not its own informative audit. A row saying "you have an `anthropic-ai` group" means little away from the ClaudeBot verdict.

## Deferred

- The audit id still carries the legacy spelling. It scores `ClaudeBot` but is registered as `access-crawl-control/anthropic-ai`.
- Resolved 2026-10-19: the Anthropic row of `TRAINING_CRAWLERS` in `_robots-txt-helpers.ts` is now `ClaudeBot` alone, so the retired token no longer counts in `agent-governance` or `ai-usage-signal-coherence-across-channels`. The unused `isAnthropicAllowed` helper was removed with it.
