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

## Code review findings (2026-08-20, 11-agent pass)

The signal — the Organization schema name actually appears in rendered copy so entity resolution can anchor — is legitimate, and this file shows the most care in the category (legal-suffix stripping, full-body text, shared `flattenJsonLd`). But candidate collection widens so far that it defeats the audit: `addCandidate(article['name'])` pulls in the *page title* of every Article/BlogPosting/WebPage/WebSite node, and any candidate matching anywhere in body text passes. Since an article's `name` is almost always its `<h1>`, a page whose brand is entirely absent from the copy PASSES on its own headline — and the failure message then names `candidates[0]`, which may be a different string than the one actually tested.

**Required fix:** 1) Stop treating `Article`/`BlogPosting`/`WebPage` `name` as a brand candidate — keep only Organization/LocalBusiness/Corporation `name`, `WebSite.name`, `publisher.name`, and `og:site_name`. 2) Build the match regex with the `u` flag and replace `\b` with Unicode-letter lookarounds (`(?<!\p{L})…(?!\p{L})`), falling back to plain substring for scripts without word separators. 3) Normalize both sides (NFKD, strip diacritics, fold curly quotes, collapse NBSP) before matching. 4) Extend `stripLegalSuffix` with common non-English forms, and require the stripped remainder to be ≥3 characters before using it. 5) Report the candidate that actually matched or failed, not `candidates[0]`. 6) Skip pages whose extracted body text is below a minimum length (SPA shell) and return `notApplicable` instead of failing.

**False-positive risks:**
- `const articles = findJsonLdByType(p.jsonLd, ['Article','BlogPosting','WebPage','WebSite']); for (const article of articles) { addCandidate(article['name']); ... }` — `Article.name` is the headline, not a brand. It enters `matchNames`, and the `<h1>` guarantees it appears in body text. Result: near-unconditional PASS on any page with Article or WebPage schema, reported as 'Brand name "How to Bake Sourdough" appears in body text.' The user is told their brand entity is anchored when nothing of the sort was verified.
- `new RegExp('\\b'+escaped+'\\b','i')` — JS `\b` is an ASCII word boundary. For a brand in Cyrillic ("Яндекс"), Greek, Hebrew, Arabic, Japanese or Chinese, `\b` does not match at the script boundary, so a brand plainly present in the copy is reported absent — a hard FAIL driven purely by script. Same failure for brands ending in a non-word character ("Yahoo!", "Guess?").
- No Unicode normalization or typographic folding: schema `"Nestlé"` vs body `"Nestle"`, or a straight apostrophe in schema vs `’` in copy, or an NBSP inside a multi-word brand, all produce false FAILs.
- `stripLegalSuffix` covers only `inc|llc|ltd|co|corp|gmbh|company`. French SAS/SARL, Spanish S.L./S.A., Italian S.r.l., Dutch B.V., Swedish AB and Japanese 株式会社 are not stripped, so "Acme S.r.l." never matches body copy saying "Acme".
- The `co` alternative cuts the other way: "Head Co" → "Head", which then matches the word "head" anywhere in body text — false PASS. Short candidates ("Up", "Go", "Now") match ordinary prose instantly, with no minimum-length guard.
- The fail message reports `orgName = candidates[0]` while the pass path iterates all of `matchNames`, so a pass triggered by a page-title candidate names a different string than the one matched — inconsistent, confusing output.
- `getBodyText` reads server HTML. On a client-rendered SPA whose shell is `<div id="root"></div>`, body text is empty and every brand FAILS even though the schema in the shell supplies the name.

**Test gaps:**
- No test asserting that an Article/WebPage `name` must not satisfy the brand check — the dominant false-pass path. The existing test 'handles Article JSON-LD without publisher gracefully' actively asserts the false-pass behavior as correct.
- No test for a non-Latin-script brand (the `\b` failure).
- No test for diacritics or curly-vs-straight apostrophe mismatch between schema and copy.
- No test for non-English legal suffixes (S.L., B.V., AB, 株式会社).
- No test for a very short brand name matching ordinary prose.
- No test for an SPA shell with empty body text.
- No test for the mismatch between the matched candidate and the `orgName` named in the failure message.

**Overlaps with:** _none_

## Evidence

### Signal: Brand name consistency across page, markup, and metadata — grade C (geo-authority)

**Mechanism:** Using one consistent brand/organization name across the page title, visible content, og:site_name and Organization/WebSite structured data improves machine entity resolution and thereby increases the likelihood of the brand being cited by AI answer engines.

**Evidence:** The entity-resolution half is documented, precisely and verbatim, by Google — just for a different outcome than AI citation. Google's site-names doc gives a ranked signal list (WebSite structured data > og:site_name > <title> > headings > other home page text) and instructs: 'Use your site name consistently across your home page. Make sure whatever you use as the site name in structured data is consistent with how you refer to your site in other sources on your home page that our system considers.' The Organization doc reinforces it: 'Use the same name and alternateName that you're using for your site name.' It also confirms that these properties influence the Knowledge Panel. On the AI side, Ahrefs' 75,000-brand study found off-site brand signals dominate AI Overview visibility: brand web mentions 0.664 Spearman, brand anchors 0.527, brand search volume 0.392 — roughly 3x backlinks at 0.218 — and brands in the top mention quartile earn far more AIO mentions. Semrush found Organization schema on 25% (ChatGPT) / 34% (AI Mode) of cited pages. So entity clarity is plausibly load-bearing; the on-page consistency check is cheap and standards-conformant.

**Counter-evidence:** The evidence measures a different variable than the audit does. Ahrefs measured off-site brand MENTIONS — a reputation quantity built over years — not on-page name consistency, which no study has isolated; Ahrefs explicitly states 'correlation ≠ causation' and that 'all the factors we studied revealed moderate to very weak correlations'. Google's documented use of name consistency is for site-name DISPLAY and Knowledge Panel, not AI citation, and Google's AI-features doc says outright there is 'no special schema.org structured data that you need to add' for AI Overviews or AI Mode. The 2026 critical survey states brand signals are 'not independently evaluated' in the GEO literature. Most damaging: Semrush's 100M-citation study shows citation share is governed by platform-level source-mix policy, not brand attributes — Reddit collapsed from ~60% of ChatGPT responses in early August 2025 to ~10% by mid-September, and Wikipedia from ~55% to under 20%, in weeks, with no change in either brand's on-page markup. Correlational, unisolated, and swamped by platform policy: informative only.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
