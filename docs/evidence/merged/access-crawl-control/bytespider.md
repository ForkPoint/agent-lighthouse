---
audit: access-crawl-control/bytespider
audit_id: "2.9"
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/bytespider.ts
slug: bytespider
review_verdict: delete
severity: medium
evidence_grade: C
disposition: "proposed: redeem as scored (pending triage)"
reviewed: 2026-08-21
---

# bytespider (`2.9`)

> crawler-permissions · source `bytespider.ts` · review verdict **delete** · evidence grade **C** · disposition: **proposed: redeem as scored (pending triage)**

## What it checks

Without an explicit robots.txt rule, Bytespider may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.

## Code review findings (2026-08-20, 11-agent pass)

Net-misleading. Bytespider is extensively documented — by Cloudflare, Fastly and numerous site operators — as ignoring robots.txt, crawling from rotating undeclared UAs and IP ranges. Whatever this audit reports about a site's `User-agent: Bytespider` directive tells the user nothing about whether Bytespider actually crawls them; the directive is not consumed. Independently, the audit recommends ALLOWING it: Bytespider serves ByteDance/Doubao, a China-market surface that produces no citations or referral traffic for the overwhelming majority of audited sites, and is the bot operators most commonly block for aggressive crawl volume. So a user who follows this audit's high-priority FAIL removes a block that was protecting their origin, in exchange for visibility that does not exist, on a directive the bot ignores anyway. Passing this audit cannot improve AI agent outcomes.

**Required fix:** Remove from the scored roster. If retained at all, invert it into an informational-only note ('Bytespider does not honor robots.txt; block at the edge if crawl volume is a concern') with `scoreDisplayMode: 'informative'` and zero weight, never a high-priority FAIL recommending an unblock.

**False-positive risks:**
- The audit's core premise fails: reporting 'Bytespider is blocked by robots.txt' is not a fact about crawler behavior, because Bytespider does not honor the file. The result is unfalsifiable and wrong in both directions.
- Sites that intentionally block Bytespider at the edge for load reasons — a mainstream, well-justified ops decision — receive a high-priority FAIL telling them to undo it.
- Shared exact-match / BOM / soft-404 misreads apply on top.

**Test gaps:**
- No test — and none possible — validating that the directive has any effect on Bytespider behavior.
- Same missing real-world robots.txt variants as 2.1.

**Overlaps with:** `2.22`, `2.28`

## Evidence

### Signal: Bytespider allow/block state in robots.txt — grade C (robots-ai-crawlers)

**Mechanism:** A Bytespider disallow is intended to stop ByteDance collecting the site for LLM training, but there is no English-language vendor bot documentation and independent measurement shows the directive is frequently ignored, so the block is not a reliable control.

**Evidence:** Bytespider is unambiguously active and high-volume in 2026: Cloudflare Radar placed ByteSpider in the AI-crawler top five for the Computer & Electronics vertical, and Known Agents records 19% of top websites blocking it as of 2026-08-19, noting 'broad, high-volume sweeps that fetch far more pages per visit than a search crawler' and crawls originating from Singapore. UA: 'Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; https://bytedance.sg.larkoffice.com/docx/...)'.

**Counter-evidence:** Two strong negatives. (1) No vendor documentation comparable to OpenAI/Anthropic/Perplexity — the only operator reference is a Chinese-language webmaster portal (zhanzhang.toutiao.com); ByteDance publishes no English bot page, no purpose statement and no verifiable IP range list. (2) Documented non-compliance: TollBit's H1 2026 'State of the Bots' found ChatGPT-User, Bytespider and Youbot 'each accessed disallowed pages on nearly half of the European sites that had explicitly listed them'. Grade cannot exceed C: the consumer exists but the mechanism is empirically unreliable. Present it as informative and pair it with advice to enforce at the edge (WAF/rate-limit) rather than via robots.txt alone.
**Consumers:** Bytespider · **Recommended tier:** informative

**Sources:** [Bytespider — Known Agents](https://knownagents.com/agents/bytespider) · [A deeper look at AI crawlers: breaking down traffic by purpose and industry](https://blog.cloudflare.com/ai-crawler-traffic-by-purpose-and-industry/) · [15% of AI page fetchers in Europe reached disallowed URLs, TollBit finds](https://ppc.land/15-of-ai-page-fetchers-in-europe-reached-disallowed-urls-tollbit-finds/)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

**Merged into:** `access-crawl-control/ai-bot-directives` (Plan 4, 2026-08-22) — [merged dossier](../../audits/access-crawl-control/ai-bot-directives.md)
