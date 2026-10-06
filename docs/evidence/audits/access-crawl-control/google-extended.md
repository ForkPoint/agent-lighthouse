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

## Implementation deviations

### Inherited access passes (2026-10-06)

The audit scored the shape of the file, not the access it grants. The shared
base class `_crawler-bot-audit.ts` passed only when a group named Google-Extended. It
warned at 0.5 when Google-Extended was allowed through `User-agent: *` or by no rule
at all.

Nothing in the evidence supports that split. The grade rests on what a
disallow does, which is a fact about the block state. RFC 9309 §2.2.1 makes a
crawler obey the group that names its product token and fall back to `*`
only when none does. An open catch-all therefore grants the same access a
named group would.

The rule now asks one question: do the rules that apply to Google-Extended permit `/`?
Allowed by its own group, through the catch-all, or by no applicable group
all pass. The message names which one applied. A disallow that reaches the
token still fails.

An unreadable robots.txt is not applicable rather than a warn: missing,
non-200, an empty body, or a 200 that parses to no groups and no directives.
RFC 9309 §2.3.1.3 lets a crawler access everything when the file is
unavailable, and no source here documents a cost for its absence.

The old fix, add `User-agent: Google-Extended` / `Allow: /`, is withdrawn as advice for
an allowed site. A named group replaces the catch-all for that bot, so it
drops every catch-all `Disallow` the site still meant to apply. The fail
remedy now says so.

`access-crawl-control/meta-external-agent` and
`access-crawl-control/anthropic-ai` made the same change on 2026-08-24. The
base class now matches them.

The `impact` text is corrected in the same change, as the 2026-08-20
required fix asks. Google-Extended governs Gemini training and grounding
only. It does not affect Search, AI Overviews or AI Mode. The description and
the result messages no longer say the token crawls: Google documents it as a
standalone product token, and no request carries it.

Grade, tier and weight are unchanged.

## Deferred

- **A 5xx robots.txt.** RFC 9309 §2.3.1.4 tells a crawler to assume a complete
  disallow when robots.txt is unreachable. This audit reports any non-200 as
  not applicable and does not grade that case.
