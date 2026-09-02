---
audit: answer-readiness/external-citations
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/external-citations.ts
slug: external-citations
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - geo-paper-arxiv
  - geo-paper
  - geo-critical-survey-arxiv
  - google-helpful-content
  - google-ai-features-trust
---

# external-citations (`10.5`)

> generative-engine · source `external-citations.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

## What it checks

Linking to authoritative sources signals expertise. AI RAG systems cross-reference your citations to validate claims and assess content quality.

## Code review findings (2026-08-20, 11-agent pass)

Thin but real basis — the 2024 GEO study found citation-bearing content gained visibility in generative answers — so this is not pure invention. But the operationalization (count `<a>` tags whose hostname differs from `ctx.domain`, threshold 2, pass if ANY page clears it) measures site chrome, not citations. Social icons, a 'Powered by Shopify' link, payment badges and cookie-vendor links satisfy it on virtually every commercial site, so it is close to a constant PASS. It also counts nofollow/sponsored advertising links as scholarly citations.

**Required fix:** 1) Scope the anchor scan to `<main>`/`<article>`, or at minimum exclude `nav`, `header`, `footer`, `[role="navigation"]`. 2) Exclude anchors whose `rel` contains nofollow/sponsored/ugc. 3) De-duplicate by resolved href and count distinct hostnames before applying the ≥2 threshold. 4) Exclude an allowlist of ubiquitous non-citation hosts (social networks, app stores, payment/consent vendors, own CDN). 5) Evaluate only `pageType === 'content'` pages and report the proportion that qualify rather than passing on one. 6) Soften the guidance: citations correlate with generative-answer visibility; they are not 'cross-referenced against a knowledge graph'.

**False-positive risks:**

- Every external anchor counts, including footer social icons, 'Powered by Shopify', payment-provider badges, App Store links, and cookie-consent vendor links. Essentially every commercial homepage has ≥2 and PASSES 'External citations' with zero actual citations.
- No `rel` filtering: `rel="nofollow sponsored ugc"` advertising and paid placements are counted as authoritative citations, so the audit can rank a spam page above a well-researched one.
- Links are collected from the whole document (`$('a[href]')`), not the article body. `getMainContentText` exists in parser.ts and is used by 10.9/10.13 but not here, so a page whose nav/footer is external-link-heavy passes regardless of its content.
- `pagesWithSufficientLinks > 0` means ONE qualifying page out of N passes the whole site, while the description promises 'per content page'. A 5-page scan where only the homepage has social icons reports PASS.
- `applicablePageTypes: ['content']` doesn't filter the loop, so homepage/product/category pages contribute to a content-page audit.
- A multi-brand operator's sibling domain, or the site's own asset host `cdn.example-assets.com`, is counted as an external citation.
- No dedupe before thresholding — `externalLinks.push(url.hostname)` then `>= 2` means two links to the same external page count as two citations.

**Test gaps:**

- No test with a realistic footer containing social icons — the dominant false-pass scenario.
- No test for `rel="nofollow"`/`rel="sponsored"` exclusion (the behavior doesn't exist and isn't asserted either way).
- No test distinguishing in-content links from nav/footer links.
- No test for duplicate links to the same URL counting twice.
- No test for a sibling or CDN domain owned by the same operator.
- No test where the qualifying page is the homepage and content pages have none — the 'any page passes' leniency is untested.

**Overlaps with:** _none_

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** Adding citations to external sources in a page's body raises that page's visibility in generative-engine answers, measured as position-adjusted word count and subjective impression, relative to the same page without them.

**Grade: B** — a controlled study reports a measured double-digit delta for exactly this edit, but no engine documents reading outbound citations and the effect is contested at the retrieval stage.

**Evidence:**

- The GEO study's "Cite Sources" method is one of its three top performers on GEO-BENCH. Position-Adjusted Word Count came out at 24.9 against a 19.5 baseline (+27.7%), and Subjective Impression at 21.9 against 19.3 (+13.5%). The paper reports that "Cite Sources performs particularly well for factual queries", because citations provide verification. This is the framework behind the widely-quoted "boost visibility by up to 40% in generative engine responses" headline — https://arxiv.org/abs/2311.09735 (verified 2026-08-21), full results at https://arxiv.org/html/2311.09735v3 (verified 2026-08-21)
- The 2026 critical survey places references in the better-replicated tier: "directly extractable information—figures, definitions, quotations, and references—can facilitate the use of a document" — https://arxiv.org/html/2607.14035v1 (verified 2026-08-21)
- Google's content guidance frames sourcing as a quality signal — "If the content draws on other sources, does it avoid simply copying or rewriting those sources, and instead provide substantial additional value and originality?" — https://developers.google.com/search/docs/fundamentals/creating-helpful-content (verified 2026-08-21)

**Counter-evidence:** The same survey records a direct upstream contradiction: "citation-oriented rewrites can impair retrieval". It cites SAGEO Arena finding that body-only optimization "reduces average top-20 presence by approximately 9%". A page can therefore gain inside the answer while losing its chance to enter the candidate set (https://arxiv.org/html/2607.14035v1, verified 2026-08-21). The GEO measurements are conditional on the page already sitting in a fixed retrieval context, and every winning method in that study adds content, which confounds the citation manipulation with length. Google states there are "no additional requirements to appear in AI Overviews or AI Mode, nor other special optimizations necessary" (https://developers.google.com/search/docs/appearance/ai-features, verified 2026-08-21). Nothing in the evidence supports the audit's "RAG systems cross-reference your citations against their knowledge graph" wording, and no source supports a ≥2-outbound-anchor threshold as the operationalization of "citation".

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
