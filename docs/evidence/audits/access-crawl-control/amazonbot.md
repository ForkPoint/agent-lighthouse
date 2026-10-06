---
audit: access-crawl-control/amazonbot
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/amazonbot.ts
slug: amazonbot
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: scored
consumers:
  - Amazonbot
  - Amzn-SearchBot
signals:
  - name: Amazonbot allow/block state in robots.txt
    grade: A
    domain: robots-ai-crawlers
sources:
  - rfc-9309
  - amazonbot-docs
  - cloudflare-ai-crawler-purpose-industry
---

# amazonbot (`2.8`)

> crawler-permissions · source `amazonbot.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Reads the robots.txt rules that apply to Amazonbot — its own group if it has one, otherwise the catch-all — and reports whether they let it fetch the site root. A named group is not required: under RFC 9309 §2.2.1 an open catch-all grants the same access.

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

**Grade: A** — Amazon publishes a crawler page naming the exact product token. It states the purpose: "Amazonbot is used to improve our products and services", and content "may be used to train Amazon AI models". It asserts robots.txt compliance for that user agent. That is documented consumer behaviour for the directive this audit reads, which is the grade-A bar. What Amazon does _not_ publish is any statement of what blocking costs, so the audit reports the directive's state and does not argue a visibility case.

**Evidence:** Amazon documents the UA as 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Amazonbot/0.1) Chrome/W.X.Y.Z Safari/537.36'. It states the purpose — 'Amazonbot is used to improve our products and services' — and that the data 'may be used to train Amazon AI models'. It states compliance too: 'Automated crawling from these listed user agents respects the Robots Exclusion Protocol, honoring the user-agent and the allow/disallow directives.' The bot is active at scale: Cloudflare Radar ranked Amazonbot second only to GPTBot in the Computer & Electronics vertical (Aug 2025). Amazon also now documents a separate Amzn-SearchBot which 'does not crawl content for generative AI model training', so audits should treat the two tokens distinctly.

**Counter-evidence:** Explicit vendor negative on a related directive: 'They do not support the crawl-delay directive' — so any audit that recommends crawl-delay for Amazonbot is recommending a no-op. Amazon publishes no consequence statement for blocking (no equivalent of OpenAI's search-exclusion warning), so the visibility cost of a block is undocumented.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Implementation deviations

### Inherited access passes (2026-10-06)

The audit scored the shape of the file, not the access it grants. The shared
base class `_crawler-bot-audit.ts` passed only when a group named Amazonbot. It
warned at 0.5 when Amazonbot was allowed through `User-agent: *` or by no rule
at all.

Nothing in the evidence supports that split. The grade rests on what a
disallow does, which is a fact about the block state. RFC 9309 §2.2.1 makes a
crawler obey the group that names its product token and fall back to `*`
only when none does. An open catch-all therefore grants the same access a
named group would.

The rule now asks one question: do the rules that apply to Amazonbot permit `/`?
Allowed by its own group, through the catch-all, or by no applicable group
all pass. The message names which one applied. A disallow that reaches the
token still fails.

An unreadable robots.txt is not applicable rather than a warn: missing,
non-200, an empty body, or a 200 that parses to no groups and no directives.
RFC 9309 §2.3.1.3 lets a crawler access everything when the file is
unavailable, and no source here documents a cost for its absence.

The old fix, add `User-agent: Amazonbot` / `Allow: /`, is withdrawn as advice for
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
