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

AI answer engines extract structured table data to generate comparison answers. Add HTML tables to your content where appropriate.

## Code review findings (2026-08-20, 11-agent pass)

Counts `p.$('table').length` across every scanned page and passes if the total is > 0. It never inspects the table — no <thead>, no <th>, no column count, no comparative content — despite the title, the failure message ('No comparison tables found') and the guidance all being about comparison tables specifically. Any table passes; every non-table comparison layout fails. The underlying signal (tabular data is easy for agents to extract) is real but this implementation does not measure it.

**Required fix:** Only count a table that is plausibly comparative: ≥1 <th> (or a first row of <th>-like cells), ≥2 data columns, and ≥2 body rows; exclude tables inside header/nav/footer and tables with `role="presentation"`. Filter `ctx.pages` by the audit's own applicablePageTypes. Return `notApplicable()` when no scanned page shows comparative intent (no comparison/vs/pricing heading and no multi-item listing) instead of failing sites that have nothing to compare. Either rename the audit to 'tabular data present' or make the detection match the name.

**False-positive risks:**
- Any <table> passes: size charts, nutrition panels, shipping-cost grids, an embedded email-template table, a legacy layout table, a WYSIWYG-pasted table, or a calendar widget all produce 'Found N table(s)' and the audit reports comparison tables are present.
- Ignores the guidance it prints: the fix text demands '<thead> and <th> headers ... each column has a descriptive header', but `$('table').length` never checks for a single <th>. A headerless layout table passes while the user is told their headers are fine.
- Modern responsive comparison UIs false-fail: comparison matrices built as CSS grid/flex divs, or with `role="table"`/`role="row"`/`role="columnheader"` ARIA (a common mobile-first pattern), are invisible to the selector and reported as 'No comparison tables found on any scanned page.'
- Site-wide OR: one table anywhere passes every page; the found value ('2 table(s)') is attributed to the first page with a table, which may be unrelated to the pages that actually need comparison content.
- Runs on pages it shouldn't: `applicablePageTypes: ['category','product','content']` gates execution only — the loop then counts tables on the homepage too (see category note 2).
- No applicability gate: a site with no comparative content at all (a single-product store, a portfolio) is failed for lacking comparison tables it has no reason to have. `notApplicable()` exists in the base class and is never used here.
- SPA/CSR: tables rendered client-side → false fail.
- Nearly identical code to numbered-steps.ts (same loop, same >0 pass) — the same defect exists twice.

**Test gaps:**
- No layout table / size chart / nutrition table showing the false pass.
- No headerless table (no <thead>/<th>) — the guidance's central requirement is untested.
- No div-grid or role="table" comparison layout showing the false fail.
- No site that legitimately has nothing to compare (should be `na`, is currently `fail`).
- No test that homepage tables are counted despite applicablePageTypes.
- No empty-SPA-shell test.

**Overlaps with:** `9.6`

## Evidence

### Signal: Comparison tables — grade C (aeo-content)

**Mechanism:** Expressing comparative/multi-attribute data as a real HTML table (rather than styled divs or prose) increases the probability that an answer engine extracts the comparison and cites the page for comparative queries.

**Evidence:** Tables are included in the structural bundles that measured positive: GEO-SFE's meso-structure (lists and tables at 25–35% of content) contributed 39.7% of a 17.3% citation gain (p<0.001, −3.1pp on ablation), and Zyppy's 'AI-ready Structure' factor (explicitly naming tables) scores 8.6. The mechanistic argument is decent — TableRAG-style pipelines linearize tables to Markdown, so a genuine table survives extraction as aligned rows while a div-grid comparison degrades into unlabeled text fragments. Google does require that 'important content is available in textual form', which a real table satisfies and an image-of-a-table does not.

**Counter-evidence:** The strongest counter-evidence in this domain. Format as a Prior measured a cross-model preference hierarchy in which 'semantically rich formats such as texts and KGs are consistently favored over visually structured ones like infoboxes and tables' — tables scored 0.398, KGs 0.336, infoboxes 0.235 against plain text, meaning models systematically preferred prose when the same fact was available both ways. No vendor documents tables as a citation signal, and Google states there are no additional requirements or special optimizations for AI features. No study located isolates the causal effect of converting a styled div-grid into semantic table markup — the specific edit this audit would recommend. The widely circulated claim that 'pages with well-structured comparison tables have a structural advantage' traces only to SEO vendor blogs with no disclosed methodology. Keep the audit as an accessibility/extractability hygiene check (real table markup beats an image or a div grid), not as a citation-rate lever.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
