---
audit: access-crawl-control/bravebot
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/bravebot.ts
slug: bravebot
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: informative
consumers:
  - none-confirmed (Brave states its crawler uses no differentiated UA; a Bravebot/1.0 UA is observed in third-party directories)
signals:
  - name: BraveBot / Bravebot allow/block state in robots.txt
    grade: C
    domain: robots-ai-crawlers
sources:
  - rfc-9309
  - brave-search-crawler
  - knownagents-bravebot
---

# bravebot (`2.18`)

> crawler-permissions · source `bravebot.ts` · review verdict **fix** · evidence grade **C** · disposition: **keep — fix required**

## What it checks

Reads the robots.txt rules that apply to Bravebot — its own group if it has one, otherwise the catch-all — and reports whether they let it fetch the site root. A named group is not required: under RFC 9309 §2.2.1 an open catch-all grants the same access.

## Code review findings (2026-08-20, 11-agent pass)

Token is real (Brave Search's crawler) but the value is thin: Brave Search builds its index substantially from the anonymized Web Discovery Project rather than crawl alone, and Brave Leo's citation surface is small. Keeping it at weight 1.0 — equal to GPTBot — overstates its importance. The token string should also be verified against Brave's current crawler documentation before shipping guidance that tells users to hand-write it into robots.txt; an incorrect token in the `code` block produces a directive that does nothing while the audit reports a pass for having written it.

**Required fix:** Verify the token against Brave's current crawler documentation and add a `docsUrl` so it is auditable. Reduce `weight` to reflect the small citation surface. Apply the shared helper fixes from 2.1.

**False-positive risks:**

- If the documented token differs from `Bravebot`, the audit passes sites that added a no-op line and fails sites that used the correct token — a self-confirming loop where the tool grades its own string rather than reality. Nothing in the code or tests validates the token against Brave's docs (note the audit ships without a `docsUrl`, unlike GPTBot/PerplexityBot/Amazonbot).
- Exact-match miss on versioned tokens.
- Weight 1.0 equal to GPTBot despite a far smaller citation surface.
- Shared BOM / soft-404 / `Disallow: /*` misreads.

**Test gaps:**

- No verification that the token matches Brave's published crawler UA.
- Template-only coverage; same missing real-world robots.txt variants as 2.1.

**Overlaps with:** `2.22`, `2.28`

## Evidence

### Signal: BraveBot / Bravebot allow/block state in robots.txt — grade C (robots-ai-crawlers)

**Mechanism:** A 'Bravebot' disallow is intended to block Brave Search's crawler. But Brave's own documentation states its crawler deliberately does not advertise a differentiated user agent. The token therefore has no vendor-confirmed consumer and the rule is likely a no-op.

**Evidence:** Known Agents lists a Bravebot entry with UA 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Bravebot/1.0; +https://search.brave.com/help/brave-search-crawler) Chrome/W.X.Y.Z Safari/537.36' and only 2% top-website blocking as of 2026-08-19 — the lowest of any token in this set, indicating near-zero operator recognition.

**Counter-evidence:** The vendor refutes this directly: Brave's own crawler help page states 'The Brave Search crawler does not advertise a differentiated user agent because we must avoid discrimination from websites that allow only Google to crawl them.' Brave further states 'robots.txt is not used to prevent a page from being indexed. A site owner can delist a page by using the robots noindex directive' — i.e. Brave directs publishers to noindex, not to a robots.txt token. Brave's page makes no mention of AI training, data licensing, or Brave Leo in connection with the crawler. Given the vendor contradicts the token's existence and blocking adoption is 2%, this should never be scored; consider demoting the audit toward deletion unless a Brave-published token is confirmed.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Implementation deviations

### Inherited access passes (2026-10-06)

The audit scored the shape of the file, not the access it grants. The shared
base class `_crawler-bot-audit.ts` passed only when a group named Bravebot. It
warned at 0.5 when Bravebot was allowed through `User-agent: *` or by no rule
at all.

Nothing in the evidence supports that split. The grade rests on what a
disallow does, which is a fact about the block state. RFC 9309 §2.2.1 makes a
crawler obey the group that names its product token and fall back to `*`
only when none does. An open catch-all therefore grants the same access a
named group would.

The rule now asks one question: do the rules that apply to Bravebot permit `/`?
Allowed by its own group, through the catch-all, or by no applicable group
all pass. The message names which one applied. A disallow that reaches the
token still fails.

An unreadable robots.txt is not applicable rather than a warn: missing,
non-200, an empty body, or a 200 that parses to no groups and no directives.
RFC 9309 §2.3.1.3 lets a crawler access everything when the file is
unavailable, and no source here documents a cost for its absence.

The old fix, add `User-agent: Bravebot` / `Allow: /`, is withdrawn as advice for
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
