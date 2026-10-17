---
audit: access-crawl-control/agent-governance
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/agent-governance.ts
slug: agent-governance
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - rfc9309
  - s18
  - anthropic-crawlers
  - perplexity-bots-docs
  - google-robots-meta-tag
  - cloudflare-block-ai-bots
---

# agent-governance (`2.28`)

> crawler-permissions · source `agent-governance.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Not all AI bots are the same. Training crawlers like GPTBot, CCBot, and Google-Extended scrape your content to build datasets, while conversational and retrieval agents like ChatGPT-User, Claude-User, and OAI-SearchBot fetch pages live to answer real user questions and can send referral traffic back to you. Many sites want to block the former while welcoming the latter — but a single catch-all User-agent: * cannot express that distinction. Granular robots.txt governance names both categories explicitly so each gets the access policy you actually intend.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** Each major AI vendor operates separate robots.txt product tokens for dataset-training crawling and for live retrieval or search grounding. Per RFC 9309, a crawler obeys the group matching its own token, and falls back to `*` only when no such group exists. A robots.txt that names the two categories separately therefore produces different access outcomes for training and for live retrieval — an outcome a catch-all group alone cannot express.

**Grade: A** — this is a ratified standard (RFC 9309) whose group-matching rule is documented as honored by the named consumers, and OpenAI, Anthropic and Perplexity each publish the training-vs-retrieval token split the audit is built around.

**Evidence:**

- RFC 9309 §2.2.1: "Crawlers MUST use case-insensitive matching to find the group that matches the product token and then obey the rules of the group". If no specific match exists, "crawlers MUST obey the group with a user-agent line with the '*' value, if present". A specific group therefore overrides the catch-all for that agent — the exact capability the audit measures — https://www.rfc-editor.org/rfc/rfc9309.html (verified 2026-08-21)
- OpenAI documents the split directly. **GPTBot** is "used to make our generative AI foundation models more useful and safe", and "Disallowing GPTBot indicates a site's content should not be used in training generative AI foundation models". **OAI-SearchBot** is "used to surface websites in search results in ChatGPT's search features", and "we recommend allowing OAI-SearchBot in your site's robots.txt file". **ChatGPT-User** is user-initiated — https://developers.openai.com/api/docs/bots (verified 2026-08-21)
- Anthropic operates three tokens with distinct purposes — **ClaudeBot** (training-corpus collection), **Claude-User** (user-initiated fetches), **Claude-SearchBot** (search-quality analysis) — and documents per-agent robots.txt groups (`User-agent: ClaudeBot` / `Disallow: /`) — https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler (verified 2026-08-21)
- Perplexity documents the same distinction: **PerplexityBot** is "designed to surface and link websites in search results on Perplexity. It is not used to crawl content for AI foundation models" and respects robots.txt; **Perplexity-User** "Generally ignores robots.txt rules" — https://docs.perplexity.ai/guides/bots (verified 2026-08-21)
- Google's robots meta documentation shows the same category separation on the output side — `nosnippet`/`max-snippet` gate use "as a direct input for AI Overviews and AI Mode" independently of ordinary indexing — https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag (verified 2026-08-21)
- Infrastructure has converged on the same taxonomy: Cloudflare's AI bot controls are grouped as **Search**, **Agent** and **Training** categories, confirming the training/realtime split is an operational reality and not a taxonomy this project invented — https://developers.cloudflare.com/bots/additional-configurations/block-ai-bots/ (verified 2026-08-21)

**Counter-evidence:** The A grade covers the _capability_ — separate tokens genuinely receive separate policies. It does not support the audit's pass criterion. No vendor documentation rewards the mere **presence** of granular groups. A bare `User-agent: *` with `Allow: /` grants every named agent identical full access under the RFC 9309 fallback rule. The current FAIL on that configuration therefore contradicts the cited standard. Two further limits apply. OpenAI states that for `ChatGPT-User`, "Because these actions are initiated by a user, robots.txt rules may not apply". Perplexity states that `Perplexity-User` "Generally ignores robots.txt rules". An `Allow: /` group welcoming user-initiated agents is therefore largely a no-op, and the realtime half of the recommended fix carries less weight than the description implies. Vendor propagation delay is also documented (OpenAI: "it can take ~24 hours from a site's robots.txt update for our systems to adjust"), so robots.txt state and observed agent behavior can legitimately diverge at scan time.

## Implementation deviations

- The verdict with no named AI agents depends on the catch-all, because RFC 9309 §2.2.1 falls back to `*` only when no group names the token.
- An open catch-all, or no restriction at all, is not applicable. Every agent already has the access the named groups would grant.
- A catch-all blanket block with no named agents fails. The fallback carries the block onto the live retrieval agents too.
- A blanket block with a named carve-out for a live agent is differentiation, not a blanket block. A test pins it.
- Both categories named, two of each or with different policies, pass. One category only warns.
- `failureTitle` is "Blanket robots.txt block also shuts out live AI agents", the only case left that fails.
