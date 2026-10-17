---
audit: access-crawl-control/claude-searchbot
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/claude-searchbot.ts
slug: claude-searchbot
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: scored
consumers:
  - Claude-SearchBot
signals:
  - name: Claude-SearchBot allow/block state in robots.txt
    grade: A
    domain: robots-ai-crawlers
sources:
  - rfc-9309
  - anthropic-crawlers
---

# claude-searchbot (`2.21`)

> crawler-permissions · source `claude-searchbot.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Reads the robots.txt rules that apply to Claude-SearchBot — its own group if it has one, otherwise the catch-all — and reports whether they let it fetch the site root. A named group is not required: under RFC 9309 §2.2.1 an open catch-all grants the same access.

## Evidence

### Signal: Claude-SearchBot allow/block state in robots.txt — grade A (robots-ai-crawlers)

**Mechanism:** Disallowing Claude-SearchBot removes the site from the index Anthropic uses to improve Claude's search result quality, reducing the chance of being surfaced/cited in Claude search answers.

**Grade: A** — Anthropic names the token and its purpose — it "analyzes online content specifically to enhance the relevance and accuracy of search responses" — under the same robots.txt-compliance statement and IP list that cover its other bots. That is a named agent reading a named directive, which is grade A. The exclusion-from-answers consequence is inferred from the stated purpose rather than asserted the way OpenAI asserts it for OAI-SearchBot, which is why the audit's copy states the purpose and not a promise.

**Evidence:** Documented by Anthropic: Claude-SearchBot 'navigates the web to improve search result quality for users. It analyzes online content specifically to enhance the relevance and accuracy of search responses', covered by the same robots.txt-compliance statement and the claude.com/crawling/bots.json IP list. As a search/citation-side agent it is the Anthropic analogue of OAI-SearchBot and PerplexityBot, so an allow is the visibility-positive state.

**Counter-evidence:** Anthropic does not state the consequence of blocking as explicitly as OpenAI does for OAI-SearchBot ('will not be shown in ChatGPT search answers') — the exclusion-from-answers link is inferred from the agent's stated purpose, not asserted. No published per-bot citation-impact study isolates Claude-SearchBot.

## Implementation deviations

The shared base class `_crawler-bot-audit.ts` grades access, not the shape of the file.

- The audit passes when the rules that apply to Claude-SearchBot permit `/`: its own group, the catch-all, or no applicable group. Under RFC 9309 §2.2.1 an open catch-all grants the same access a named group would.
- The message names which of the three applied. A disallow that reaches the token fails.
- An unreadable robots.txt is not applicable: missing, non-200, an empty body, or a 200 that parses to no groups and no sitemaps. RFC 9309 §2.3.1.3 lets a crawler access everything when the file is unavailable.
- The fail remedy warns that a named `Allow: /` group replaces the catch-all for that bot and drops its catch-all `Disallow` lines.

## Deferred

- **A 5xx robots.txt.** RFC 9309 §2.3.1.4 tells a crawler to assume a complete
  disallow when robots.txt is unreachable. This audit reports any non-200 as
  not applicable and does not grade that case.
