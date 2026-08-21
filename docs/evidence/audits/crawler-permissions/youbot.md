---
audit: crawler-permissions/youbot
audit_id: "2.11"
category: crawler-permissions
source_file: packages/core/src/audits/crawler-permissions/youbot.ts
slug: youbot
review_verdict: delete
severity: low
evidence_grade: A
disposition: "proposed: redeem as scored (pending triage)"
reviewed: 2026-08-21
---

# youbot (`2.11`)

> crawler-permissions · source `youbot.ts` · review verdict **delete** · evidence grade **A** · disposition: **proposed: redeem as scored (pending triage)**

## What it checks

Without an explicit robots.txt rule, YouBot may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.

## Code review findings (2026-08-20, 11-agent pass)

Falsy. You.com pivoted away from consumer answer search to enterprise agent APIs; YouBot's crawl volume and citation surface are negligible in 2026. Passing this audit produces no measurable improvement in whether any AI agent can find, cite or act on the site, yet a block yields a high-priority FAIL at weight 1.0.

**Required fix:** Remove from the scored roster, or fold into a single zero-weight 'long-tail AI crawlers' informational check with cohere-ai, Diffbot and AI2Bot.

**False-positive risks:**
- `impact` promises visibility in an answer engine with essentially no consumer traffic — the guidance is unactionable regardless of whether the audit's parsing is correct.
- Weight 1.0 equal to GPTBot distorts the category score.
- Shared exact-match / BOM / soft-404 misreads.

**Test gaps:**
- Template-only; no liveness or impact validation.
- Same missing real-world robots.txt variants as 2.1.

**Overlaps with:** `2.22`, `2.28`

## Evidence

### Signal: YouBot allow/block state in robots.txt — grade A (robots-ai-crawlers)

**Mechanism:** Disallowing YouBot removes the site from You.com's real-time search index used to answer user queries; You.com documents full robots.txt and crawl-delay compliance and a ~30 minute robots.txt cache.

**Evidence:** You.com publishes a dedicated bot page (docs.you.com/youbot 301s to you.com/docs/youbot): UA 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; YouBot/1.0; +https://docs.you.com/youbot; env:prod) Chrome/X.X.X.X Safari/537.36'; purpose 'automatically discovers and indexes web pages to provide real-time, accurate search results'; and an unusually strong compliance claim: 'YouBot fully respects robots.txt directives, including user-agent specific rules and crawl-delay settings', with canonical block 'User-agent: YouBot / Disallow: /' and robots.txt cached ~30 minutes. Known Agents records 11% of top websites blocking YouBot as of Aug 2026.

**Counter-evidence:** MAJOR CONTRADICTION between vendor claim and field measurement: TollBit's H1 2026 report found ChatGPT-User, Bytespider and Youbot 'each accessed disallowed pages on nearly half of the European sites that had explicitly listed them' — directly refuting 'fully respects robots.txt directives'. Grade A reflects documentation quality; the audit copy must carry this contradiction rather than presenting the vendor claim at face value. YouBot volume is also small (AI data providers ~0.4% of all traffic).
**Consumers:** YouBot · **Recommended tier:** scored

**Sources:** [YouBot — You.com documentation](https://you.com/docs/youbot) · [YouBot — Known Agents](https://knownagents.com/agents/youbot) · [15% of AI page fetchers in Europe reached disallowed URLs, TollBit finds](https://ppc.land/15-of-ai-page-fetchers-in-europe-reached-disallowed-urls-tollbit-finds/)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
