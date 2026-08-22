---
audit: access-crawl-control/perplexitybot
audit_id: "2.4"
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/perplexitybot.ts
slug: perplexitybot
review_verdict: fix
severity: medium
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# perplexitybot (`2.4`)

> crawler-permissions · source `perplexitybot.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Without an explicit robots.txt rule, PerplexityBot may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.

## Code review findings (2026-08-20, 11-agent pass)

Perplexity is a genuinely high-value citation surface, so the signal is worth keeping, but the taxonomy is wrong and the roster is half-missing. `PerplexityBot` is registered as `category: 'training'` in `TRAINING_CRAWLERS` — it is Perplexity's search-index crawler, not a training crawler — and `Perplexity-User`, the realtime fetcher that actually produces the citations and referral clicks users care about, is not audited at all. Because 2.28 (agent-governance) derives its whole training-vs-realtime verdict from these two arrays, the miscategorization propagates: a site with correct Perplexity governance is scored against the wrong bucket.

**Required fix:** Move PerplexityBot to `REALTIME_CRAWLERS` (or add a third `search-index` category) and add a `Perplexity-User` audit to `REALTIME_CRAWLERS`. Apply the shared helper fixes from 2.1.

**False-positive risks:**
- Miscategorization as `training` feeds `TRAINING_CRAWLERS` into 2.28's `categoryBlocked`, so a site allowing PerplexityBot for search while blocking real training crawlers reads as inconsistent training policy.
- Shared exact-match miss on `User-agent: PerplexityBot/1.0`.
- Perplexity has been repeatedly documented crawling from undeclared UAs and rotating IPs; a robots.txt-only verdict overstates what the directive actually controls.
- Shared BOM / soft-404 / `Disallow: /*` misreads.

**Test gaps:**
- No test asserting the bot's category classification.
- No coverage of `Perplexity-User` (the token absent from the roster).
- Same missing real-world robots.txt variants as 2.1.

**Overlaps with:** `2.22`, `2.28`

## Evidence

### Signal: PerplexityBot allow/block state in robots.txt — grade A (robots-ai-crawlers)

**Mechanism:** Allowing PerplexityBot is required for the site to be indexed and cited in Perplexity search results; disallowing it removes the site from Perplexity's index. Perplexity states the crawl is not used for model training.

**Evidence:** Perplexity documents an explicit allow-side recommendation: 'To ensure your site appears in search results, we recommend allowing PerplexityBot in your site's robots.txt file', with UA 'PerplexityBot/1.0; +https://perplexity.ai/perplexitybot' and IPs at perplexity.com/perplexitybot.json, and states it is 'not used for AI model training'. Perplexity also has by far the best crawl-to-refer ratio of the major AI operators in Cloudflare Radar's data — 118:1 overall and 32.7:1 in News & Publications, versus OpenAI 887:1 and Anthropic ~50,000:1 — meaning an allow here returns more actual referral traffic per page crawled than any other AI operator.

**Counter-evidence:** Perplexity has been publicly accused of crawling from undeclared user agents and rotating IPs to evade blocks (a widely reported 2025 dispute), so a PerplexityBot disallow may not be sufficient to prevent access. Independent 2026 reporting also indicates Perplexity's crawl-to-refer ratio has worsened (~225:1), eroding the referral argument. The 'not used for training' claim is vendor-asserted and unverifiable externally.
**Consumers:** PerplexityBot · **Recommended tier:** scored

**Sources:** [Perplexity Crawlers](https://docs.perplexity.ai/guides/bots) · [A deeper look at AI crawlers: breaking down traffic by purpose and industry](https://blog.cloudflare.com/ai-crawler-traffic-by-purpose-and-industry/)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
