---
audit: answer-readiness/question-headings
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/question-headings.ts
slug: question-headings
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: informative
consumers:
  - "Google Search / AI Overviews (headings generally: documented; question-FORM specifically: not documented)"
  - ChatGPT Search (observational only)
  - none-known for question-form as a distinct documented signal
signals:
  - name: Question-form headings (H2/H3 phrased as user questions)
    grade: C
    domain: aeo-content
sources:
  - google-ai-optimization-mythbusting
  - geo-sfe-structural-arxiv
  - indig-chatgpt-citation-study-sel
  - semrush-ai-overviews-study
  - zyppy-ai-citation-factors
  - cseo-bench-arxiv
  - geo-critical-survey-arxiv
---

# question-headings (`9.2`)

> answer-engine · source `question-headings.ts` · review verdict **fix** · evidence grade **C** · disposition: **keep — fix required**

## What it checks

AI answer engines directly match user questions to heading text. Question-formatted headings (ending with "?") are the primary signal AI systems use to identify which section answers a specific query.

## Code review findings (2026-08-20, 11-agent pass)

Counts H2/H3 headings whose text ends with '?' across all pages; ≥2 passes, 1 warns, 0 fails. The underlying idea — question-shaped section headers are easy retrieval anchors — is reasonable, but the check is a bare ASCII suffix test aggregated over the entire site, so it both false-passes (any site with an FAQ page passes every page) and hard-fails entire writing systems.

**Required fix:** Normalize the question test to `/[?？؟;]\s*$/u` after stripping trailing non-letter decoration, and gate on the page `lang`. Restrict extraction to the main content area (exclude header/nav/footer). Evaluate and report per page, not summed across the site. Require a following answer element (next sibling <p>/<div> with ≥20 words) before counting a heading, matching what the guidance tells users to do. Consider merging with 9.1 into a single 'question-and-answer structure' audit, since a site with an FAQ section passes both and a site without fails both.

**False-positive risks:**

- ASCII-only question mark: `h.text.trimEnd().endsWith('?')` misses the Arabic question mark '؟' (U+061F), the Greek erotimatiko ';' (U+037E), and the fullwidth '？' (U+FF1F) used in Chinese/Japanese headings. Arabic, Persian, Urdu, Greek and CJK sites score 0 no matter how question-formatted their headings are.
- Trailing decoration breaks the match: a heading rendered as `What is X? →` or `What is X?<span class="icon"></span>` — `extractHeadings` uses `$(el).text().trim()`, so any appended arrow, chevron glyph, or screen-reader text after the '?' causes the endsWith test to fail on a heading that is literally a question.
- Site-wide aggregation with no per-page attribution: `for (const p of ctx.pages) { ... }` sums counts across every page, then reports the total against `page.url` (= ctx.pages[0]). A site whose only question headings live on /faq passes, and the report points the user at the homepage as evidence.
- Headings from global chrome count: extractHeadings reads the whole document, so a footer or mega-menu heading ending in '?' ('Need help?') satisfies the pass threshold with no answer content behind it.
- `totalH2H3` is computed but only surfaced in the warn message; the pass path ignores ratio entirely, so 2 question headings among 400 (a large ecommerce site) reads identically to 2 among 4.
- SPA/CSR: headings injected client-side are absent from the fetched HTML → false fail.
- No verification that a question heading is followed by an answer — the guidance explicitly demands 'followed immediately by a direct answer paragraph', but nothing checks it, so a bare question-heading index page passes.

**Test gaps:**

- No non-ASCII question mark (؟ / ； / ？).
- No heading with trailing icon markup or an arrow after the '?'.
- No multi-page context showing the site-wide aggregation behavior.
- No header/footer heading ('Need help?') proving chrome is counted.
- No test that a question heading is followed by answer prose (the stated fix requirement is untested because it is unimplemented).
- No test on a page with a very large heading count where 2 questions is a negligible ratio.

**Overlaps with:** `9.1`

## Evidence

### Signal: Question-form headings (H2/H3 phrased as user questions) — grade C (aeo-content)

**Mechanism:** H2 and H3 headings can be phrased as the natural-language question a user would ask, rather than as topic labels. The claim is that this increases the probability that the passage beneath the heading is matched to a fan-out sub-query and cited — over and above having descriptive headings at all.

**Evidence:** Headings as such are vendor-documented. Google states that pages should be 'organized by paragraphs and sections, along with headings that provide a clear structure'. And Google's own definition of query fan-out — 'a set of concurrent, related queries generated by the model' — supplies a plausible mechanism for why question-shaped subheads would match sub-queries. GEO-SFE measured macro-structure (heading architecture, target depth 3–5 levels) as 44.9% of a 17.3% citation gain (p<0.001) with a −3.5pp ablation penalty. Indig's dataset found '78.4% of citations tied to questions came from headings', consistent with H2s acting as prompts and following paragraphs as answers. Semrush's 200k-keyword study confirms AI Overview queries skew to 'how'/'what' questions (35% desktop, 32% mobile), so question-shaped demand is real.

**Counter-evidence:** No vendor documents question-form headings, and Google explicitly says 'You don't need to write in a specific way just for generative AI search.' The 78.4% figure is a conditional proportion: of the citations that involved questions, most came from headings. It does not establish that converting a label heading to a question heading raises the citation rate, and the base rate is unstated. GEO-SFE tested heading depth and architecture, never question phrasing, so the controlled evidence does not cover this signal. C-SEO Bench found most authored content edits ineffective or actively harmful to ranking, and the GEO critical survey warns that 'generic heuristics transfer poorly' and 'citation-oriented rewrites can impair retrieval.' The vendor claims circulating in SEO blogs ('question headings improve citation within 4–8 weeks') trace to no measurable methodology. Distinguish two audits: 'has a sane heading hierarchy' is scorable; 'headings are phrased as questions' is not yet.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
