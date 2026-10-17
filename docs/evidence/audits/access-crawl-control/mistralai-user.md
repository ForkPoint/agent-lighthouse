---
audit: access-crawl-control/mistralai-user
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/mistralai-user.ts
slug: mistralai-user
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: scored
consumers:
  - MistralAI-User
  - MistralAI-Index
  - MistralAI-Training
signals:
  - name: MistralAI-User allow/block state in robots.txt (and MistralAI-Index / MistralAI-Training)
    grade: A
    domain: robots-ai-crawlers
sources:
  - rfc-9309
  - mistral-robots-docs
  - cloudflare-ai-crawler-purpose-industry
---

# mistralai-user (`2.20`)

> crawler-permissions · source `mistralai-user.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Reads the robots.txt rules that apply to MistralAI-User — its own group if it has one, otherwise the catch-all — and reports whether they let it fetch the site root. A named group is not required: under RFC 9309 §2.2.1 an open catch-all grants the same access.

## Evidence

### Signal: MistralAI-User allow/block state in robots.txt (and MistralAI-Index / MistralAI-Training) — grade A (robots-ai-crawlers)

**Mechanism:** Mistral publishes three separate tokens with distinct consequences:

- a MistralAI-Training disallow blocks training-corpus collection;
- a MistralAI-Index disallow removes the site from Mistral search, and therefore from Vibe answers;
- MistralAI-User governs which sites user-initiated Vibe requests may access.

Unusually, Mistral asserts no user-initiated robots.txt exemption.

**Grade: A** — Mistral publishes all three tokens on one page, with distinct stated consequences. For this one it says the thing that matters: robots.txt "governs which sites user requests can access", and the agent is "not used for crawling the web in any automatic fashion". Like Anthropic and unlike OpenAI, Perplexity and Meta, Mistral asserts no user-initiated exemption — so the directive is expected to be honoured. Named agent, named directive, stated behaviour: grade A. The referral case for the sibling index token is weak, at a reported ~3,389 pages crawled per referral sent, but that is an argument about worth rather than about evidence.

**Evidence:** Mistral's robots page documents all three UAs, each carrying '+https://docs.mistral.ai/robots'. MistralAI-User/1.0. 'When users ask Vibe a question, it may visit a web page to help answer'. robots.txt 'governs which sites user requests can access'. The agent is 'not used for crawling the web in any automatic fashion, nor to crawl content for generative AI training'. MistralAI-Index/1.0: 'It indexes content for Mistral search, which helps answer user questions in Vibe', content 'not used for generative AI training of any kind'. MistralAI-Training/1.0: 'Webmasters can disallow this user agent in their robots.txt file.' The clean training/index/user separation makes per-token scoring straightforward and MistralAI-User is notably the only major user-initiated agent whose vendor does not claim a robots.txt exemption.

**Counter-evidence:** Mistral is the most extractive operator by 2026 crawl-to-refer measurement (reported at ~3,389 pages crawled per referral sent, worse than Anthropic and far worse than OpenAI), so the allow-side referral argument for MistralAI-Index is weak. Mistral bots do not appear in Cloudflare Radar's Aug 2025 named top-five breakdowns, so historical volume was small. Audits keyed only to 'MistralAI-User' will miss the two higher-impact tokens.

## Implementation deviations

The shared base class `_crawler-bot-audit.ts` grades access, not the shape of the file.

- The audit passes when the rules that apply to MistralAI-User permit `/`: its own group, the catch-all, or no applicable group. Under RFC 9309 §2.2.1 an open catch-all grants the same access a named group would.
- The message names which of the three applied. A disallow that reaches the token fails.
- An unreadable robots.txt is not applicable: missing, non-200, an empty body, or a 200 that parses to no groups and no sitemaps. RFC 9309 §2.3.1.3 lets a crawler access everything when the file is unavailable.
- The fail remedy warns that a named `Allow: /` group replaces the catch-all for that bot and drops its catch-all `Disallow` lines.

## Deferred

- **A 5xx robots.txt.** RFC 9309 §2.3.1.4 tells a crawler to assume a complete
  disallow when robots.txt is unreachable. This audit reports any non-200 as
  not applicable and does not grade that case.
