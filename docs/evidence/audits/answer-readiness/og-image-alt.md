---
audit: answer-readiness/og-image-alt
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/og-image-alt.ts
slug: og-image-alt
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: informative
consumers:
  - Facebook/Meta
  - LinkedIn
  - Slack
  - Discord
  - iMessage unfurlers (per OGP spec)
  - none-known for any AI answer engine
signals:
  - name: "Open Graph og:description and og:image"
    grade: C
    domain: meta-head
sources:
  - ogp-me-spec
  - google-title-link-docs
  - google-site-names-docs
  - applebot-doc
  - s18
  - anthropic-crawlers
  - perplexity-crawlers-docs
---

# og-image-alt (`4.9`)

> meta-tags · source `og-image-alt.ts` · review verdict **fix** · evidence grade **C** · disposition: **keep — fix required**

## What it checks

AI agents cannot process images directly and rely on og:image:alt text to understand your page's visual content. Without alt text, the OG image is invisible to text-based AI systems that generate answers and summaries about your page.

## Code review findings (2026-08-20, 11-agent pass)

Modest accessibility value at best, and the not-applicable path is mis-modeled: when there is no og:image the audit emits a `warn` (score 0.5) rather than `notApplicable()`, double-penalizing the same missing og:image that core-open-graph (4.6) already failed. The stated rationale — that agents cannot see images and depend on this alt text — is no longer true of the multimodal crawlers this tool targets, so passing it buys little.

**Required fix:** 1) Change the no-og:image branch from `this.warn('No og:image found, so og:image:alt is not applicable.', …)` to `this.notApplicable(...)`. The message literally says 'not applicable' while returning a 0.5 penalty that compounds with core-open-graph's failure for the same root cause. 2) Reject non-descriptive alt text — `if (ogImageAlt)` currently passes `content="image"`, `content="og image"`, or the filename. 3) Iterate all `ctx.pages`. 4) Downgrade `defaultPriority` from 'medium' to 'low' and drop the 'AI agents cannot process images directly' claim, which is factually stale.

**False-positive risks:**
- Double penalty on one root cause: `if (!ogImage) return this.warn(...)` scores 0.5 for a condition core-open-graph already scored 0 for. Sites with no OG at all are penalized twice for the same fact, and the base class's `notApplicable()` (which exists precisely to avoid this) is unused.
- Junk alt text passes: `if (ogImageAlt) return this.pass(...)` accepts `content="image"`, `content="og-image"`, `content="card.png"`, or a template token.
- Only `ctx.pages[0]` is examined.
- `og:image:url`/`og:image:secure_url`-only pages are treated as having no og:image at all, so a page that does have an image and would need alt text is routed into the warn/not-applicable branch instead of being checked.
- Multiple og:image tags each with their own og:image:alt collapse to last-wins in `extractMetaTags`; the audit can pass on the alt of one image while another has none.
- WAF interstitial → warn (0.5) rather than a clean not-applicable, quietly depressing the category score.

**Test gaps:**
- No test asserting the no-og:image case should be `na` rather than `warn` (the current test actively locks in the wrong behavior: `expect(result.status).toBe('warn')`).
- No junk/placeholder alt-text test.
- No `og:image:secure_url` test.
- No multiple-image test.
- No multi-page test.

**Overlaps with:** `4.6`

## Evidence

### Signal: Open Graph og:description and og:image — grade C (meta-head)

**Mechanism:** og:description and og:image are read by AI answer engines and used to populate the preview card / thumbnail shown next to a citation. Falsifiable: no vendor doc from any AI engine names either property, and no published log or output study demonstrates their use.

**Evidence:** The OGP spec establishes og:description and og:image as standard, near-universally deployed properties with real social-unfurler consumers. Their mechanism is well understood and cheap to satisfy. AI answer surfaces do render thumbnails and blurbs alongside citations, which makes the claim plausible.

**Counter-evidence:** Plausible is all it is. Google names only og:title and og:site_name in its documentation — og:description is conspicuously absent from the snippet-sources doc, and og:image is absent from image-appearance docs. Apple's Applebot page describes "a representative image" for snippet-enabled pages without attributing it to og:image. OpenAI, Anthropic and Perplexity say nothing about Open Graph at all. Treat these as social-sharing hygiene reported for completeness, not as AI-readiness scoring inputs.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
