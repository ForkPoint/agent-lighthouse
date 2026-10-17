---
audit: access-crawl-control/google-extended
category: access-crawl-control
source_file: packages/core/src/audits/access-crawl-control/google-extended.ts
slug: google-extended
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: scored
consumers:
  - Google-Extended (robots.txt token consumed by Google; not a fetching UA)
signals:
  - name: Google-Extended allow/block state in robots.txt
    grade: A
    domain: robots-ai-crawlers
sources:
  - rfc-9309
  - google-common-crawlers
  - google-ai-features-trust
  - pebblous-blocking-citation-gap
---

# google-extended (`2.2`)

> crawler-permissions · source `google-extended.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Google-Extended is a robots.txt usage-control token, not a crawler: no request carries it. This check reads the rules that apply to it — its own group if it has one, otherwise the catch-all — and reports whether they disallow the site root. A named group is not required: under RFC 9309 §2.2.1 an open catch-all grants the same permission.

## Evidence

### Signal: Google-Extended allow/block state in robots.txt — grade A (robots-ai-crawlers)

**Mechanism:** Disallowing Google-Extended stops the site's content being used to train Gemini models and to ground answers in Gemini Apps and Vertex AI Grounding-with-Google-Search. It has zero effect on Google Search crawling, indexing, ranking, or AI Overviews.

**Grade: A** — Google documents the token by name and states exactly what it governs: whether crawled content "may be used for training future generations of Gemini models" and for grounding in Gemini Apps and Vertex AI. That is a vendor statement about a named token, which is the grade-A bar. The grade does not extend to the claim most often attached to this token: Google-Extended does **not** control AI Overviews or AI Mode, and Google directs publishers to Googlebot's own directives and to nosnippet for those. The audit reports the training and grounding effect only.

**Evidence:** Google documents Google-Extended as 'a standalone product token that web publishers can use to manage whether content Google crawls from their sites may be used for training future generations of Gemini models'. Those are the models 'that power Gemini Apps and Vertex AI API for Gemini and for grounding ... in Gemini Apps and Grounding with Google Search on Vertex AI'. It also states that the token 'does not impact a site's inclusion in Google Search nor is it used as a ranking signal'. It is a robots.txt token only — no crawler fetches with that UA — so it is safe to block without traffic loss.

**Counter-evidence:** Critical, widely-misreported limitation: Google-Extended does not control AI Overviews or AI Mode. Google's AI-features page states 'robots.txt directives for Googlebot is the control for site owners to manage access to how their sites are crawled for Search' and directs publishers to nosnippet / data-nosnippet / max-snippet / noindex for AI feature control. Any audit implying a Google-Extended disallow keeps content out of AI Overviews is wrong. Also, BuzzStream measured 92.3% citation retention among sites blocking Google-Extended — the highest of any bot studied.

## Implementation deviations

The shared base class `_crawler-bot-audit.ts` grades access, not the shape of the file.

- The audit passes when the rules that apply to Google-Extended permit `/`: its own group, the catch-all, or no applicable group. Under RFC 9309 §2.2.1 an open catch-all grants the same access a named group would.
- The message names which of the three applied. A disallow that reaches the token fails.
- An unreadable robots.txt is not applicable: missing, non-200, an empty body, or a 200 that parses to no groups and no sitemaps. RFC 9309 §2.3.1.3 lets a crawler access everything when the file is unavailable.
- The fail remedy warns that a named `Allow: /` group replaces the catch-all for that bot and drops its catch-all `Disallow` lines.
- Google-Extended is a usage-control token. The description and messages say no request carries it.
- The `impact` text limits the token to Gemini training and grounding. It does not affect Search, AI Overviews or AI Mode.

## Deferred

- **A 5xx robots.txt.** RFC 9309 §2.3.1.4 tells a crawler to assume a complete
  disallow when robots.txt is unreachable. This audit reports any non-200 as
  not applicable and does not grade that case.
