---
audit: answer-readiness/brand-name
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/brand-name.ts
slug: brand-name
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: informative
consumers:
  - "Google Search (documented: site-name selection and Knowledge Panel)"
  - none-known for AI-citation selection specifically
signals:
  - name: "Brand name consistency across page, markup, and metadata"
    grade: C
    domain: geo-authority
sources:
  - google-site-names-docs
  - google-organization-structured-data
  - ahrefs-brand-correlation
  - semrush-technical-seo-ai
  - semrush-most-cited-domains
  - google-ai-features-trust
  - geo-critical-survey-arxiv
---

# brand-name (`10.6`)

> generative-engine · source `brand-name.ts` · review verdict **fix** · evidence grade **C** · disposition: **keep — fix required**

## What it checks

AI engines build entity graphs by matching Organization schema names to in-content mentions. If your brand name only appears in schema but not body text, agents cannot associate your content with your entity.

## Evidence

### Signal: Brand name consistency across page, markup, and metadata — grade C (geo-authority)

**Mechanism:** Using one consistent brand/organization name across the page title, visible content, og:site_name and Organization/WebSite structured data improves machine entity resolution and thereby increases the likelihood of the brand being cited by AI answer engines.

**Evidence:** The entity-resolution half is documented, precisely and verbatim, by Google — just for a different outcome than AI citation. Google's site-names doc gives a ranked signal list (WebSite structured data > og:site_name > <title> > headings > other home page text) and instructs: 'Use your site name consistently across your home page. Make sure whatever you use as the site name in structured data is consistent with how you refer to your site in other sources on your home page that our system considers.' The Organization doc reinforces it: 'Use the same name and alternateName that you're using for your site name.' It also confirms that these properties influence the Knowledge Panel. On the AI side, Ahrefs' 75,000-brand study found that off-site brand signals dominate AI Overview visibility. Brand web mentions score 0.664 Spearman, brand anchors 0.527 and brand search volume 0.392 — roughly 3x backlinks at 0.218. Brands in the top mention quartile earn far more AI Overview mentions. Semrush found Organization schema on 25% (ChatGPT) / 34% (AI Mode) of cited pages. So entity clarity is plausibly load-bearing; the on-page consistency check is cheap and standards-conformant.

**Counter-evidence:** The evidence measures a different variable than the audit does. Ahrefs measured off-site brand mentions, a reputation quantity built over years. It did not measure on-page name consistency, which no study has isolated. Ahrefs explicitly states 'correlation ≠ causation', and that 'all the factors we studied revealed moderate to very weak correlations'. Google's documented use of name consistency is for site-name DISPLAY and Knowledge Panel, not AI citation, and Google's AI-features doc says outright there is 'no special schema.org structured data that you need to add' for AI Overviews or AI Mode. The 2026 critical survey states brand signals are 'not independently evaluated' in the GEO literature. Most damaging of all, Semrush's 100M-citation study shows citation share is governed by platform-level source-mix policy rather than by brand attributes. Reddit collapsed from about 60% of ChatGPT responses in early August 2025 to about 10% by mid-September, and Wikipedia from about 55% to under 20%. Both moves took weeks, with no change in either brand's on-page markup. Correlational, unisolated, and swamped by platform policy: informative only.
