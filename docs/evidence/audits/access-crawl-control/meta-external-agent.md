---
audit: access-crawl-control/meta-external-agent
audit_id: "2.7"
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/meta-external-agent.ts
slug: meta-external-agent
review_verdict: fix
severity: medium
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# meta-external-agent (`2.7`)

> crawler-permissions · source `meta-external-agent.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Without an explicit robots.txt rule, Meta-ExternalAgent may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.

## Code review findings (2026-08-20, 11-agent pass)

Meta-ExternalAgent is a live token (Llama training and Meta AI corpora) so the signal stands, but it inherits every base-class defect and the pass criterion remains the cargo-cult 'explicit Allow: /'. Additional nuance the audit ignores: Meta operates several tokens (Meta-ExternalAgent, Meta-ExternalFetcher, and the legacy facebookexternalhit) with different purposes, and only two are audited — a site can be fully open to the audited pair while blocking the fetcher that actually renders link previews.

**Required fix:** Apply the shared helper fixes from 2.1 (BOM strip, prefix matching, `/*` blanket forms) and add prefix-match so a shorthand `Meta-External*` group is attributed to both Meta tokens.

**False-positive risks:**
- Exact-match miss on `User-agent: meta-externalagent` variants with version suffixes.
- Prefix collision: `User-agent: Meta-External` (a shorthand some sites use to cover both Meta tokens) matches neither audited token, so a deliberate Meta block reads as 'allowed by default'.
- Shared BOM / soft-404 / `Disallow: /*` misreads.
- Cloudflare/edge UA blocking is invisible to the scanner's `AgentLighthouse/1.0` fetch.

**Test gaps:**
- No prefix/shorthand token case.
- No test covering the Meta-ExternalAgent vs Meta-ExternalFetcher distinction.
- Same missing real-world robots.txt variants as 2.1.

**Overlaps with:** `2.17`, `2.22`, `2.28`

## Evidence

### Signal: Meta-ExternalAgent allow/block state in robots.txt (and meta-externalfetcher / Meta-WebIndexer) — grade A (robots-ai-crawlers)

**Mechanism:** Disallowing meta-externalagent stops Meta collecting the site for foundation-model training and direct product indexing, and Meta states the agent respects robots.txt. Disallowing meta-externalfetcher does NOT reliably stop fetches, because Meta reserves a user-request exemption.

**Evidence:** Meta's web crawlers page documents meta-externalagent as crawling 'for use cases such as training foundation AI models or improving products by indexing content directly' with no stated robots.txt exemption; Meta-WebIndexer (new) 'navigates the web to improve Meta AI search result quality for users' and helps 'cite and link to your content in Meta AI's responses' — making Meta-WebIndexer the allow-side visibility token and meta-externalagent the training-side block token. Cloudflare Radar confirms Meta-ExternalAgent among the top five AI crawlers overall and at 13.9% share in the Computer & Electronics vertical (Aug 2025), so it is documented ACTIVE at scale.

**Counter-evidence:** Two documented robots.txt exemptions in the same family that audits must not conflate with meta-externalagent: meta-externalfetcher 'fetches individual links at a user's request' and 'may bypass robots.txt rules'; and facebookexternalhit may bypass robots.txt for 'security or integrity checks, such as checking for malware or malicious content'. A meta-externalfetcher disallow should therefore be reported informatively, not scored as an effective control.
**Consumers:** meta-externalagent, meta-externalfetcher, Meta-WebIndexer, Meta-ExternalAds, facebookexternalhit · **Recommended tier:** scored

**Sources:** [Meta Web Crawlers](https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/) · [A deeper look at AI crawlers: breaking down traffic by purpose and industry](https://blog.cloudflare.com/ai-crawler-traffic-by-purpose-and-industry/)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
