---
audit: answer-engine/specific-numbers
audit_id: "9.7"
category: answer-engine
source_file: packages/core/src/audits/answer-engine/specific-numbers.ts
slug: specific-numbers
review_verdict: fix
severity: medium
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# specific-numbers (`9.7`)

> answer-engine · source `specific-numbers.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

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
