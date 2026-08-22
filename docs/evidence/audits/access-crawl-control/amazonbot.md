---
audit: access-crawl-control/amazonbot
audit_id: "2.8"
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/amazonbot.ts
slug: amazonbot
review_verdict: fix
severity: medium
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# amazonbot (`2.8`)

> crawler-permissions · source `amazonbot.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Without an explicit robots.txt rule, Amazonbot may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.

## Code review findings (2026-08-20, 11-agent pass)

Amazonbot is live (Alexa+ and Rufus grounding) and for commerce sites it is a genuine citation surface, so the signal is worth keeping. But it is registered in `TRAINING_CRAWLERS` when its dominant use is realtime grounding for Alexa/Rufus answers, which mis-feeds 2.28's training-vs-realtime verdict — the same taxonomy error as PerplexityBot. All base-class defects apply unchanged.

**Required fix:** Reclassify Amazonbot as realtime/grounding rather than training. Apply the shared helper fixes from 2.1.

**False-positive risks:**
- Miscategorized as `training`, corrupting 2.28's `categoryBlocked` computation for sites with deliberate, correct policies.
- Exact-match miss on versioned tokens.
- Shared BOM / soft-404 / `Disallow: /*` misreads.
- For non-commerce sites the fail carries a high-priority weight identical to GPTBot's, overstating impact.

**Test gaps:**
- No category-classification assertion.
- Same missing real-world robots.txt variants as 2.1.

**Overlaps with:** `2.22`, `2.28`

## Evidence

### Signal: Amazonbot allow/block state in robots.txt — grade A (robots-ai-crawlers)

**Mechanism:** Disallowing Amazonbot stops Amazon crawling the site for product/service improvement and possible Amazon AI model training; Amazon states the bot honors user-agent and allow/disallow directives but ignores crawl-delay.

**Evidence:** Amazon documents UA 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Amazonbot/0.1) Chrome/W.X.Y.Z Safari/537.36', purpose 'Amazonbot is used to improve our products and services', that it 'may be used to train Amazon AI models', and compliance: 'Automated crawling from these listed user agents respects the Robots Exclusion Protocol, honoring the user-agent and the allow/disallow directives.' Active at scale — Cloudflare Radar ranked Amazonbot second only to GPTBot in the Computer & Electronics vertical (Aug 2025). Amazon also now documents a separate Amzn-SearchBot which 'does not crawl content for generative AI model training', so audits should treat the two tokens distinctly.

**Counter-evidence:** Explicit vendor negative on a related directive: 'They do not support the crawl-delay directive' — so any audit that recommends crawl-delay for Amazonbot is recommending a no-op. Amazon publishes no consequence statement for blocking (no equivalent of OpenAI's search-exclusion warning), so the visibility cost of a block is undocumented.
**Consumers:** Amazonbot, Amzn-SearchBot · **Recommended tier:** scored

**Sources:** [Amazonbot](https://developer.amazon.com/amazonbot) · [A deeper look at AI crawlers: breaking down traffic by purpose and industry](https://blog.cloudflare.com/ai-crawler-traffic-by-purpose-and-industry/)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
