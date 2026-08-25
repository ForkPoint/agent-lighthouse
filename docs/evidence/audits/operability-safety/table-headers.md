---
audit: operability-safety/table-headers
category: operability-safety
source_file: packages/core/src/audits/operability-safety/table-headers.ts
slug: table-headers
evidence_grade: B
disposition: "keep"
reviewed: 2026-08-21
recommended_tier: scored
consumers:
  - Mozilla Readability
  - trafilatura
  - Playwright MCP / Chrome DevTools MCP snapshots
  - Anthropic read_page
  - browser-use
signals:
  - name: Data tables with th (and scope) header semantics
    grade: B
    domain: semantic-dom-a11y
sources:
  - readability-src
  - w3c-html-aam
  - w3c-wai-aria-1-2
  - trafilatura-corefunctions
  - browser-use-clickable-elements
  - web-almanac-2025-accessibility
  - mozilla-readability-source
---

# Data tables have header associations (`7.17`)

> operability-safety · source `_a11y.ts` · review verdict **keep** · evidence grade **B** · disposition: **keep**

## What it checks

Agents extracting tabular data rely on header↔cell associations (th scope / headers attr) to know what each value means. Missing associations make tables ambiguous.

## Code review findings (2026-08-20, 11-agent pass)

Bundles `td-has-header`, `th-has-data-cells`, `td-headers-attr`, `scope-attr-valid`. This is one of the few audits with a directly demonstrable extraction benefit: an agent pulling a spec/price table needs header↔cell association. The port includes axe's `isDataTable` heuristic and the ≥3x3 gate for `td-has-header`, which keeps layout tables out. Keep.

**Required fix:** _none — audit is sound as implemented_

**False-positive risks:**
- `isDataTable` is a heuristic: legacy layout tables (email templates, older CMS output, `<table>`-based pricing grids with borders and a caption) can be classified as data tables and fail `td-has-header`, giving a site owner remediation work on a table that carries no data semantics.
- Conversely a genuine data table rendered as `<div role="table">` without `role="columnheader"` is only partly covered (`td-headers-attr` matches grid/table roles but the td/th rules need real table elements) → false negative on modern virtualized tables.
- CSS blindness: hidden responsive table variants (sites ship a desktop `<table>` plus a hidden mobile card list, or vice versa) are both evaluated.
- CSR SPA / tables loaded by fetch → `na`.
- Four rules collapsed into one binary verdict at 'medium' with no attribution and a `table`/`table.foo` selector.

**Test gaps:**
- No HTML-level test for this audit (only synthetic `inapplicable` statuses in _a11y.test.ts).
- No layout-table fixture testing the `isDataTable` boundary.
- No fixture with `headers`/`id` association (as opposed to `scope`).
- No `role="table"` div-grid fixture.

**Overlaps with:** _none_

## Evidence

### Signal: Data tables with th (and scope) header semantics — grade B (semantic-dom-a11y)

**Mechanism:** The presence of <th>/<thead> is what causes an extractor to classify a table as a DATA table rather than a layout table, and data-table classification is what exempts it from boilerplate deletion. Concretely, in Mozilla Readability a table containing none of col/colgroup/tfoot/thead/th and no caption/summary is treated as layout and becomes eligible for removal by _cleanConditionally, so a th-less pricing or spec table can be deleted outright before the content reaches the model. In the accessibility tree, th additionally resolves to columnheader/rowheader so header-to-cell association survives.

**Grade: B** — Source-level and specific. Mozilla Readability's `dataTableDescendants` is `['col','colgroup','tfoot','thead','th']`, and `_cleanConditionally` short-circuits with `if (tag === "table" && isDataTable(node)) return false`. So `th` is literally what saves a table from boilerplate deletion. HTML-AAM then maps it to columnheader or rowheader in the tree agents read. Two caveats keep it at B. `th` is sufficient but not necessary: the same function also classifies by size, roughly ten or more cells, so the deletion risk is concentrated in small tables. And `scope` specifically is a weaker signal than `th`, which is why the audit does not weight the two alike.

**Evidence:** Source-level: Readability's dataTableDescendants = ['col','colgroup','tfoot','thead','th'], with caption and summary as additional data-table markers, and _cleanConditionally short-circuits with 'if (tag === "table" && isDataTable(node)) return false' [mozilla-readability-source]. HTML-AAM maps th to the columnheader or rowheader roles [w3c-html-aam], over the WAI-ARIA 1.2 role set [w3c-wai-aria-1-2]. trafilatura keeps tables by default via include_tables, and renders them as markdown under include_formatting [trafilatura-corefunctions]. Markdown table syntax itself requires a header row, so a th-less table converts to a header-less or arbitrarily-headed markdown table. browser-use exposes the row, cell and gridcell roles as addressable [browser-use-clickable-elements].

**Counter-evidence:** Two real caveats. First, th is sufficient but not necessary in Readability: the same function also classifies by size (roughly ≥10 cells, or ≥10 rows and ≥4 columns), so a large th-less table survives anyway — the deletion risk is concentrated in small tables. Second, the `scope` attribute is a weaker signal than `th`, and should be graded C on its own. None of the extractors examined — Readability, trafilatura, htmldate — reads @scope, and no agent harness doc mentions it. scope matters for the HTML header-association algorithm, and for screen readers. It reaches agents only indirectly, through the a11y tree on complex multi-level tables. Caption adoption is tiny (1.6% of desktop sites [web-almanac-2025-accessibility]) so caption should be advisory, not required. Recommend scoring th/thead presence, and treating scope and caption as informative sub-checks.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
