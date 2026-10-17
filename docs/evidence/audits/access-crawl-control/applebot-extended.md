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

## Evidence

### Signal: Applebot-Extended allow/block state in robots.txt — grade A (robots-ai-crawlers)

**Mechanism:** Applebot-Extended is a robots.txt-only token: disallowing it opts the site's already-crawled content out of training Apple's foundation models (Apple Intelligence) without removing the site from Siri, Spotlight or Safari search results. Allowing Applebot while disallowing Applebot-Extended is the documented way to keep search presence and refuse training.

**Grade: A** — Apple maintains two dedicated support pages for this token and documents the split it enables: disallowing Applebot-Extended opts already-crawled content out of foundation-model training while leaving Applebot, and therefore Siri, Spotlight and Safari search presence, untouched. A vendor documenting its own token and the exact effect of the directive is the grade-A bar. The one honesty caveat is on the verification, not the claim: both Apple pages are client-side rendered, and the fetcher recovered titles rather than body text, so the sentences are corroborated rather than quoted.

**Evidence:** Apple maintains two dedicated support pages for this: 'About Applebot' (support.apple.com/en-us/119829) and 'Applebot model training and individual privacy rights' (support.apple.com/en-us/120320). Apple's stated position is that web publishers can use standard robots.txt directives either to stop Applebot crawling, or separately to direct Apple not to use their content to train Apple's foundation models. The two tokens are independent — an Applebot allow does not imply an Applebot-Extended allow. Because it is not a fetching crawler, no traffic-share data exists or should be expected.

**Counter-evidence:** One caveat on this verification: both Apple support pages are client-side rendered, and the automated fetcher recovered only the document titles, not the body text. The URLs resolve and are unambiguously Apple's canonical Applebot documentation, but Apple's exact sentences could not be quoted; the specifics above are corroborated by secondary sources rather than by direct extraction. The wording should be confirmed before any of it is published as a verbatim quote. Additionally, because Applebot-Extended emits no requests, its effect is entirely unobservable from server logs — publishers cannot verify Apple honors it.

## Implementation deviations

The shared base class `_crawler-bot-audit.ts` grades access, not the shape of the file.

- The audit passes when the rules that apply to Applebot-Extended permit `/`: its own group, the catch-all, or no applicable group. Under RFC 9309 §2.2.1 an open catch-all grants the same access a named group would.
- The message names which of the three applied. A disallow that reaches the token fails.
- An unreadable robots.txt is not applicable: missing, non-200, an empty body, or a 200 that parses to no groups and no sitemaps. RFC 9309 §2.3.1.3 lets a crawler access everything when the file is unavailable.
- The fail remedy warns that a named `Allow: /` group replaces the catch-all for that bot and drops its catch-all `Disallow` lines.
- Applebot-Extended is a usage-control token. The description and messages say no request carries it.
- The `impact` text limits the token to foundation-model training. Siri, Spotlight and Safari presence come from base Applebot.

## Deferred

- **A 5xx robots.txt.** RFC 9309 §2.3.1.4 tells a crawler to assume a complete
  disallow when robots.txt is unreachable. This audit reports any non-200 as
  not applicable and does not grade that case.
