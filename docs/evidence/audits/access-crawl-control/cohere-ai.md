---
audit: access-crawl-control/cohere-ai
audit_id: "2.10"
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/cohere-ai.ts
slug: cohere-ai
review_verdict: delete
severity: medium
evidence_grade: C
disposition: "proposed: redeem as scored (pending triage)"
reviewed: 2026-08-21
---

# cohere-ai (`2.10`)

> crawler-permissions · source `cohere-ai.ts` · review verdict **delete** · evidence grade **C** · disposition: **proposed: redeem as scored (pending triage)**

## What it checks

Without an explicit robots.txt rule, cohere-ai may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.

## Code review findings (2026-08-20, 11-agent pass)

Falsy. `cohere-ai` is a low-adoption token for a vendor that is enterprise-RAG-focused and does not operate a consumer answer surface where a site could be cited. There is no user-visible outcome that changes based on whether a site allows or blocks it, yet it carries weight 1.0 — the same as GPTBot — and produces a high-priority FAIL when blocked. It inflates the category with a check whose pass state confers no benefit, and dilutes the score signal for the four or five tokens that genuinely matter.

**Required fix:** Remove from the scored roster, or demote to weight 0 / informative alongside YouBot, Diffbot and AI2Bot in a single 'long-tail AI crawlers' informational check.

**False-positive risks:**
- High-priority FAIL text claims blocking it 'prevents your content from appearing in AI-powered search results' — there is no consumer Cohere search surface for the content to appear in.
- Equal weighting with GPTBot means a site can lose the same score for blocking a bot nobody queries as for blocking the largest AI platform.
- Shared exact-match / BOM / soft-404 / `Disallow: /*` misreads.

**Test gaps:**
- Template-only coverage; nothing validates that the bot is still active or that the claimed impact exists.
- Same missing real-world robots.txt variants as 2.1.

**Overlaps with:** `2.22`, `2.28`

## Evidence

### Signal: cohere-training-data-crawler / cohere-ai allow/block state in robots.txt — grade C (robots-ai-crawlers)

**Mechanism:** 'cohere-training-data-crawler' is a real observed training-data token attributed to Cohere and is expected to honor robots.txt; 'cohere-ai' is an undocumented legacy token with no confirmed operator behavior.

**Evidence:** Known Agents catalogues cohere-training-data-crawler as an AI Data Scraper operated by Cohere ('Downloads website content to include in datasets used for training AI models such as LLMs'), expected to follow robots.txt, with 7% of top websites blocking it as of 2026-08-19. The literal robots.txt token is the full string 'cohere-training-data-crawler'.

**Counter-evidence:** No Cohere vendor documentation page was locatable — unlike OpenAI, Anthropic, Perplexity, Google, Apple, Amazon, Meta, Mistral and DuckDuckGo, Cohere publishes no crawler page, no UA string reference, no IP range list and no compliance statement. 'cohere-ai' is separately classified as an 'Undocumented AI Agent' — 'an unconfirmed agent possibly dispatched by Cohere's AI chat products'. Cohere does not appear in Cloudflare Radar's named top-five breakdowns, so volume is negligible. Both tokens should be informative at most; 'cohere-ai' in particular is boilerplate cruft with no verified consumer.
**Consumers:** cohere-training-data-crawler · **Recommended tier:** informative

**Sources:** [cohere-training-data-crawler — Known Agents](https://knownagents.com/agents/cohere-training-data-crawler) · [Known Agents — AI agent user-agent directory (formerly Dark Visitors)](https://knownagents.com/agents)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
