---
audit: generative-engine/external-citations
audit_id: "10.5"
category: generative-engine
source_file: packages/core/src/audits/generative-engine/external-citations.ts
slug: external-citations
review_verdict: fix
severity: medium
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# external-citations (`10.5`)

> generative-engine · source `external-citations.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

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

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
