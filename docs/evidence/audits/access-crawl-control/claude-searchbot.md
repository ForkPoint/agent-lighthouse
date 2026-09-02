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
  - anthropic-crawlers
---

# claude-searchbot (`2.21`)

> crawler-permissions · source `claude-searchbot.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Without an explicit robots.txt rule, Claude-SearchBot may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.

## Code review findings (2026-08-20, 11-agent pass)

Active and worth keeping — Claude-SearchBot builds Anthropic's search index, so blocking it removes the site from Claude's search-grounded answers. But the Claude family is now split across three audits (2.3, 2.15, 2.21) with no shared matching logic, and 2.3 is keyed on the deprecated `anthropic-ai` token. A single real-world `User-agent: Claude\nDisallow: /` line blocks all three and is detected by none, because every lookup is exact-equality.

**Required fix:** Implement prefix matching in `isAllowed`. Consider consolidating 2.3 / 2.15 / 2.21 into one vendor-level 'Anthropic crawlers' audit that reports ClaudeBot, Claude-User and Claude-SearchBot separately in `details`, keyed on the live tokens rather than the deprecated `anthropic-ai`.

### 2026-08-24 — status of the 2.3 token complaint

Half of the finding above is now resolved. `access-crawl-control/anthropic-ai`
scores the live `ClaudeBot` token only: a legacy `User-agent: anthropic-ai` or
`Claude-Web` group is reported in `found` and `details.legacyTokens`, and never
decides the verdict. Only the audit _id_ still carries the legacy spelling; the
rule behind it does not. The consolidation of 2.3 / 2.15 / 2.21 into one
vendor-level audit was not done and remains open.

**False-positive risks:**

- `User-agent: Claude` prefix block is missed by all three Claude audits simultaneously — three separate false 'allowed by default' warns on a fully blocked site.
- Exact-match miss on `User-agent: Claude-SearchBot/1.0`.
- Edge UA blocking invisible to the scanner.
- Shared BOM / soft-404 / `Disallow: /*` misreads.

**Test gaps:**

- No `User-agent: Claude` family-prefix case.
- No versioned-token case.
- No cross-audit consistency test over the three Claude tokens on one fixture.
- Same missing real-world robots.txt variants as 2.1.

**Overlaps with:** `2.3`, `2.15`, `2.22`, `2.28`

## Evidence

### Signal: Claude-SearchBot allow/block state in robots.txt — grade A (robots-ai-crawlers)

**Mechanism:** Disallowing Claude-SearchBot removes the site from the index Anthropic uses to improve Claude's search result quality, reducing the chance of being surfaced/cited in Claude search answers.

**Grade: A** — Anthropic names the token and its purpose — it "analyzes online content specifically to enhance the relevance and accuracy of search responses" — under the same robots.txt-compliance statement and IP list that cover its other bots. That is a named agent reading a named directive, which is grade A. The exclusion-from-answers consequence is inferred from the stated purpose rather than asserted the way OpenAI asserts it for OAI-SearchBot, which is why the audit's copy states the purpose and not a promise.

**Evidence:** Documented by Anthropic: Claude-SearchBot 'navigates the web to improve search result quality for users. It analyzes online content specifically to enhance the relevance and accuracy of search responses', covered by the same robots.txt-compliance statement and the claude.com/crawling/bots.json IP list. As a search/citation-side agent it is the Anthropic analogue of OAI-SearchBot and PerplexityBot, so an allow is the visibility-positive state.

**Counter-evidence:** Anthropic does not state the consequence of blocking as explicitly as OpenAI does for OAI-SearchBot ('will not be shown in ChatGPT search answers') — the exclusion-from-answers link is inferred from the agent's stated purpose, not asserted. No published per-bot citation-impact study isolates Claude-SearchBot.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
