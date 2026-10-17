---
audit: answer-readiness/comparison-tables
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/comparison-tables.ts
slug: comparison-tables
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
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

> answer-engine · source `comparison-tables.ts` · review verdict **fix** · evidence grade **C** · disposition: **keep — fix required**

## What it checks

The v7 runner includes `article` and `general` pages in this check's existing page population. This preserves coverage when the old catch-all classification becomes unknown. The audit body still owns its existing feature and artifact guards. This scope change does not establish a new consumer path.

AI answer engines extract structured table data to generate comparison answers. Add HTML tables to your content where appropriate.

## Evidence

### Signal: Comparison tables — grade C (aeo-content)

**Mechanism:** Expressing comparative/multi-attribute data as a real HTML table (rather than styled divs or prose) increases the probability that an answer engine extracts the comparison and cites the page for comparative queries.

**Evidence:** Tables are included in the structural bundles that measured positive. GEO-SFE's meso-structure — lists and tables at 25–35% of content — contributed 39.7% of a 17.3% citation gain (p<0.001, −3.1pp on ablation), and Zyppy's 'AI-ready Structure' factor (explicitly naming tables) scores 8.6. The mechanistic argument is decent — TableRAG-style pipelines linearize tables to Markdown, so a genuine table survives extraction as aligned rows while a div-grid comparison degrades into unlabeled text fragments. Google does require that 'important content is available in textual form', which a real table satisfies and an image-of-a-table does not.

**Counter-evidence:** The strongest counter-evidence in this domain. Format as a Prior measured a cross-model preference hierarchy in which 'semantically rich formats such as texts and KGs are consistently favored over visually structured ones like infoboxes and tables'. Against plain text, tables scored 0.398, KGs 0.336 and infoboxes 0.235. Models systematically preferred prose when the same fact was available both ways. No vendor documents tables as a citation signal, and Google states there are no additional requirements or special optimizations for AI features. No study located isolates the causal effect of converting a styled div-grid into semantic table markup — the specific edit this audit would recommend. The widely circulated claim that 'pages with well-structured comparison tables have a structural advantage' traces only to SEO vendor blogs with no disclosed methodology. Keep the audit as an accessibility/extractability hygiene check (real table markup beats an image or a div grid), not as a citation-rate lever.

## Implementation deviations (v7 P3, 2026-10-07)

The added labels preserve the old general-content population while classification changes. This is not the final feature-gate migration. The evidence grade, tier, weight, and audit ID stay unchanged.
