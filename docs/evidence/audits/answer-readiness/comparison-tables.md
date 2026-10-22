---
audit: answer-readiness/comparison-tables
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/comparison-tables.ts
slug: comparison-tables
evidence_grade: C
disposition: "kept — feature scope corrected 2026-10-21"
reviewed: 2026-10-21
recommended_tier: informative
consumers: []
consumers_note: no vendor documents table markup as an answer-selection or citation signal
signals:
  - name: Comparison tables
    grade: C
    domain: aeo-content
sources:
  - format-as-prior-arxiv
  - geo-sfe-structural-arxiv
  - zyppy-ai-citation-factors
  - google-ai-features-trust
  - google-ai-optimization-mythbusting
  - semrush-ai-overviews-study
---

# comparison-tables (`9.5`)

> answer-engine · source `comparison-tables.ts` · review verdict **corrected** · evidence grade **C** · disposition: **kept — feature scope corrected**

## What it checks

Visible headings or captions containing compare, compares, compared, comparing, comparison, versus or vs establish comparison intent on every page type. An ordinary table, price or product classification does not establish that intent. Relevant pages need a visible table with a header row of at least two header cells and a data row of at least two data cells. Presentation tables do not count. All relevant pages covered: pass; some: warn; none: fail; no relevant pages: NA.

## Why it matters

The check remains C/informative with weight 0. Existing evidence supports treating semantic tables as an optional structure convention, not as a proven AI citation advantage. No new consumer or scoring claim is introduced.

## Evidence

### Signal: Comparison tables — grade C (aeo-content)

**Mechanism:** Expressing comparative/multi-attribute data as a real HTML table (rather than styled divs or prose) increases the probability that an answer engine extracts the comparison and cites the page for comparative queries.

**Evidence:** Tables are included in the structural bundles that measured positive. GEO-SFE's meso-structure — lists and tables at 25–35% of content — contributed 39.7% of a 17.3% citation gain (p<0.001, −3.1pp on ablation), and Zyppy's 'AI-ready Structure' factor (explicitly naming tables) scores 8.6. The mechanistic argument is decent — TableRAG-style pipelines linearize tables to Markdown, so a genuine table survives extraction as aligned rows while a div-grid comparison degrades into unlabeled text fragments. Google does require that 'important content is available in textual form', which a real table satisfies and an image-of-a-table does not.

**Counter-evidence:** The strongest counter-evidence in this domain. Format as a Prior measured a cross-model preference hierarchy in which 'semantically rich formats such as texts and KGs are consistently favored over visually structured ones like infoboxes and tables'. Against plain text, tables scored 0.398, KGs 0.336 and infoboxes 0.235. Models systematically preferred prose when the same fact was available both ways. No vendor documents tables as a citation signal, and Google states there are no additional requirements or special optimizations for AI features. No study located isolates the causal effect of converting a styled div-grid into semantic table markup — the specific edit this audit would recommend. The widely circulated claim that 'pages with well-structured comparison tables have a structural advantage' traces only to SEO vendor blogs with no disclosed methodology. Keep the audit as an accessibility/extractability hygiene check (real table markup beats an image or a div grid), not as a citation-rate lever.

## Limits

Intent detection covers explicit English headings and captions only. Prose comparisons without those labels remain NA. Row-oriented comparisons and other accessible table layouts are not recognized by this conservative shape check. A table elsewhere on a comparison page may satisfy the page-level check; association with a specific comparison section remains deferred.

## Implementation deviations

- Comparison keywords use a word boundary, so punctuation such as a comma after "comparison" still selects the page. "vs" or "versus" must sit between two terms, and a bare upper-case "VS" is not read as "versus", so "Setting up VS Code" does not qualify. "Compare-at" price labels and a heading that is only "Compare" do not establish intent.

- The 2026-10-21 correction replaces broad page-type filtering with independent feature selection. Runner tests cover all five types and both provenance modes. Mixed samples exclude unrelated and unread pages.
- Headings, captions and tables in site chrome, in an `aside` or in a `role="complementary"` region are ignored: a sidebar "Comparison guides" widget would otherwise make every page relevant. Site chrome is navigation plus a `<header>` or `<footer>` outside article, aside, main, nav and section (or their explicit ARIA roles), which is the HTML-AAM banner and contentinfo scope. A header or footer inside an article is content: post dates, titles and sources often sit there.
- Text is read through the shared `readerText` helper: hidden descendants of a visible element (`hidden`, inline `display:none` or `visibility:hidden`, `aria-hidden`) are pruned before matching. Block boundaries and `<br>` become spaces, so "iPhone vs<br>Pixel" still reads as a comparison.

## Deferred

- Broader language and layout recognition requires new fixtures. Do not infer missing obligations from page type alone.
