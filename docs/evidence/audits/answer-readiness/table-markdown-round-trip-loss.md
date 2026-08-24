---
audit: answer-readiness/table-markdown-round-trip-loss
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/table-markdown-round-trip-loss.ts
slug: table-markdown-round-trip-loss
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - gfm-tables-extension
  - whatwg-tables
  - jina-reader
  - firecrawl-docs
---


# Table Markdown Round-Trip Loss

> Shipped in v2. Evidence grade **B** · scored tier · partial overlap · implementation: `static-fetch`

## What it checks

Converts every main-content table to GFM markdown — the exact representation answer-engine readers emit — re-parses it, and diffs cell-for-cell against the source DOM. Any cell lost, merged, or de-associated is reported by coordinate. Layered on top of the WHATWG header-association check (th, scope, headers) so the finding distinguishes 'screen readers can't parse this' from 'the LLM will read the wrong number'.

## Claimed mechanism (falsifiable)

Production ingestion pipelines convert HTML to markdown before embedding (S10 Jina Reader, S11 Firecrawl). GFM tables cannot represent colspan/rowspan, cannot nest, cannot hold block content ('Block-level elements cannot be inserted in a table'), and silently discard excess cells ('the excess is ignored') (S8). So a spanned header, a nested table, or a ragged row does not degrade gracefully — it produces a well-formed markdown table containing values shifted into the wrong columns, which the model then reads as fact. Meanwhile WHATWG leaves header association undefined for tables built purely from td (S7), so headerless numeric tables have no machine-recoverable meaning at all. Falsifiable: round-trip the table and compare; the loss is deterministic and reproducible, not a judgement.

## Evidence

The proposal's evidence block was mis-pasted: it carried MCP authorization and
web-agent sources, none of which touch tables or markdown conversion. The
sources the mechanism paragraph actually names are restated here, and each was
re-fetched on 2026-08-24 except where a date is given.

- **[GitHub Flavored Markdown Spec — tables extension](https://github.github.com/gfm/#tables-extension-)** (S8, verified 2026-08-24)
  - GFM tables have one header row, no column or row spans, and no nesting: "Block-level elements cannot be inserted in a table." For a row carrying more cells than the header, "If there are greater, the excess is ignored." Neither case is an error — the parser produces a well-formed table with the extra data gone, which is why the loss is silent.
- **[HTML Standard — tabular data](https://html.spec.whatwg.org/multipage/tables.html)** (S7, verified 2026-08-24)
  - Header association is defined through `th`, `scope` and `headers`. A table built only from `td` has no header association at all, so nothing machine-readable names its columns.
- **[Jina Reader](https://jina.ai/reader/)** (S10, verified 2026-08-21) and **[Firecrawl](https://docs.firecrawl.dev/)** (S11, verified 2026-08-24)
  - Both convert main content to markdown before it reaches a model — Firecrawl's own framing is "Turn any website into LLM-ready data", with "Clean markdown" named as the output. That conversion is the step this audit reproduces: the markdown is what the model reads, not the table markup.

**Falsifiable by construction.** The round trip is deterministic — serialize,
re-parse, diff — so a disputed finding is settled by running it, not by
argument.

## Competitor coverage

axe-core and Lighthouse's accessibility category check th presence, scope validity, and headers/id references — that overlap is real but framed for assistive tech, and they stop at the DOM. Nobody performs the markdown round-trip, which is the part that predicts LLM misreads. No competitor flags colspan-in-header, nested tables, ragged rows, or units-stranded-in-caption as extraction hazards.

## Implementation sketch

Static fetch. Per table in main content: 1) DOM-level flags — hasCaption, hasTh, thScopeCoverage (fraction of th with a valid scope when the table has both row and column headers), spannedHeader (any th with colspan or rowspan > 1), nestedTable, blockContentInCell (p/ul/ol/table/dl inside td or th), raggedRow (row cell count, expanded for spans, differs from header column count), headerlessNumeric (zero th and >= 2 numeric-majority columns), unitsStranded (currency or unit token present in <caption> or a footnote but absent from every header cell and every cell). 2) Round-trip: serialize with a GFM table serializer, re-parse with a GFM parser, rebuild the grid, and diff against the expanded source grid. Report lostCells, shiftedCells, and mergedCells with row/column coordinates and their text. 3) Fail the table on any nonzero round-trip loss, or on headerlessNumeric, or on unitsStranded. 4) Score = tables with zero loss / total main-content tables. 5) Suggested fix per finding: flatten spanned headers into repeated explicit th, move units into header cells, pull block content out of cells.

## Example failure

A pricing comparison table uses a two-row header where 'Monthly' and 'Annual' sit under a colspan=2 th labelled 'Price'. GFM has no colspan, so the serializer emits a single header row and every price column shifts left by one. The re-parsed grid associates the annual price with the feature-count column. A model asked 'what is the annual price of the Pro plan' answers with a seat count.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Implementation deviations

Every DOM-level flag in the sketch ships except `thScopeCoverage`: the round
trip already tells the caller whether a header reaches the column it heads, and
`scope` coverage is the accessibility framing the dossier explicitly sets this
audit apart from. `hasCaption` is reported as the table's label rather than as a
finding — a missing caption costs a reader context, but no cell.

The serializer and the parser are written in place rather than pulled in as a
markdown library. The audit does not need a general converter: it needs the two
table behaviours GFM specifies — one header row, and a spanned cell written once
— reproduced exactly. Twenty lines that do only that are testable against the
spec text; a dependency would add a whole markdown implementation to be sure of
the same two rules.

The grid is expanded before the diff, so a header spanning two columns is
compared as heading both. That is what makes the loss visible: the round trip
returns the text in the first column and nothing in the second.

A row is called ragged when the cells it declares do not add up to the header
width *and* the grid row was not filled by a `rowspan` from above. Without the
second condition every table using `rowspan` reports every row it touches.

Status bands are this implementation's. `headerlessNumeric` and stranded units
fail outright — they hand a model numbers with nothing naming them. Otherwise
the page fails below a score of 0.5 and warns on any finding at all. The
proposal specifies the per-table failure rule and the score; the page-level
bands follow from them.

## Deferred

- **`shiftedCells` and `mergedCells` as separate classes.** The diff reports
  every coordinate whose text changed, and names whether the source cell was
  spanned. Splitting that into three named classes would be a naming exercise
  over the same coordinates.
- **Tables outside the main content.** A pricing table in a footer is chrome.
  The scope is `<main>` where it exists, the body otherwise.
- **Multi-page.** Only the entry page is measured; table markup is a property of
  a template.
