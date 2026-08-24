---
audit: access-crawl-control/mistralai-user
audit_id: "2.20"
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/mistralai-user.ts
slug: mistralai-user
review_verdict: fix
severity: low
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# mistralai-user (`2.20`)

> crawler-permissions · source `mistralai-user.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Without an explicit robots.txt rule, MistralAI-User may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.

## Code review findings (2026-08-20, 11-agent pass)

Legitimate but small: MistralAI-User backs Le Chat's web access, a real though low-volume surface concentrated in EU markets. Keeping it is defensible; weighting it identically to GPTBot and ChatGPT-User is not. Unmodified base class, all shared defects apply, and like the other realtime fetchers the actually-decisive failure mode (edge UA blocking) is unobservable.

**Required fix:** Reduce weight to a long-tail tier. Apply the shared helper fixes from 2.1 including prefix matching for `MistralAI*`.

**False-positive risks:**
- Edge UA blocking invisible to the `AgentLighthouse/1.0` scanner — PASS while Le Chat cannot fetch.
- Exact-match miss on versioned tokens; also `User-agent: MistralAI` shorthand matches nothing.
- Weight 1.0 equal to GPTBot despite far smaller reach.
- Shared BOM / soft-404 / `Disallow: /*` misreads.

**Test gaps:**
- No shorthand/versioned token case.
- No UA-probe coverage.
- Template-only coverage; same missing real-world robots.txt variants as 2.1.

**Overlaps with:** `2.22`, `2.28`

## Evidence

### Signal: MistralAI-User allow/block state in robots.txt (and MistralAI-Index / MistralAI-Training) — grade A (robots-ai-crawlers)

**Mechanism:** Mistral publishes three separate tokens with distinct consequences: MistralAI-Training disallow blocks training-corpus collection; MistralAI-Index disallow removes the site from Mistral search (and thus Vibe answers); MistralAI-User governs which sites user-initiated Vibe requests may access — and, unusually, Mistral asserts no user-initiated robots.txt exemption.

**Evidence:** Mistral's robots page documents all three UAs, each carrying '+https://docs.mistral.ai/robots'. MistralAI-User/1.0: 'When users ask Vibe a question, it may visit a web page to help answer', robots.txt 'governs which sites user requests can access', and it is 'not used for crawling the web in any automatic fashion, nor to crawl content for generative AI training'. MistralAI-Index/1.0: 'It indexes content for Mistral search, which helps answer user questions in Vibe', content 'not used for generative AI training of any kind'. MistralAI-Training/1.0: 'Webmasters can disallow this user agent in their robots.txt file.' The clean training/index/user separation makes per-token scoring straightforward and MistralAI-User is notably the only major user-initiated agent whose vendor does NOT claim a robots.txt exemption.

**Counter-evidence:** Mistral is the most extractive operator by 2026 crawl-to-refer measurement (reported at ~3,389 pages crawled per referral sent, worse than Anthropic and far worse than OpenAI), so the allow-side referral argument for MistralAI-Index is weak. Mistral bots do not appear in Cloudflare Radar's Aug 2025 named top-five breakdowns, so historical volume was small. Audits keyed only to 'MistralAI-User' will miss the two higher-impact tokens.
**Consumers:** MistralAI-User, MistralAI-Index, MistralAI-Training · **Recommended tier:** scored

**Sources:** [Mistral AI crawlers and robots.txt](https://docs.mistral.ai/robots/) (verified 2026-08-20) · [A deeper look at AI crawlers: breaking down traffic by purpose and industry](https://blog.cloudflare.com/ai-crawler-traffic-by-purpose-and-industry/) (verified 2026-08-20)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
