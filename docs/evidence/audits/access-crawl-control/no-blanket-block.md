---
audit: access-crawl-control/no-blanket-block
audit_id: "2.22"
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/no-blanket-block.ts
slug: no-blanket-block
review_verdict: fix
severity: medium
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# no-blanket-block (`2.22`)

> crawler-permissions · source `no-blanket-block.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

## What it checks

A blanket Disallow: / under User-agent: * blocks every crawler, including all AI agents. Your site becomes invisible to AI search engines, ChatGPT Browse, Perplexity, and others.

## Code review findings (2026-08-20, 11-agent pass)

The most defensible audit in the category — a wildcard `Disallow: /` genuinely destroys AI discoverability and critical priority is appropriate. Two problems keep it from 'keep'. First, the title and description say 'No blanket AI block' but the code only inspects `groups.filter(g => g.userAgent === '*')`; a site with `User-agent: GPTBot\nDisallow: /`, `User-agent: ClaudeBot\nDisallow: /` and `User-agent: *\nAllow: /` has blanket-blocked AI and receives a PASS titled 'No blanket AI block'. Second, the missing-robots.txt branch is wrong-signed: no robots.txt means nothing is blocked, which is a pass for this specific criterion, yet it returns `warn` and drags the score down.

**Required fix:** Strip the BOM in `parseRobotsTxt`; extend `isBlanketBlocked` to `/`, `/*`, `*`. Add a content-type + leading-`<` guard so an HTML soft-404 is reported as 'no robots.txt' rather than parsed. Change the missing-robots.txt branch from `warn` to `pass` (nothing is blocked) or `notApplicable`. Either rename the audit to 'No wildcard blanket block' or extend it to fail when every AI token in `ALL_CRAWLERS` is disallowed.

**False-positive risks:**
- BOM'd robots.txt parses to zero groups → `wildcardGroups` empty → `isBlanketBlocked([])` false → PASS on a site that blocks the entire web. Highest-impact single false result in the category.
- `isBlanketBlocked` matches only `r.path === '/'`; `User-agent: *\nDisallow: /*` and `Disallow: *` are real-world blanket blocks reported as PASS.
- SPA soft-404 serving HTML at /robots.txt with status 200 parses to zero groups → PASS, and the user is told crawler permissions were verified when no robots.txt exists.
- Title/criterion mismatch: AI-specific blanket blocks pass an audit named 'No blanket AI block'.
- `warn` on missing robots.txt penalizes the most permissive possible configuration.

**Test gaps:**
- No BOM fixture (the case that silently inverts the result).
- No `Disallow: /*` or `Disallow: *` case.
- No HTML soft-404 body at /robots.txt.
- No AI-specific blanket block case (all AI bots disallowed, wildcard allowed) to expose the title/criterion mismatch.
- No CRLF-only line endings.

**Overlaps with:** `2.23`, `2.28`

## Evidence

### Signal: Blanket-blocking all AI bots (User-agent: * Disallow: / for AI tokens, or long AI-bot denylists) as a negative signal — grade B (robots-ai-crawlers)

**Mechanism:** Blocking answer/search-side AI agents (OAI-SearchBot, PerplexityBot, Claude-SearchBot, MistralAI-Index, DuckAssistBot, Meta-WebIndexer) measurably reduces referral traffic and vendor-stated answer eligibility, while blocking training-side agents (GPTBot, ClaudeBot, CCBot, Google-Extended, Applebot-Extended, MistralAI-Training, meta-externalagent) has near-zero measured effect on citation presence. An undifferentiated blanket block therefore pays the full visibility cost while capturing almost none of the intended protection.

**Evidence:** The strongest direct vendor claim: OpenAI states 'Sites that are opted out of OAI-SearchBot will not be shown in ChatGPT search answers.' Perplexity mirrors it from the allow side: 'To ensure your site appears in search results, we recommend allowing PerplexityBot'. Quantified traffic cost: Zhao (Rutgers) & Berman (Wharton) measured large publishers that blocked crawlers losing 23.1% of total traffic monthly in the Dec 2025 version, revised to roughly -7% weekly in the Apr 2026 version. Quantified futility of the training-side block: BuzzStream/XOFU analysis of 4M AI citations across 3,600 prompts found citation retention of 92.3% (Google-Extended), 88.2% (GPTBot), 82.4% (OAI-SearchBot), 70.6% (ChatGPT-User) among blocking sites, concluding 'Even the sites that blocked training bots still accounted for about 95% of ChatGPT's citation sources.' The summary finding — 'visitors are lost while citations remain' — is exactly the asymmetry an audit should score. Blocking is also no longer differentiating: Consent in Crisis found restrictions rendering 28%+ of the most actively maintained C4 sources fully restricted in a single year.

**Counter-evidence:** Blocking is a legitimate rights choice, not a defect, and the audit must not frame it as an error — publishers with licensing deals or copyright strategy deliberately block, and Cloudflare's crawl-to-refer data (Anthropic ~50,000:1, OpenAI 887:1) shows the economic case for blocking training crawlers is real. Blocking is also partly self-executing at best: TollBit H1 2026 found ~15% of AI page-fetchers reached disallowed URLs anyway, so a block neither reliably protects nor is it fully costly. The correct audit posture is to flag UNDIFFERENTIATED blanket blocks (search-side and training-side treated identically) as a likely-unintended configuration, and to report deliberate, differentiated blocking neutrally.
**Consumers:** OAI-SearchBot, PerplexityBot, Claude-SearchBot, DuckAssistBot, MistralAI-Index, Meta-WebIndexer · **Recommended tier:** scored

**Sources:** [OpenAI Bots / Crawlers documentation](https://developers.openai.com/api/docs/bots) (verified 2026-08-20) · [Perplexity Crawlers](https://docs.perplexity.ai/guides/bots) (verified 2026-08-20) · [The Paradox of Blocking AI Crawlers: You Lose Visitors, Not Citations](https://blog.pebblous.ai/report/ai-crawler-blocking-citation-gap/en/) (verified 2026-08-20) · [Consent in Crisis: The Rapid Decline of the AI Data Commons](https://arxiv.org/abs/2407.14933) (verified 2026-08-20) · [A deeper look at AI crawlers: breaking down traffic by purpose and industry](https://blog.cloudflare.com/ai-crawler-traffic-by-purpose-and-industry/) (verified 2026-08-20) · [15% of AI page fetchers in Europe reached disallowed URLs, TollBit finds](https://ppc.land/15-of-ai-page-fetchers-in-europe-reached-disallowed-urls-tollbit-finds/) (verified 2026-08-20)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
