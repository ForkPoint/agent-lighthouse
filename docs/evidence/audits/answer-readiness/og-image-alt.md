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

## Evidence

### Signal: Open Graph og:description and og:image — grade C (meta-head)

**Mechanism:** og:description and og:image are read by AI answer engines and used to populate the preview card / thumbnail shown next to a citation. Falsifiable: no vendor doc from any AI engine names either property, and no published log or output study demonstrates their use.

**Evidence:** The OGP spec establishes og:description and og:image as standard, near-universally deployed properties with real social-unfurler consumers. Their mechanism is well understood and cheap to satisfy. AI answer surfaces do render thumbnails and blurbs alongside citations, which makes the claim plausible.

**Counter-evidence:** Plausible is all it is. Google names only og:title and og:site_name in its documentation — og:description is conspicuously absent from the snippet-sources doc, and og:image is absent from image-appearance docs. Apple's Applebot page describes "a representative image" for snippet-enabled pages without attributing it to og:image. OpenAI, Anthropic and Perplexity say nothing about Open Graph at all. Treat these as social-sharing hygiene reported for completeness, not as AI-readiness scoring inputs.
