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
  - meta-web-crawlers-docs
  - cloudflare-ai-crawler-purpose-industry
---

# meta-external-fetcher (`2.17`)

> crawler-permissions · source `meta-external-fetcher.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Without an explicit robots.txt rule, Meta-ExternalFetcher may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.

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

**Mechanism:** Disallowing meta-externalagent stops Meta collecting the site for foundation-model training and direct product indexing, and Meta states the agent respects robots.txt. Disallowing meta-externalfetcher does NOT reliably stop fetches, because Meta reserves a user-request exemption.

**Grade: A** — The grade-A material in this signal belongs to `meta-externalagent`, whose robots.txt compliance Meta documents without exemption. It transfers to this audit only as far as the token being real and documented: Meta states that `meta-externalfetcher` "fetches individual links at a user's request" and "may bypass robots.txt rules". A directive the vendor says its agent may ignore cannot carry a pass or a failure, which is why this audit reports the declaration's presence and its stated unreliability rather than scoring compliance.

**Evidence:** Meta's web crawlers page documents meta-externalagent as crawling 'for use cases such as training foundation AI models or improving products by indexing content directly' with no stated robots.txt exemption; Meta-WebIndexer (new) 'navigates the web to improve Meta AI search result quality for users' and helps 'cite and link to your content in Meta AI's responses' — making Meta-WebIndexer the allow-side visibility token and meta-externalagent the training-side block token. Cloudflare Radar confirms Meta-ExternalAgent among the top five AI crawlers overall and at 13.9% share in the Computer & Electronics vertical (Aug 2025), so it is documented ACTIVE at scale.

**Counter-evidence:** Two documented robots.txt exemptions in the same family that audits must not conflate with meta-externalagent: meta-externalfetcher 'fetches individual links at a user's request' and 'may bypass robots.txt rules'; and facebookexternalhit may bypass robots.txt for 'security or integrity checks, such as checking for malware or malicious content'. A meta-externalfetcher disallow should therefore be reported informatively, not scored as an effective control.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
