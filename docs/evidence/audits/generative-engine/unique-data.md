---
audit: generative-engine/unique-data
audit_id: "10.13"
category: generative-engine
source_file: packages/core/src/audits/generative-engine/unique-data.ts
slug: unique-data
review_verdict: fix
severity: medium
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# unique-data (`10.13`)

> generative-engine · source `unique-data.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

## What it checks

AI generative engines prioritize content with original, citable data points over vague claims. Include specific statistics and metrics.

## Code review findings (2026-08-20, 11-agent pass)

There is thin published support for 'statistics make content more citable in generative answers' (the 2024 GEO study), so the signal is not invented, and the comment shows the pattern was tightened once already. But the tightened pattern still counts prices and any comma-grouped number, so every e-commerce and pricing page trivially clears the 3-match bar with `$29.99`, `$1,200`, `1,000+` — the audit rewards a product grid as 'unique data or statistics'. It measures numeral density while the title, description and guidance all promise originality.

**Required fix:** 1) Drop the bare currency branch, or require currency figures to sit in sentence context rather than in a price/grid element (exclude matches inside elements whose class or itemprop indicates a price). 2) Add non-USD symbols and European separator formats keyed off `lang`/`Offer.priceCurrency`. 3) Count per page and require a single page to clear the threshold instead of summing across pages. 4) Rename to what it measures ('Quantified claims in content') and rewrite the guidance to stop promising originality the code cannot assess. 5) Exclude nav/header/footer from the text root. 6) Scope to `pageType === 'content'`.

**False-positive risks:**
- `\$[\d,]+(?:\.\d{2})?` counts product prices. A shop page listing three items PASSES 'Unique data or statistics' with 'Examples: $29.99, $1,200, $45.00', telling the user their content has citable original research.
- `\b\d{1,3}(?:,\d{3})+\b` matches any comma-grouped number: review counts ('1,234 reviews'), follower counts, SKU numbers, page-view badges.
- The currency branch is USD-only. A European site writing `1.200 €` or `£29.99`, or a Japanese `¥1,200`, matches only incidentally; the German thousands form `1.200` matches nothing → false FAIL on a site full of figures.
- The percent branch matches discount badges ('20% off'), which are marketing, not data.
- No originality signal whatsoever despite `title: 'Unique data or statistics'` — a page quoting a widely-copied third-party statistic scores identically to primary research. The audit cannot distinguish them and the copy shouldn't claim it does.
- `allMatches.push(...matches.slice(0, 10))` caps per page, then `allMatches.length >= 3` aggregates ACROSS pages, so three pages with one price each PASS as though one page were data-rich.
- No `applicablePageTypes`, so category/product pages are graded by a rule framed for editorial content.
- `getMainContentText` falls back to `<body>` when there is no `<main>`, so nav badges, promo banners and footer stats count as content data; on an SPA shell there is no text at all → hard FAIL.

**Test gaps:**
- No test for a product/pricing page passing on prices alone — the dominant false-pass path.
- No test for non-USD currency or European decimal/thousands separators.
- No test for discount badges ('20% off') in nav or a promo banner.
- No test for the cross-page aggregation making three one-figure pages pass.
- No test for an SPA shell.
- Only 4 tests, all single-sentence bodies.

**Overlaps with:** _none_

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
