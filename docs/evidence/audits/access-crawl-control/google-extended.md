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
  - google-common-crawlers
  - google-ai-features-trust
  - pebblous-blocking-citation-gap
---

# google-extended (`2.2`)

> crawler-permissions · source `google-extended.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Without an explicit robots.txt rule, Google-Extended may still crawl your site but has no signal that it is welcome. Adding an explicit allow rule improves your visibility in AI-powered search and ensures consistent crawler behavior.

## Code review findings (2026-08-20, 11-agent pass)

Inherits every base-class defect, and its guidance text is factually wrong in a way that will make users act against their interests. `impact` states 'Blocking Google-Extended prevents your content from being used in Google's AI features like Gemini and AI Overviews.' Google has stated the opposite since 2023: Google-Extended controls Gemini training and grounding only, and has no effect on inclusion in Search, AI Overviews, or AI Mode — those are governed by Googlebot. A publisher who reads this and unblocks Google-Extended believes they are buying AI Overview visibility they already had, and gives up training-data opt-out for nothing. Meanwhile `Googlebot`, the token that actually gates AI Overviews and AI Mode, is not audited anywhere in the category.

**Required fix:** Rewrite `impact` to state accurately that Google-Extended governs Gemini training and grounding only and does not affect Search, AI Overviews or AI Mode inclusion. Add a separate `Googlebot allowed` audit — that is the token that actually gates AI Overviews. Apply the shared helper fixes from 2.1.

**False-positive risks:**
- Same exact-match/BOM/soft-404/`Disallow: /*` misreads as 2.1, from the shared `CrawlerBotAudit` + `isAllowed` path.
- Sites that deliberately and correctly block Google-Extended (a mainstream publisher stance) while remaining fully open to Googlebot get a high-priority FAIL claiming lost AI Overview visibility they have not lost.
- Wildcard fallback: a site with only `User-agent: *\nAllow: /` gets a 0.5 warn even though Google-Extended is fully permitted — the maximally-permissive state is penalized.

**Test gaps:**
- No assertion on guidance/impact correctness (the factual error is untested and unnoticed).
- No case distinguishing Google-Extended from Googlebot policy.
- Same missing real-world robots.txt variants as 2.1 (BOM, versioned token, soft-404, `Disallow: /*`).

**Overlaps with:** `2.22`, `2.28`

## Evidence

### Signal: Google-Extended allow/block state in robots.txt — grade A (robots-ai-crawlers)

**Mechanism:** Disallowing Google-Extended stops the site's content being used to train Gemini models and to ground answers in Gemini Apps and Vertex AI Grounding-with-Google-Search. It has zero effect on Google Search crawling, indexing, ranking, or AI Overviews.

**Grade: A** — Google documents the token by name and states exactly what it governs: whether crawled content "may be used for training future generations of Gemini models" and for grounding in Gemini Apps and Vertex AI. That is a vendor statement about a named token, which is the grade-A bar. The grade does not extend to the claim most often attached to this token: Google-Extended does **not** control AI Overviews or AI Mode, and Google directs publishers to Googlebot's own directives and to nosnippet for those. The audit reports the training and grounding effect only.

**Evidence:** Google documents Google-Extended as 'a standalone product token that web publishers can use to manage whether content Google crawls from their sites may be used for training future generations of Gemini models'. Those are the models 'that power Gemini Apps and Vertex AI API for Gemini and for grounding ... in Gemini Apps and Grounding with Google Search on Vertex AI'. It also states that the token 'does not impact a site's inclusion in Google Search nor is it used as a ranking signal'. It is a robots.txt token only — no crawler fetches with that UA — so it is safe to block without traffic loss.

**Counter-evidence:** Critical, widely-misreported limitation: Google-Extended does not control AI Overviews or AI Mode. Google's AI-features page states 'robots.txt directives for Googlebot is the control for site owners to manage access to how their sites are crawled for Search' and directs publishers to nosnippet / data-nosnippet / max-snippet / noindex for AI feature control. Any audit implying a Google-Extended disallow keeps content out of AI Overviews is wrong. Also, BuzzStream measured 92.3% citation retention among sites blocking Google-Extended — the highest of any bot studied.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
