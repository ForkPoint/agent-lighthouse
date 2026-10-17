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

## Evidence

### Signal: Meta-ExternalAgent allow/block state in robots.txt (and meta-externalfetcher / Meta-WebIndexer) — grade A (robots-ai-crawlers)

**Mechanism:** Disallowing meta-externalagent stops Meta collecting the site for foundation-model training and direct product indexing, and Meta states the agent respects robots.txt. Disallowing meta-externalfetcher does not reliably stop fetches, because Meta reserves a user-request exemption.

**Grade: A** — The grade-A material in this signal belongs to `meta-externalagent`, whose robots.txt compliance Meta documents without exemption. It transfers to this audit only as far as the token being real and documented: Meta states that `meta-externalfetcher` "fetches individual links at a user's request" and "may bypass robots.txt rules". A directive the vendor says its agent may ignore cannot carry a pass or a failure, which is why this audit reports the declaration's presence and its stated unreliability rather than scoring compliance.

**Evidence:** Meta's web crawlers page documents meta-externalagent as crawling 'for use cases such as training foundation AI models or improving products by indexing content directly', with no stated robots.txt exemption. The newer Meta-WebIndexer 'navigates the web to improve Meta AI search result quality for users' and helps 'cite and link to your content in Meta AI's responses'. That makes Meta-WebIndexer the allow-side visibility token and meta-externalagent the training-side block token. Cloudflare Radar confirms Meta-ExternalAgent among the top five AI crawlers overall and at 13.9% share in the Computer & Electronics vertical (Aug 2025), so it is documented ACTIVE at scale.

**Counter-evidence:** Two documented robots.txt exemptions in the same family must not be conflated with meta-externalagent. meta-externalfetcher 'fetches individual links at a user's request', and 'may bypass robots.txt rules'. facebookexternalhit may bypass robots.txt for 'security or integrity checks, such as checking for malware or malicious content'. A meta-externalfetcher disallow should therefore be reported informatively, not scored as an effective control.

## Implementation deviations

The shared base class `_crawler-bot-audit.ts` grades access, not the shape of the file.

- The audit passes when the rules that apply to Meta-ExternalFetcher permit `/`: its own group, the catch-all, or no applicable group. Under RFC 9309 §2.2.1 an open catch-all grants the same access a named group would.
- The message names which of the three applied. A disallow that reaches the token fails.
- An unreadable robots.txt is not applicable: missing, non-200, an empty body, or a 200 that parses to no groups and no sitemaps. RFC 9309 §2.3.1.3 lets a crawler access everything when the file is unavailable.
- The fail remedy warns that a named `Allow: /` group replaces the catch-all for that bot and drops its catch-all `Disallow` lines.

## Deferred

- **A 5xx robots.txt.** RFC 9309 §2.3.1.4 tells a crawler to assume a complete
  disallow when robots.txt is unreachable. This audit reports any non-200 as
  not applicable and does not grade that case.
