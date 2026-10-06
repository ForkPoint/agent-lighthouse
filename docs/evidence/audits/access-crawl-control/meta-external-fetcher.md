---
audit: access-crawl-control/meta-external-fetcher
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/meta-external-fetcher.ts
slug: meta-external-fetcher
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: scored
consumers:
  - meta-externalagent
  - meta-externalfetcher
  - Meta-WebIndexer
  - Meta-ExternalAds
  - facebookexternalhit
signals:
  - name: Meta-ExternalAgent allow/block state in robots.txt (and meta-externalfetcher / Meta-WebIndexer)
    grade: A
    domain: robots-ai-crawlers
sources:
  - rfc-9309
  - meta-web-crawlers-docs
  - cloudflare-ai-crawler-purpose-industry
---

# meta-external-fetcher (`2.17`)

> crawler-permissions · source `meta-external-fetcher.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Reads the robots.txt rules that apply to Meta-ExternalFetcher — its own group if it has one, otherwise the catch-all — and reports whether they let it fetch the site root. A named group is not required: under RFC 9309 §2.2.1 an open catch-all grants the same access.

## Code review findings (2026-08-20, 11-agent pass)

Live token backing Meta AI's link fetching; a reasonable check to keep, though its citation value is materially lower than the OpenAI/Anthropic/Perplexity realtime fetchers while carrying identical weight. Unmodified base class, so all shared defects apply. Overlaps closely with 2.7 — both audit the same vendor's robots.txt posture and, on most real sites, return the same verdict from adjacent lines in the same file.

**Required fix:** Apply the shared helper fixes from 2.1 with prefix matching for the Meta family. Consider merging with 2.7 into a single vendor-level 'Meta AI crawlers' audit reporting both tokens in `details`, since they are near-always configured together.

**False-positive risks:**

- Prefix shorthand `User-agent: Meta-External` matches neither this token nor Meta-ExternalAgent, so a deliberate Meta-wide block reads as 'allowed by default' in both audits.
- Exact-match miss on versioned tokens.
- Edge UA blocking invisible to the scanner.
- Shared BOM / soft-404 / `Disallow: /*` misreads.

**Test gaps:**

- No Meta-family prefix/shorthand case.
- No test distinguishing this token's verdict from 2.7's on the same fixture.
- Same missing real-world robots.txt variants as 2.1.

**Overlaps with:** `2.7`, `2.22`, `2.28`

## Evidence

### Signal: Meta-ExternalAgent allow/block state in robots.txt (and meta-externalfetcher / Meta-WebIndexer) — grade A (robots-ai-crawlers)

**Mechanism:** Disallowing meta-externalagent stops Meta collecting the site for foundation-model training and direct product indexing, and Meta states the agent respects robots.txt. Disallowing meta-externalfetcher does not reliably stop fetches, because Meta reserves a user-request exemption.

**Grade: A** — The grade-A material in this signal belongs to `meta-externalagent`, whose robots.txt compliance Meta documents without exemption. It transfers to this audit only as far as the token being real and documented: Meta states that `meta-externalfetcher` "fetches individual links at a user's request" and "may bypass robots.txt rules". A directive the vendor says its agent may ignore cannot carry a pass or a failure, which is why this audit reports the declaration's presence and its stated unreliability rather than scoring compliance.

**Evidence:** Meta's web crawlers page documents meta-externalagent as crawling 'for use cases such as training foundation AI models or improving products by indexing content directly', with no stated robots.txt exemption. The newer Meta-WebIndexer 'navigates the web to improve Meta AI search result quality for users' and helps 'cite and link to your content in Meta AI's responses'. That makes Meta-WebIndexer the allow-side visibility token and meta-externalagent the training-side block token. Cloudflare Radar confirms Meta-ExternalAgent among the top five AI crawlers overall and at 13.9% share in the Computer & Electronics vertical (Aug 2025), so it is documented ACTIVE at scale.

**Counter-evidence:** Two documented robots.txt exemptions in the same family must not be conflated with meta-externalagent. meta-externalfetcher 'fetches individual links at a user's request', and 'may bypass robots.txt rules'. facebookexternalhit may bypass robots.txt for 'security or integrity checks, such as checking for malware or malicious content'. A meta-externalfetcher disallow should therefore be reported informatively, not scored as an effective control.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Implementation deviations

### Inherited access passes (2026-10-06)

The audit scored the shape of the file, not the access it grants. The shared
base class `_crawler-bot-audit.ts` passed only when a group named Meta-ExternalFetcher. It
warned at 0.5 when Meta-ExternalFetcher was allowed through `User-agent: *` or by no rule
at all.

Nothing in the evidence supports that split. The grade rests on what a
disallow does, which is a fact about the block state. RFC 9309 §2.2.1 makes a
crawler obey the group that names its product token and fall back to `*`
only when none does. An open catch-all therefore grants the same access a
named group would.

The rule now asks one question: do the rules that apply to Meta-ExternalFetcher permit `/`?
Allowed by its own group, through the catch-all, or by no applicable group
all pass. The message names which one applied. A disallow that reaches the
token still fails.

An unreadable robots.txt is not applicable rather than a warn: missing,
non-200, an empty body, or a 200 that parses to no groups and no directives.
RFC 9309 §2.3.1.3 lets a crawler access everything when the file is
unavailable, and no source here documents a cost for its absence.

The old fix, add `User-agent: Meta-ExternalFetcher` / `Allow: /`, is withdrawn as advice for
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
