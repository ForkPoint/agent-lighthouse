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
  - rfc-9309
  - anthropic-crawlers
  - tollbit-robots-noncompliance
---

# claude-user (`2.15`)

> crawler-permissions · source `claude-user.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Reads the robots.txt rules that apply to Claude-User — its own group if it has one, otherwise the catch-all — and reports whether they let it fetch the site root. A named group is not required: under RFC 9309 §2.2.1 an open catch-all grants the same access.

## Evidence

### Signal: Claude-User allow/block state in robots.txt — grade A (robots-ai-crawlers)

**Mechanism:** Disallowing Claude-User prevents Claude from fetching the site when a user asks Claude about it. Unlike OpenAI, Perplexity and Meta, Anthropic asserts no user-initiated exemption — its blanket robots.txt-compliance statement covers Claude-User, so the directive is expected to be honored.

**Grade: A** — Anthropic documents the token — "When individuals ask questions to Claude, it may access websites using a Claude-User agent" — under a compliance statement that covers it without carving out a user-initiated exemption. That matters: OpenAI, Perplexity, Meta and Mistral all reserve one for their equivalent agents, so this is a rare case where a directive aimed at a user-triggered fetcher is expected to be honoured. Named agent, named directive, stated behaviour: grade A. The guarantee rests on a blanket statement rather than a per-agent one, and no independent audit has tested it, so the audit reports the state rather than promising enforcement.

**Evidence:** Anthropic documents Claude-User as: 'supports Claude AI users. When individuals ask questions to Claude, it may access websites using a Claude-User agent', under the same statement that 'Anthropic's Bots respect do not crawl signals by honoring industry standard directives in robots.txt'. This makes Claude-User a rare case where blocking a user-initiated agent is documented to actually work — which also means blocking it is a real self-inflicted visibility cost. TollBit measured real-world blocking at 9% of European sites vs 26% of North American sites, confirming active field presence and operator awareness.

**Counter-evidence:** Anthropic does not publish a separate per-agent compliance statement, only a blanket one, so the Claude-User guarantee is weaker than a dedicated sentence. No independent audit has specifically measured Claude-User disallow compliance the way TollBit did for ChatGPT-User, so the honoring claim is vendor-asserted and untested.

## Implementation deviations

The shared base class `_crawler-bot-audit.ts` grades access, not the shape of the file.

- The audit passes when the rules that apply to Claude-User permit `/`: its own group, the catch-all, or no applicable group. Under RFC 9309 §2.2.1 an open catch-all grants the same access a named group would.
- The message names which of the three applied. A disallow that reaches the token fails.
- An unreadable robots.txt is not applicable: missing, non-200, an empty body, or a 200 that parses to no groups and no sitemaps. RFC 9309 §2.3.1.3 lets a crawler access everything when the file is unavailable.
- The fail remedy warns that a named `Allow: /` group replaces the catch-all for that bot and drops its catch-all `Disallow` lines.

## Deferred

- **A 5xx robots.txt.** RFC 9309 §2.3.1.4 tells a crawler to assume a complete
  disallow when robots.txt is unreachable. This audit reports any non-200 as
  not applicable and does not grade that case.
