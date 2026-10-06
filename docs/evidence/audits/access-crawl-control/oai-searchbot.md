---
audit: access-crawl-control/oai-searchbot
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/oai-searchbot.ts
slug: oai-searchbot
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: scored
consumers:
  - OAI-SearchBot
signals:
  - name: OAI-SearchBot allow/block state in robots.txt
    grade: A
    domain: robots-ai-crawlers
sources:
  - rfc-9309
  - s18
  - pebblous-blocking-citation-gap
---

# oai-searchbot (`2.16`)

> crawler-permissions · source `oai-searchbot.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Reads the robots.txt rules that apply to OAI-SearchBot — its own group if it has one, otherwise the catch-all — and reports whether they let it fetch the site root. A named group is not required: under RFC 9309 §2.2.1 an open catch-all grants the same access.

## Code review findings (2026-08-20, 11-agent pass)

High-value and correctly scoped — OAI-SearchBot builds the ChatGPT Search index, so blocking it removes a site from ChatGPT search results entirely. Worth keeping and worth weighting above the training crawlers. Implementation is the unmodified base class, so it carries every shared defect, and the same edge-UA blind spot.

**Required fix:** Raise weight above the training tier, add an OAI-SearchBot UA probe, and apply the shared helper fixes from 2.1.

**False-positive risks:**

- Edge UA blocking invisible to the scanner — PASS while OAI-SearchBot is 403'd.
- Exact-match miss on `User-agent: OAI-SearchBot/1.0`.
- A site writing `User-agent: OAI-SearchBot` alongside `User-agent: GPTBot` with divergent policies is fine, but one writing the shorthand `User-agent: OAI-` matches nothing.
- Shared BOM / soft-404 / `Disallow: /*` misreads.

**Test gaps:**

- No versioned or shorthand token case.
- No UA-probe coverage.
- Same missing real-world robots.txt variants as 2.1.

**Overlaps with:** `2.22`, `2.28`

## Evidence

### Signal: OAI-SearchBot allow/block state in robots.txt — grade A (robots-ai-crawlers)

**Mechanism:** Disallowing OAI-SearchBot causes the site to be excluded from ChatGPT search answers. This is the single strongest documented allow-side signal in the whole domain: blocking it directly destroys AI answer visibility.

**Grade: A** — This is the strongest allow-side statement in the category, and it is causal rather than descriptive: "Sites that are opted out of OAI-SearchBot will not be shown in ChatGPT search answers." OpenAI names the token, publishes the user agent and an IP list, and states the consequence itself. That is well past the grade-A bar. One tension is on the record: an independent measurement found 82.4% citation retention among sites blocking the token, which suggests lagged enforcement or citation through other surfaces. The vendor's stated policy is what the audit scores, and the copy states the measurement rather than hiding it.

**Evidence:** OpenAI documents this as a direct causal consequence: 'Sites that are opted out of OAI-SearchBot will not be shown in ChatGPT search answers.' UA 'OAI-SearchBot/1.4; +https://openai.com/searchbot', IPs at openai.com/searchbot.json. This is a vendor-stated, falsifiable behavioral claim, not an inference — grade A, and it justifies scoring an OAI-SearchBot disallow as a negative for any site that wants AI answer visibility.

**Counter-evidence:** BuzzStream/XOFU measured 82.4% citation retention even among sites blocking OAI-SearchBot, suggesting either lagged enforcement, citation via other surfaces, or content reached through ChatGPT-User. The vendor claim and the field measurement are in tension; the vendor claim is the stated policy and should be scored, but the audit copy should not promise total disappearance.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Implementation deviations

### Inherited access passes (2026-10-06)

The audit scored the shape of the file, not the access it grants. The shared
base class `_crawler-bot-audit.ts` passed only when a group named OAI-SearchBot. It
warned at 0.5 when OAI-SearchBot was allowed through `User-agent: *` or by no rule
at all.

Nothing in the evidence supports that split. The grade rests on what a
disallow does, which is a fact about the block state. RFC 9309 §2.2.1 makes a
crawler obey the group that names its product token and fall back to `*`
only when none does. An open catch-all therefore grants the same access a
named group would.

The rule now asks one question: do the rules that apply to OAI-SearchBot permit `/`?
Allowed by its own group, through the catch-all, or by no applicable group
all pass. The message names which one applied. A disallow that reaches the
token still fails.

An unreadable robots.txt is not applicable rather than a warn: missing,
non-200, an empty body, or a 200 that parses to no groups and no directives.
RFC 9309 §2.3.1.3 lets a crawler access everything when the file is
unavailable, and no source here documents a cost for its absence.

The old fix, add `User-agent: OAI-SearchBot` / `Allow: /`, is withdrawn as advice for
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
