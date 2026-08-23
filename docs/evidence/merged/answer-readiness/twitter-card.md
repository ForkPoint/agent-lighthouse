---
audit: answer-readiness/twitter-card
audit_id: "4.10"
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/twitter-card.ts
slug: twitter-card
review_verdict: delete
severity: medium
evidence_grade: C
disposition: "proposed: redeem as informative (pending triage)"
reviewed: 2026-08-21
---

# twitter-card (`4.10`)

> meta-tags · source `twitter-card.ts` · review verdict **delete** · evidence grade **C** · disposition: **proposed: redeem as informative (pending triage)**

## What it checks

AI agents that surface content via social platforms use Twitter Card tags to generate rich previews. Missing tags mean your content appears as a plain URL link with no context, reducing click-through from AI-curated social feeds.

## Code review findings (2026-08-20, 11-agent pass)

Falsy and factually wrong. The audit fails a site for omitting `twitter:title`/`twitter:description` even when complete Open Graph tags are present — but that is exactly the configuration X's own crawler documents as correct, and it is irrelevant to every AI agent this tool claims to audit. The stated rationale, 'AI agents that surface content via social platforms use Twitter Card tags to generate rich previews', describes no shipping system. This produces a medium-priority failure on well-built sites for a signal that cannot change any AI outcome — a misleading audit that is worse than no audit.

**Required fix:** Delete. If the maintainer wants to retain any of it, the only defensible remnant is: when `og:*` is absent AND `twitter:*` is absent, that is already covered by core-open-graph (4.6); when `og:*` is present, `twitter:*` is redundant by specification and must not be failed. A correct implementation would be `if (hasCoreOg) return notApplicable()`, at which point the audit has no remaining behavior.

**False-positive risks:**
- Fails correct markup by design: the loop over `TWITTER_REQUIRED = ['twitter:card','twitter:title','twitter:description']` never consults `og:title`/`og:description`, yet X explicitly falls back to them. A site with `twitter:card` plus full OG — the recommended configuration — is reported as `warn` with 'Missing Twitter Card tags: twitter:title, twitter:description'.
- A site with complete OG and no twitter tags at all gets a hard `fail` at 'medium' priority for a defect that does not exist in any consumer.
- `twitter:image` is not required by the audit but `twitter:card="summary_large_image"` without an image is a genuinely broken card — the audit checks the three tags that don't matter and skips the interaction that does.
- Only `ctx.pages[0]` is examined.
- The parser reads `name=` and `property=` interchangeably, so `<meta property="twitter:card">` (technically wrong but common) passes here while failing in X's actual parser — the audit is more lenient than reality in the one place it could have been useful.
- WAF interstitial → all three reported missing.

**Test gaps:**
- No test with full OG present and twitter tags absent — the single most common real-world configuration, which the audit gets wrong.
- No `twitter:card` + missing `twitter:image` interaction test.
- No `property=` vs `name=` attribute test.
- No multi-page test.

**Overlaps with:** `4.6`

## Evidence

### Signal: twitter card tags (twitter:card, twitter:title, twitter:description, twitter:image) in 2026 — grade C (meta-head)

**Mechanism:** twitter:* meta tags provide information to AI systems (or preview generators) that Open Graph tags do not already provide. Falsifiable: if every content-bearing twitter:* tag has a documented Open Graph fallback and no AI consumer is documented, the tags add nothing for AI readiness.

**Evidence:** The last accessible Cards Markup Tag Reference (archived Dec 2023) documents an explicit OpenGraph fallback for every content-bearing tag — twitter:title->og:title, twitter:description->og:description, twitter:image->og:image, twitter:image:alt->og:image:alt, twitter:card->og:type — and states that "if an og:type, og:title and og:description exist in the markup but twitter:card is absent, then a summary card may be rendered." Only X-account fields (twitter:site, twitter:creator) and player/app fields have no OG equivalent, and none of those carry page content an AI system would use.

**Counter-evidence:** Strong, and partly documentary decay. Verified by HTTP trace on 2026-08-20: every historical Cards docs deep link on developer.twitter.com and developer.x.com now 301s to the generic https://docs.x.com/overview; docs.x.com/x-api/cards and /fundamentals/x-cards return 404; the card validator redirects to a login wall. There is no live public X Cards specification. No AI vendor doc references twitter:* tags. Recommend demoting all twitter:* audits to informational and, where a site already has complete OG tags, reporting them as redundant rather than missing.
**Consumers:** X/Twitter's own card renderer (behavior no longer publicly specified), none-known for any AI engine or agent · **Recommended tier:** informative

**Sources:** [Cards Markup Tag Reference (archived, Dec 2023)](https://web.archive.org/web/20231229075931/https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/markup) · [X Cards documentation URLs (dead-link check)](https://developer.x.com/en/docs/x-for-websites/cards/overview/abouts-cards) · [The Open Graph protocol](https://ogp.me/)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

**Merged into:** `answer-readiness/core-open-graph` (Plan 4, 2026-08-22) — [merged dossier](../../audits/answer-readiness/core-open-graph.md)
