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
  - applebot-doc
  - apple-applebot-training-privacy
---

# applebot-extended (`2.5`)

> crawler-permissions · source `applebot-extended.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Without an explicit robots.txt rule, Applebot-Extended may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.

## Code review findings (2026-08-20, 11-agent pass)

Live signal, correct-in-kind guidance, but the same base-class defects and one scope error: like Google-Extended, Applebot-Extended governs Apple Intelligence *training* only. Blocking it does not remove a site from Siri answers or Safari — those come from base `Applebot`, which the category never audits. The `impact` text ('prevents your content from being used in Apple Intelligence features, Siri AI answers, and Safari Highlights') overstates the consequence and will push publishers to give up a training opt-out for visibility they never lose.

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

**Grade: A** — Apple maintains two dedicated support pages for this token and documents the split it enables: disallowing Applebot-Extended opts already-crawled content out of foundation-model training while leaving Applebot, and therefore Siri, Spotlight and Safari search presence, untouched. A vendor documenting its own token and the exact effect of the directive is the grade-A bar. The one honesty caveat is on the verification, not the claim: both Apple pages are client-side rendered and our fetcher recovered titles rather than body text, so the sentences are corroborated rather than quoted.

**Evidence:** Apple maintains two dedicated support pages for this: 'About Applebot' (support.apple.com/en-us/119829) and 'Applebot model training and individual privacy rights' (support.apple.com/en-us/120320). Apple's stated position is that web publishers can use standard robots.txt directives either to stop Applebot crawling, or separately to direct Apple not to use their content to train Apple's foundation models. The two tokens are independent — an Applebot allow does not imply an Applebot-Extended allow. Because it is not a fetching crawler, no traffic-share data exists or should be expected.

**Counter-evidence:** HONESTY CAVEAT ON OUR OWN VERIFICATION: both Apple support pages are client-side rendered and our automated fetcher recovered only the document titles, not the body text. The URLs resolve and are unambiguously Apple's canonical Applebot documentation, but we could not quote Apple's exact sentences; the specifics above are corroborated by secondary sources rather than by our own extraction. A human should confirm the wording before publishing verbatim quotes. Additionally, because Applebot-Extended emits no requests, its effect is entirely unobservable from server logs — publishers cannot verify Apple honors it.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
