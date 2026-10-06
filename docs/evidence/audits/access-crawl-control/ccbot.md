---
audit: access-crawl-control/ccbot
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/ccbot.ts
slug: ccbot
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: scored
consumers:
  - CCBot
signals:
  - name: CCBot allow/block state in robots.txt
    grade: A
    domain: robots-ai-crawlers
sources:
  - rfc-9309
  - commoncrawl-ccbot
  - consent-in-crisis-arxiv
---

# ccbot (`2.6`)

> crawler-permissions · source `ccbot.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Reads the robots.txt rules that apply to CCBot — its own group if it has one, otherwise the catch-all — and reports whether they let it fetch the site root. A named group is not required: under RFC 9309 §2.2.1 an open catch-all grants the same access.

## Code review findings (2026-08-20, 11-agent pass)

CCBot is still active and Common Crawl still feeds many downstream training sets, so the signal is real — but this is the audit where the shared exact-match bug bites hardest. `User-agent: CCBot/2.0` is the form propagated by years of copy-pasted robots.txt snippets and by Common Crawl's own historical documentation, and it is invisible to `isAllowed`. A site that deliberately blocks Common Crawl with `User-agent: CCBot/2.0\nDisallow: /` is reported as 'allowed by default' — the audit tells the user their content is reachable when it is not.

**Required fix:** Ship the version-token normalization in `_robots-txt-helpers.ts` (strip `/<version>` before comparison) and add `CCBot/2.0` as an explicit regression test. Soften `impact` to reflect the multi-month lag between a Common Crawl snapshot and any model that consumes it.

**False-positive risks:**

- `g.userAgent.toLowerCase() === 'ccbot'` fails against the extremely common `User-agent: CCBot/2.0`, inverting block detection.
- Passing this audit gives no near-term AI benefit: Common Crawl snapshots enter model corpora on a multi-month-to-multi-year lag, so the `impact` framing of reach across AI systems is not actionable for current visibility.
- Shared BOM / soft-404 / `Disallow: /*` misreads.

**Test gaps:**

- No `User-agent: CCBot/2.0` test — the single most likely real-world form for this specific bot.
- Same missing real-world robots.txt variants as 2.1.

**Overlaps with:** `2.22`, `2.28`

## Evidence

### Signal: CCBot allow/block state in robots.txt — grade A (robots-ai-crawlers)

**Mechanism:** Disallowing CCBot keeps the site out of the Common Crawl corpus. That corpus is the upstream source for C4, RefinedWeb and Dolma, and therefore for many LLM training sets. A block here has downstream training effects far beyond one operator.

**Grade: A** — Common Crawl publishes the exact user agent and the canonical opt-out snippet. The downstream leverage is measured rather than asserted. The Data Provenance Initiative's "Consent in Crisis" audited 14,000 domains. Within a single year, robots.txt restrictions had rendered "~5%+ of all tokens in C4, or 28%+ of the most actively maintained, critical sources in C4, fully restricted from use". A documented token with a measured corpus effect is grade A.

**Evidence:** Common Crawl publishes UA 'CCBot/2.0 (https://commoncrawl.org/faq/)' and the canonical opt-out snippet 'User-agent: CCBot / Disallow: /'. The training-corpus leverage is quantified by the Data Provenance Initiative's 'Consent in Crisis', which audited 14,000 domains. Within a single year (2023-2024), robots.txt restrictions rendered '~5%+ of all tokens in C4, or 28%+ of the most actively maintained, critical sources in C4, fully restricted from use'. CCBot is therefore the highest-leverage single token for training-data opt-out.

**Counter-evidence:** Blocking CCBot is retroactively useless — historical Common Crawl snapshots are already published and permanently redistributable, so a block only affects future crawls. Common Crawl warns that 'crawlers falsely identifying themselves as CCBot' exist, so a disallow does not stop spoofers; operators should verify by reverse DNS against published IP ranges. Common Crawl's own page states no crawl-delay position and does not frame itself as AI training infrastructure.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Implementation deviations

### Inherited access passes (2026-10-06)

The audit scored the shape of the file, not the access it grants. The shared
base class `_crawler-bot-audit.ts` passed only when a group named CCBot. It
warned at 0.5 when CCBot was allowed through `User-agent: *` or by no rule
at all.

Nothing in the evidence supports that split. The grade rests on what a
disallow does, which is a fact about the block state. RFC 9309 §2.2.1 makes a
crawler obey the group that names its product token and fall back to `*`
only when none does. An open catch-all therefore grants the same access a
named group would.

The rule now asks one question: do the rules that apply to CCBot permit `/`?
Allowed by its own group, through the catch-all, or by no applicable group
all pass. The message names which one applied. A disallow that reaches the
token still fails.

An unreadable robots.txt is not applicable rather than a warn: missing,
non-200, an empty body, or a 200 that parses to no groups and no directives.
RFC 9309 §2.3.1.3 lets a crawler access everything when the file is
unavailable, and no source here documents a cost for its absence.

The old fix, add `User-agent: CCBot` / `Allow: /`, is withdrawn as advice for
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
