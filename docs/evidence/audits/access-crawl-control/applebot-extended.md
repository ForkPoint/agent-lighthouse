---
audit: access-crawl-control/applebot-extended
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/applebot-extended.ts
slug: applebot-extended
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: scored
consumers:
  - Applebot-Extended (robots.txt token consumed by Apple; not a fetching UA)
signals:
  - name: Applebot-Extended allow/block state in robots.txt
    grade: A
    domain: robots-ai-crawlers
sources:
  - rfc-9309
  - applebot-doc
  - apple-applebot-training-privacy
---

# applebot-extended (`2.5`)

> crawler-permissions · source `applebot-extended.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Applebot-Extended is a robots.txt usage-control token, not a crawler: no request carries it. This check reads the rules that apply to it — its own group if it has one, otherwise the catch-all — and reports whether they disallow the site root. A named group is not required: under RFC 9309 §2.2.1 an open catch-all grants the same permission.

## Code review findings (2026-08-20, 11-agent pass)

Live signal, correct-in-kind guidance, but the same base-class defects and one scope error: like Google-Extended, Applebot-Extended governs Apple Intelligence _training_ only. Blocking it does not remove a site from Siri answers or Safari — those come from base `Applebot`, which the category never audits. The `impact` text ('prevents your content from being used in Apple Intelligence features, Siri AI answers, and Safari Highlights') overstates the consequence and will push publishers to give up a training opt-out for visibility they never lose.

**Required fix:** Correct `impact` to state that Applebot-Extended controls Apple Intelligence training only and does not affect Siri/Spotlight/Safari indexing (that is base Applebot). Apply the shared helper fixes; add explicit handling so an `Applebot` group is not confused with `Applebot-Extended`.

**False-positive risks:**

- `impact` conflates Applebot-Extended (training opt-out) with Applebot (indexing) — a site correctly blocking only the former gets a high-priority FAIL about lost Siri visibility.
- Exact-match UA lookup misses `User-agent: Applebot-Extended/1.0`.
- The hyphenated token is a prefix relationship with `Applebot`: a site with only `User-agent: Applebot\nDisallow: /` is read as having no Applebot-Extended rules and falls through to wildcard, reporting 'allowed by default'.
- Shared BOM / soft-404 / `Disallow: /*` misreads.

**Test gaps:**

- No Applebot-vs-Applebot-Extended prefix-collision case.
- Same missing real-world robots.txt variants as 2.1.

**Overlaps with:** `2.22`, `2.28`

## Evidence

### Signal: Applebot-Extended allow/block state in robots.txt — grade A (robots-ai-crawlers)

**Mechanism:** Applebot-Extended is a robots.txt-only token: disallowing it opts the site's already-crawled content out of training Apple's foundation models (Apple Intelligence) without removing the site from Siri, Spotlight or Safari search results. Allowing Applebot while disallowing Applebot-Extended is the documented way to keep search presence and refuse training.

**Grade: A** — Apple maintains two dedicated support pages for this token and documents the split it enables: disallowing Applebot-Extended opts already-crawled content out of foundation-model training while leaving Applebot, and therefore Siri, Spotlight and Safari search presence, untouched. A vendor documenting its own token and the exact effect of the directive is the grade-A bar. The one honesty caveat is on the verification, not the claim: both Apple pages are client-side rendered, and the fetcher recovered titles rather than body text, so the sentences are corroborated rather than quoted.

**Evidence:** Apple maintains two dedicated support pages for this: 'About Applebot' (support.apple.com/en-us/119829) and 'Applebot model training and individual privacy rights' (support.apple.com/en-us/120320). Apple's stated position is that web publishers can use standard robots.txt directives either to stop Applebot crawling, or separately to direct Apple not to use their content to train Apple's foundation models. The two tokens are independent — an Applebot allow does not imply an Applebot-Extended allow. Because it is not a fetching crawler, no traffic-share data exists or should be expected.

**Counter-evidence:** One caveat on this verification: both Apple support pages are client-side rendered, and the automated fetcher recovered only the document titles, not the body text. The URLs resolve and are unambiguously Apple's canonical Applebot documentation, but Apple's exact sentences could not be quoted; the specifics above are corroborated by secondary sources rather than by direct extraction. The wording should be confirmed before any of it is published as a verbatim quote. Additionally, because Applebot-Extended emits no requests, its effect is entirely unobservable from server logs — publishers cannot verify Apple honors it.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Implementation deviations

### Inherited access passes (2026-10-06)

The audit scored the shape of the file, not the access it grants. The shared
base class `_crawler-bot-audit.ts` passed only when a group named Applebot-Extended. It
warned at 0.5 when Applebot-Extended was allowed through `User-agent: *` or by no rule
at all.

Nothing in the evidence supports that split. The grade rests on what a
disallow does, which is a fact about the block state. RFC 9309 §2.2.1 makes a
crawler obey the group that names its product token and fall back to `*`
only when none does. An open catch-all therefore grants the same access a
named group would.

The rule now asks one question: do the rules that apply to Applebot-Extended permit `/`?
Allowed by its own group, through the catch-all, or by no applicable group
all pass. The message names which one applied. A disallow that reaches the
token still fails.

An unreadable robots.txt is not applicable rather than a warn: missing,
non-200, an empty body, or a 200 that parses to no groups and no directives.
RFC 9309 §2.3.1.3 lets a crawler access everything when the file is
unavailable, and no source here documents a cost for its absence.

The old fix, add `User-agent: Applebot-Extended` / `Allow: /`, is withdrawn as advice for
an allowed site. A named group replaces the catch-all for that bot, so it
drops every catch-all `Disallow` the site still meant to apply. The fail
remedy now says so.

`access-crawl-control/meta-external-agent` and
`access-crawl-control/anthropic-ai` made the same change on 2026-08-24. The
base class now matches them.

The `impact` text is corrected in the same change, as the 2026-08-20
required fix asks. Applebot-Extended governs foundation-model training only.
Siri, Spotlight and Safari presence come from base Applebot. The description
and the result messages no longer say the token crawls: no request carries
it.

Grade, tier and weight are unchanged.

## Deferred

- **A 5xx robots.txt.** RFC 9309 §2.3.1.4 tells a crawler to assume a complete
  disallow when robots.txt is unreachable. This audit reports any non-200 as
  not applicable and does not grade that case.
