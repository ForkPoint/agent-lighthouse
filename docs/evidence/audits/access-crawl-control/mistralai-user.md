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

**Mechanism:** Mistral publishes three separate tokens with distinct consequences:

- a MistralAI-Training disallow blocks training-corpus collection;
- a MistralAI-Index disallow removes the site from Mistral search, and therefore from Vibe answers;
- MistralAI-User governs which sites user-initiated Vibe requests may access.

Unusually, Mistral asserts no user-initiated robots.txt exemption.

**Grade: A** — Mistral publishes all three tokens on one page, with distinct stated consequences. For this one it says the thing that matters: robots.txt "governs which sites user requests can access", and the agent is "not used for crawling the web in any automatic fashion". Like Anthropic and unlike OpenAI, Perplexity and Meta, Mistral asserts no user-initiated exemption — so the directive is expected to be honoured. Named agent, named directive, stated behaviour: grade A. The referral case for the sibling index token is weak, at a reported ~3,389 pages crawled per referral sent, but that is an argument about worth rather than about evidence.

**Evidence:** Mistral's robots page documents all three UAs, each carrying '+https://docs.mistral.ai/robots'. MistralAI-User/1.0. 'When users ask Vibe a question, it may visit a web page to help answer'. robots.txt 'governs which sites user requests can access'. The agent is 'not used for crawling the web in any automatic fashion, nor to crawl content for generative AI training'. MistralAI-Index/1.0: 'It indexes content for Mistral search, which helps answer user questions in Vibe', content 'not used for generative AI training of any kind'. MistralAI-Training/1.0: 'Webmasters can disallow this user agent in their robots.txt file.' The clean training/index/user separation makes per-token scoring straightforward and MistralAI-User is notably the only major user-initiated agent whose vendor does not claim a robots.txt exemption.

**Counter-evidence:** Mistral is the most extractive operator by 2026 crawl-to-refer measurement (reported at ~3,389 pages crawled per referral sent, worse than Anthropic and far worse than OpenAI), so the allow-side referral argument for MistralAI-Index is weak. Mistral bots do not appear in Cloudflare Radar's Aug 2025 named top-five breakdowns, so historical volume was small. Audits keyed only to 'MistralAI-User' will miss the two higher-impact tokens.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Implementation deviations

### Inherited access passes (2026-10-06)

The audit scored the shape of the file, not the access it grants. The shared
base class `_crawler-bot-audit.ts` passed only when a group named MistralAI-User. It
warned at 0.5 when MistralAI-User was allowed through `User-agent: *` or by no rule
at all.

Nothing in the evidence supports that split. The grade rests on what a
disallow does, which is a fact about the block state. RFC 9309 §2.2.1 makes a
crawler obey the group that names its product token and fall back to `*`
only when none does. An open catch-all therefore grants the same access a
named group would.

The rule now asks one question: do the rules that apply to MistralAI-User permit `/`?
Allowed by its own group, through the catch-all, or by no applicable group
all pass. The message names which one applied. A disallow that reaches the
token still fails.

An unreadable robots.txt is not applicable rather than a warn: missing,
non-200, an empty body, or a 200 that parses to no groups and no directives.
RFC 9309 §2.3.1.3 lets a crawler access everything when the file is
unavailable, and no source here documents a cost for its absence.

The old fix, add `User-agent: MistralAI-User` / `Allow: /`, is withdrawn as advice for
an allowed site. A named group replaces the catch-all for that bot, so it
drops every catch-all `Disallow` the site still meant to apply. The fail
remedy now says so.

`access-crawl-control/meta-external-agent` and
`access-crawl-control/anthropic-ai` made the same change on 2026-08-24. The
base class now matches them.

Grade, tier and weight are unchanged.

## Deferred

- **A 5xx robots.txt.** RFC 9309 §2.3.1.4 tells a crawler to assume a complete
  disallow when robots.txt is unreachable. This audit reports any non-200 as
  not applicable and does not grade that case.
