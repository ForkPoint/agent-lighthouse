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
  - GFM tables have one header row, no column or row spans, and no nesting: "Block-level elements cannot be inserted in a table." For a row carrying more cells than the header, "If there are greater, the excess is ignored." Neither case is an error. The parser produces a well-formed table with the extra data gone, and that is why the loss is silent.
- **[HTML Standard — tabular data](https://html.spec.whatwg.org/multipage/tables.html)** (S7, verified 2026-08-24)
  - Header association is defined through `th`, `scope` and `headers`. A table built only from `td` has no header association at all, so nothing machine-readable names its columns.
- **[Jina Reader](https://jina.ai/reader/)** (S10, verified 2026-08-21) and **[Firecrawl](https://docs.firecrawl.dev/)** (S11, verified 2026-08-24)
  - Both convert main content to markdown before it reaches a model — Firecrawl's own framing is "Turn any website into LLM-ready data", with "Clean markdown" named as the output. That conversion is the step this audit reproduces: the markdown is what the model reads, not the table markup.

**Falsifiable by construction.** The round trip is deterministic — serialize,
re-parse, diff — so a disputed finding is settled by running it, not by
argument.

## Example failure

A pricing comparison table uses a two-row header where 'Monthly' and 'Annual' sit under a colspan=2 th labelled 'Price'. GFM has no colspan, so the serializer emits a single header row and every price column shifts left by one. The re-parsed grid associates the annual price with the feature-count column. A model asked 'what is the annual price of the Pro plan' answers with a seat count.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Implementation deviations

- `thScopeCoverage` is not measured. The round trip already shows whether a header reaches its column, and `scope` coverage is an accessibility concern.
- `hasCaption` is reported as the table's label, not as a finding.
- The GFM serializer and parser are written in place. The audit needs only two GFM rules: one header row, and a spanned cell written once.
- The grid is expanded before the diff, so a header spanning two columns is compared as heading both.
- A row is ragged only when its cells miss the header width and no `rowspan` from above fills it.
- `shiftedCells` and `mergedCells` are not separate classes. The diff reports every changed coordinate and whether its source cell was spanned.
- `headerlessNumeric` and stranded units fail outright. Otherwise the page fails below a score of 0.5 and warns on any finding. These bands are this implementation's own.
- Only tables inside `<main>` are read, or the body when there is no `<main>`.

## Deferred

- Multi-page assessment. Only `ctx.pages[0]` is measured.
