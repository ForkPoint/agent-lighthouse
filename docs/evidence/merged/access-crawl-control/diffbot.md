---
audit: access-crawl-control/diffbot
audit_id: "2.12"
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/diffbot.ts
slug: diffbot
review_verdict: delete
severity: low
evidence_grade: C
disposition: "proposed: redeem as scored (pending triage)"
reviewed: 2026-08-21
---

# diffbot (`2.12`)

> crawler-permissions · source `diffbot.ts` · review verdict **delete** · evidence grade **C** · disposition: **proposed: redeem as scored (pending triage)**

## What it checks

Without an explicit robots.txt rule, Diffbot may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.

## Code review findings (2026-08-20, 11-agent pass)

Falsy for this tool's stated purpose. Diffbot is a commercial B2B knowledge-graph and extraction vendor — end users do not query Diffbot and it produces no citations or referral traffic. Allowing it means allowing a paid scraper to resell structured extractions of the site's content, which many operators reasonably decline. Framing that decision as a high-priority AI-visibility FAIL is misleading: blocking Diffbot costs a site nothing in ChatGPT, Claude, Gemini or Perplexity visibility.

**Required fix:** Remove from the scored roster, or fold into a zero-weight informational 'commercial extraction crawlers' note that presents blocking as a legitimate choice rather than a failure.

**False-positive risks:**

- A site that deliberately blocks a commercial scraper receives a high-priority FAIL implying lost AI search visibility that it has not lost.
- Weight 1.0 equal to GPTBot.
- Shared exact-match / BOM / soft-404 misreads.

**Test gaps:**

- Template-only; no validation that allowing Diffbot changes any agent-visible outcome.
- Same missing real-world robots.txt variants as 2.1.

**Overlaps with:** `2.22`, `2.28`

## Evidence

### Signal: Diffbot allow/block state in robots.txt — grade C (robots-ai-crawlers)

**Mechanism:** Diffbot crawls sites to resell structured extractions to third-party AI systems; a disallow is expected to be honored but is not backed by a locatable vendor compliance statement.

**Evidence:** Known Agents types Diffbot as an AI Data Provider — 'Crawls websites to supply structured content to AI systems as a third-party service' — with UA 'Mozilla/5.0 (compatible; Diffbot/1.0; +https://diffbot.com)' and a notably high 14% top-website blocking rate as of Aug 2026, indicating real, recognized field presence. As a data broker it is a second-order AI exposure: blocking the named AI crawlers while allowing Diffbot can still route content into AI systems.

**Counter-evidence:** No vendor documentation was reachable: docs.diffbot.com's crawler guide 301s to diffbot.com/docs/ and no dedicated robots.txt/compliance page was located. Diffbot does not appear in Cloudflare Radar's named AI-crawler breakdowns. Notably, Diffbot's crawl product has historically offered customers an option to disregard robots.txt for their own crawls, so the token's behavior may vary by customer job — unverified but a reason not to score it. AI data providers as a class are only 0.4% of all web traffic.
**Consumers:** Diffbot · **Recommended tier:** informative

**Sources:** [Diffbot — Known Agents](https://knownagents.com/agents/diffbot)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

**Merged into:** `access-crawl-control/ai-bot-directives` (Plan 4, 2026-08-22) — [merged dossier](../../audits/access-crawl-control/ai-bot-directives.md)
