---
audit: access-crawl-control/meta-external-agent
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/meta-external-agent.ts
slug: meta-external-agent
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

# meta-external-agent (`2.7`)

> crawler-permissions · source `meta-external-agent.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Meta-ExternalAgent collects pages for Meta's foundation-model training and for indexing content directly into Meta products, and Meta documents it as respecting robots.txt.

This reads the robots.txt rules that actually apply to the token — its own group if it has one, otherwise the catch-all — and reports whether they let it fetch the site root. A named group is not required: under RFC 9309 §2.2.1 an open catch-all grants a named crawler the same access a named group would.

## Evidence

### Signal: Meta-ExternalAgent allow/block state in robots.txt (and meta-externalfetcher / Meta-WebIndexer) — grade A (robots-ai-crawlers)

**Mechanism:** Disallowing meta-externalagent stops Meta collecting the site for foundation-model training and direct product indexing, and Meta states the agent respects robots.txt. Disallowing meta-externalfetcher does not reliably stop fetches, because Meta reserves a user-request exemption.

**Grade: A** — Meta's web-crawlers page documents `meta-externalagent` as crawling "for use cases such as training foundation AI models or improving products by indexing content directly", with no stated robots.txt exemption, and gives a literal per-directory example. A vendor naming its own token, its purpose and the directive that governs it is the grade-A bar. The grade attaches to this token specifically: the same page reserves a user-request exemption for `meta-externalfetcher`, which "may bypass robots.txt rules", and a security exemption for `facebookexternalhit`. Conflating the three would spend an A on two agents that do not honour the directive.

**Evidence:** Meta's web crawlers page documents meta-externalagent as crawling 'for use cases such as training foundation AI models or improving products by indexing content directly', with no stated robots.txt exemption. The newer Meta-WebIndexer 'navigates the web to improve Meta AI search result quality for users' and helps 'cite and link to your content in Meta AI's responses'. That makes Meta-WebIndexer the allow-side visibility token and meta-externalagent the training-side block token. Cloudflare Radar confirms Meta-ExternalAgent among the top five AI crawlers overall and at 13.9% share in the Computer & Electronics vertical (Aug 2025), so it is documented ACTIVE at scale.

**Counter-evidence:** Two documented robots.txt exemptions in the same family must not be conflated with meta-externalagent. meta-externalfetcher 'fetches individual links at a user's request', and 'may bypass robots.txt rules'. facebookexternalhit may bypass robots.txt for 'security or integrity checks, such as checking for malware or malicious content'. A meta-externalfetcher disallow should therefore be reported informatively, not scored as an effective control.

## Implementation deviations

- The audit grades access, not file shape. Allowed by its own group, through the catch-all, or by no applicable group all pass. A disallow that reaches the token fails. There is no `warn` band.
- An unreadable robots.txt is not applicable: missing, non-200, an empty body, or a 200 that parses to no groups and no sitemaps. A `Sitemap:`-only file passes.
- Matching stays on the RFC 9309 product token, which accepts a version suffix such as `Meta-ExternalAgent/1.0`. A prefix match was rejected: it would pull a `Meta-ExternalFetcher` rule, which Meta says may bypass robots.txt, into a scored verdict. Two tests pin the shorthand and the fetcher group as non-matches.
- The failure states what a block does: exclusion from training and direct product indexing. It makes no search-visibility claim, because the evidence assigns that role to Meta-WebIndexer. Its priority is `medium`.
- `guidance.code` still shows a `User-agent: Meta-ExternalAgent` / `Allow: /` snippet. It is the remedy for the only failing state, not a requirement.
