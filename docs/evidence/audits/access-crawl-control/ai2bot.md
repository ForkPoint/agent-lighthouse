---
audit: access-crawl-control/ai2bot
audit_id: "2.13"
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/ai2bot.ts
slug: ai2bot
review_verdict: delete
severity: low
evidence_grade: B
disposition: "proposed: redeem as scored (pending triage)"
reviewed: 2026-08-21
---

# ai2bot (`2.13`)

> crawler-permissions · source `ai2bot.ts` · review verdict **delete** · evidence grade **B** · disposition: **proposed: redeem as scored (pending triage)**

## What it checks

Without an explicit robots.txt rule, AI2Bot may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.

## Code review findings (2026-08-20, 11-agent pass)

Falsy. AI2Bot serves the Allen Institute's open research corpora (Dolma/OLMo) — an academically valuable but tiny-footprint crawler with no consumer answer surface. Weighted identically to GPTBot and producing a high-priority FAIL when blocked, it adds score noise without any corresponding change in whether AI agents can discover or cite the site.

**Required fix:** Remove from the scored roster, or fold into a zero-weight 'long-tail AI crawlers' informational check with cohere-ai, YouBot and Diffbot.

**False-positive risks:**
- High-priority FAIL for blocking a research crawler with no user-facing citation surface.
- Weight 1.0 equal to GPTBot inflates the category with an irrelevant token.
- Shared exact-match / BOM / soft-404 misreads.

**Test gaps:**
- Template-only; no impact validation.
- Same missing real-world robots.txt variants as 2.1.

**Overlaps with:** `2.22`, `2.28`

## Evidence

### Signal: AI2Bot allow/block state in robots.txt — grade B (robots-ai-crawlers)

**Mechanism:** Blocking AI2Bot excludes the site from the Allen Institute's open-language-model training corpora (Dolma and successors); the operator publishes the UA specifically so operators can filter it.

**Evidence:** AI2 publishes a dedicated crawler page with UA 'Mozilla/5.0 (compatible) AI2Bot (+https://www.allenai.org/crawler)' and states the crawler explores domains 'to find web content' that is 'used to train open language models', offering the UA string so it 'can be used to filter or reject traffic from our crawler if desired'. Its corpora (Dolma) are named in the Consent in Crisis audit as a major AI training corpus, giving the block real downstream leverage. Known Agents additionally lists a newer AI2Bot-DeepResearchEval assistant-class agent.

**Counter-evidence:** Grade capped at B: the AI2 page as fetched contains no explicit robots.txt-compliance sentence and no canonical disallow snippet — it offers UA-based filtering rather than committing to honor robots.txt. AI2Bot does not appear in any Cloudflare Radar top-five breakdown, so volume is very low; blocking it has minimal practical effect and is not worth scoring. Note that blocking AI2Bot specifically removes content from OPEN, research-transparent corpora while leaving closed commercial crawlers unaffected — an outcome many publishers would not intend.
**Consumers:** AI2Bot, AI2Bot-DeepResearchEval · **Recommended tier:** informative

**Sources:** [AI2Bot — Allen Institute for AI crawler](https://allenai.org/crawler) · [Consent in Crisis: The Rapid Decline of the AI Data Commons](https://arxiv.org/abs/2407.14933) · [Known Agents — AI agent user-agent directory (formerly Dark Visitors)](https://knownagents.com/agents)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
