---
audit: access-crawl-control/claude-user
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/claude-user.ts
slug: claude-user
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: scored
consumers:
  - Claude-User
signals:
  - name: Claude-User allow/block state in robots.txt
    grade: A
    domain: robots-ai-crawlers
sources:
  - anthropic-crawlers
  - tollbit-robots-noncompliance
---

# claude-user (`2.15`)

> crawler-permissions · source `claude-user.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Without an explicit robots.txt rule, Claude-User may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.

## Code review findings (2026-08-20, 11-agent pass)

Genuinely valuable signal — Claude-User is the live fetcher behind Claude's web access, and blocking it prevents Claude from reading the page during a user's session. Same base-class implementation defects, same missing UA probe, and the same underweighting relative to training crawlers. Note it also overlaps in concept with 2.3, which conflates the whole Anthropic family under a deprecated token.

**Required fix:** Implement prefix matching in `isAllowed` so `User-agent: Claude` is attributed to all Claude-family tokens. Raise weight above the training tier. Add the `Claude-User` UA probe. Apply the shared helper fixes from 2.1.

**False-positive risks:**

- Edge UA blocking of `Claude-User` is invisible to the `AgentLighthouse/1.0` scanner — clean PASS on a site Claude cannot actually read.
- Prefix collision: a site writing `User-agent: Claude` (intending the whole family) matches neither `Claude-User`, `Claude-SearchBot` nor `ClaudeBot`; the deliberate block reads as 'allowed by default' across all three audits at once.
- Exact-match miss on versioned tokens.
- Shared BOM / soft-404 / `Disallow: /*` misreads.

**Test gaps:**

- No `User-agent: Claude` prefix-family case — a single robots.txt line that should block three audited tokens and currently blocks none of them.
- No versioned-token case.
- No UA-probe coverage.
- Same missing real-world robots.txt variants as 2.1.

**Overlaps with:** `2.3`, `2.21`, `2.22`, `2.28`

## Evidence

### Signal: Claude-User allow/block state in robots.txt — grade A (robots-ai-crawlers)

**Mechanism:** Disallowing Claude-User prevents Claude from fetching the site when a user asks Claude about it. Unlike OpenAI, Perplexity and Meta, Anthropic asserts no user-initiated exemption — its blanket robots.txt-compliance statement covers Claude-User, so the directive is expected to be honored.

**Grade: A** — Anthropic documents the token — "When individuals ask questions to Claude, it may access websites using a Claude-User agent" — under a compliance statement that covers it without carving out a user-initiated exemption. That matters: OpenAI, Perplexity, Meta and Mistral all reserve one for their equivalent agents, so this is a rare case where a directive aimed at a user-triggered fetcher is expected to be honoured. Named agent, named directive, stated behaviour: grade A. The guarantee rests on a blanket statement rather than a per-agent one, and no independent audit has tested it, so the audit reports the state rather than promising enforcement.

**Evidence:** Anthropic documents Claude-User as: 'supports Claude AI users. When individuals ask questions to Claude, it may access websites using a Claude-User agent', under the same statement that 'Anthropic's Bots respect do not crawl signals by honoring industry standard directives in robots.txt'. This makes Claude-User a rare case where blocking a user-initiated agent is documented to actually work — which also means blocking it is a real self-inflicted visibility cost. TollBit measured real-world blocking at 9% of European sites vs 26% of North American sites, confirming active field presence and operator awareness.

**Counter-evidence:** Anthropic does not publish a separate per-agent compliance statement, only a blanket one, so the Claude-User guarantee is weaker than a dedicated sentence. No independent audit has specifically measured Claude-User disallow compliance the way TollBit did for ChatGPT-User, so the honoring claim is vendor-asserted and untested.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
