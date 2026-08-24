---
audit: answer-readiness/specific-numbers
audit_id: "9.7"
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/specific-numbers.ts
slug: specific-numbers
review_verdict: fix
severity: medium
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# specific-numbers (`9.7`)

> answer-engine · source `specific-numbers.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

## What it checks

AI engines prefer answers with concrete data points over vague statements. Include specific numbers, percentages, and metrics in your content.

## Code review findings (2026-08-20, 11-agent pass)

Regex-matches unit-bearing numbers, currency amounts, percentages and grouped thousands in each page's main text; passes if ANY page has ≥1 match. The unit regex is a genuine improvement over the older bare-digit version, but the threshold makes the audit almost unfalsifiable — one '$20' or '5 days' anywhere on the site passes — while the currency and thousands branches are ASCII/US-format-only, so European and non-Latin-currency sites can false-fail. The reported 'Examples:' string also surfaces junk matches.

**Required fix:** Require the single-letter units to be preceded by a digit with no space (`200g`, not `5 g`) or drop `in|x|k|l|g` from UNIT entirely; they generate more junk than signal. Add postfix currency and locale number formats (Intl-aware, or at minimum `\d[\d .,]*\s?(?:€|zł|kr|CHF|EUR|USD|₹|₺)`), and accept space/period thousands separators. Raise the pass bar to a per-page density (e.g. ≥3 distinct data points on the page being judged) and report per-page coverage rather than site-wide OR. Suppress the found/Examples output when the only matches come from the fuzzy branches. Finally, detect the empty-content case explicitly so the failure does not misdiagnose a rendering problem as a copywriting problem.

**False-positive risks:**
- Single-match threshold: `if (matches && matches.length > 0)` on any one page passes the site. A content-free storefront with one price string is graded as having 'concrete data points'; there is no density or per-page requirement behind the claim that the content is data-rich.
- Currency is ASCII-limited to `[$€£¥]` with the symbol BEFORE the amount. Postfix-currency locales ('1 200,50 €', '250 zł', '₹1,499', '₺350', 'CHF 20', '20 EUR') are missed by the currency branch.
- Thousands separator hard-codes commas: `\b\d{1,3}(?:,\d{3})+`. European '10.000', French/Nordic narrow-no-break-space '10 000', and Indian lakh grouping '1,50,000' do not match.
- Single-letter units create junk matches: UNIT includes `in|x|k|l|g`. '5 in stock' yields the match '5 in'; '2 x 4' yields '2 x'; '3 l' and '10 k' likewise. These are pushed verbatim into the user-facing `Examples: ...` field, so a passing report shows nonsense evidence.
- Unit list is English-only: 'kg/g/days/hours/minutes' etc. A German page with '3 Tage', '500 Gramm', French '3 jours' matches nothing outside the percentage/currency branches.
- Decimal-comma percentages partially work by accident ('99,9 %' matches only the '9 %' fragment), so the reported example is a truncated, misleading figure.
- Case-insensitive `gi` compilation of the pattern means the 'K'/'X'/'L' units also match capitalized stray letters, widening the junk-match surface.
- SPA/CSR: no server-rendered text → false fail.
- The failure message ('No specific numbers, percentages, or dollar amounts found in content') is in practice a proxy for 'this page rendered almost no text', not for a copywriting problem — the diagnosis handed to the user is the wrong one.

**Test gaps:**
- No European number formats ('1 200,50 €', '10.000', '250 zł', '₹1,499').
- No test exposing the '5 in stock' → '5 in' or '2 x 4' → '2 x' junk examples that reach the user-facing found field.
- No non-English unit words ('3 Tage', '500 Gramm').
- No test of the single-match threshold (e.g. one price on a 12-page scan passing the whole site).
- No empty-SPA-shell test distinguishing 'no data points' from 'no rendered content'.

**Overlaps with:** _none_

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Evidence (2026-08-21)

**Mechanism claim:** Adding concrete statistics to a source document raises the prominence of that source's citations in a generative engine's answer, relative to the same document carrying the same claims in vague quantitative language.

**Grade: B** — this is the one signal in the answer-engine category with a controlled, peer-reviewed measurement of exactly the intervention it describes, on both a 10,000-query benchmark and a live commercial engine.

**Evidence:**
- GEO (Aggarwal et al., KDD '24) tested Statistics Addition as one of nine methods over GEO-bench (10,000 queries, five random seeds). Table 1: Statistics Addition scores 25.2 on the overall Position-Adjusted Word Count metric against a 19.3 no-optimization baseline (Quotation Addition 27.2, Cite Sources 24.6). The paper states its top methods "achieved a relative improvement of 30-40% on the *Position-Adjusted Word Count* metric and 15-30% on the *Subjective Impression* metric" — https://arxiv.org/abs/2311.09735 (verified 2026-08-21)
- The abstract generalizes the result: "including citations, quotations from relevant sources, and statistics can significantly boost source visibility, with an increase of over 40% across various queries" — https://arxiv.org/abs/2311.09735 (verified 2026-08-21)
- Confirmed on a live engine, not just a simulated one: "We also demonstrate the efficacy of Generative Engine Optimization on Perplexity.ai, a real-world generative engine and demonstrate visibility improvements up to 37%" — https://arxiv.org/abs/2311.09735 (verified 2026-08-21)
- The benchmark discriminates rather than rewarding any edit: Keyword Stuffing scored 17.7, *below* the 19.3 unoptimized baseline, and the authors conclude such methods "offer little to no improvement on generative engine's responses" (Table 1, §4) — https://arxiv.org/abs/2311.09735 (verified 2026-08-21)

**Counter-evidence:** The effect is conditional on where the source already ranks. Table 2 of the same paper reports Statistics Addition's relative visibility change by search rank as −20.6% (Rank-1), −3.9% (Rank-2), +8.1% (Rank-3), +10.0% (Rank-4), +97.9% (Rank-5) — for an already top-ranked page the measured effect is negative, so this is a signal that helps low-visibility sources and can hurt leaders. Table 3 further shows the gain concentrates in "Law & Gov.", "Debate" and "Opinion" query tags, not uniformly. C-SEO Bench, a later independent benchmark, concludes "Most current C-SEO methods are not only largely ineffective but also frequently have a negative impact on document ranking, which is opposite to what is expected" (https://arxiv.org/abs/2506.11097). Google states "You don't need to write in a specific way just for generative AI search" (https://developers.google.com/search/docs/fundamentals/ai-optimization-guide). Most importantly for this audit specifically: the measured intervention was *relevant statistics that support the document's claims*, whereas the detector fires on any unit-bearing number anywhere in main content — "30-day", "$19", "3-5 days", a shipping estimate — so a page can pass without carrying a single supporting statistic. The grade attaches to the signal, not to this detector. All URLs verified 2026-08-21.
