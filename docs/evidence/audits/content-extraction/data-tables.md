---
audit: content-extraction/data-tables
category: content-extraction
source_file: packages/core/src/audits/content-extraction/data-tables.ts
slug: data-tables
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: scored
consumers:
  - Mozilla Readability
  - trafilatura
  - Playwright MCP / Chrome DevTools MCP snapshots
  - Anthropic read_page
  - browser-use
signals:
  - name: Semantic lists and tables versus div soup
    grade: B
    domain: semantic-dom-a11y
  - name: Data tables with th (and scope) header semantics
    grade: B
    domain: semantic-dom-a11y
sources:
  - w3c-html-aam
  - playwright-mcp-snapshots
  - browser-use-clickable-elements
  - trafilatura-corefunctions
  - readability-src
  - cloudflare-markdown-for-agents
  - observation-reduction-paper
  - w3c-wai-aria-1-2
  - web-almanac-2025-accessibility
  - mozilla-readability-source
---

# data-tables (`6.9`)

> semantic-html · source `data-tables.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

## What it checks

AI agents use <thead> and <th> elements to understand column headers and interpret table data correctly. Without proper structure, agents cannot map cell values to their column meanings, leading to garbled data extraction in AI-generated comparisons and summaries.

## Code review findings (2026-08-20, 11-agent pass)

Correct core logic (parse5 auto-inserts <tbody>, so the '<table><tr><th>' pattern is handled), but three problems. The zero-table branch returns 'this.pass('No data tables found — check not applicable')' — a scored 1.0 for absence, when audit.ts explicitly provides notApplicable() for this. The counters descend into nested tables ('$(el).find('th')'), so a layout table wrapping a data table inherits its headers and is scored proper. And a layout table (still common in legacy/govt/email-style pages) is counted in the denominator, dragging pages to fail for a table that carries no data to label.

**Required fix:** Swap the zero-table pass() for notApplicable(). Scope the header lookups to the immediate table using ':scope' semantics or by filtering out th/thead whose closest('table') is not this element. Skip probable layout tables (role=presentation/none, or no th anywhere and single row/column) instead of counting them as failures. Include page URLs in `found`.

**False-positive risks:**
- 'if (totalTables === 0) return this.pass(...)' — sites with no tables at all receive a free scored 1.0, inflating the category score.
- '$(el).find('th')' / 'find('thead')' cross nested-table boundaries: an outer layout table containing a proper inner table is credited as properly structured.
- Layout tables and pricing-grid tables are counted in the denominator; there is no role=presentation exclusion.
- Div-based data grids (AG Grid, TanStack Table, role="grid"), which are extremely common in 2026 apps, are invisible — the audit reports 'No data tables found' and passes.
- A single stray <th> inside a layout table makes it 'proper'.
- Tables pooled across pages with no URL attribution.

**Test gaps:**
- No test asserting notApplicable vs pass for the zero-table case (the current test locks in the inflating behavior: expect(result.status).toBe('pass')).
- No nested-table fixture.
- No layout-table / role=presentation fixture.
- No div-based role="grid" fixture.
- No <thead> containing <td> instead of <th> fixture.
- No multi-page crawl.

**Overlaps with:** _none_

## Evidence

### Signal: Semantic lists and tables versus div soup — grade B (semantic-dom-a11y)

**Mechanism:** Content marked with ul/ol/li and table/tr/th/td survives HTML-to-markdown conversion and accessibility-tree serialization as discrete list items, rows and columns, with item and cell boundaries preserved. The same content built from nested divs collapses into undelimited running prose. An LLM must then re-infer where one item or row ends and the next begins, and cell-to-header association is lost entirely.

**Grade: B** — The mechanism is documented at the standard level: HTML-AAM maps `table` to table and `th` to columnheader or rowheader, Playwright's snapshot contents enumerate lists and table structures, and browser-use treats `role='row'`/`'cell'`/`'gridcell'` as interactive. What is missing for an A is magnitude: no vendor document and no study isolates the effect of list and table markup on answer accuracy. ARIA is also an accepted substitute — a div grid carrying the right roles reaches the same accessibility tree — so "div soup" is not automatically a defect.

**Evidence:** HTML-AAM makes lists and tables first-class in the tree that agents read. table maps to table, th to columnheader or rowheader, and ul, ol and li to list and listitem roles [w3c-html-aam]. Playwright's snapshot contents explicitly enumerate 'lists' and table structures [playwright-mcp-snapshots]. browser-use treats role='row'/'cell'/'gridcell' as interactive targets [browser-use-clickable-elements]. On the extraction side, trafilatura ships include_tables enabled by default, and include_formatting renders structure 'as markdown for text formats' [trafilatura-corefunctions]. Readability applies a dedicated list-aware threshold: a node survives when more than 90% of its text sits inside list items. Genuinely list-shaped ul and ol therefore survive its cleanup pass, while div stacks of links do not [mozilla-readability-source]. Cloudflare's markdown pipeline is the mass-market version of the same conversion, delivering an 80% token reduction while keeping headings, lists and tables [cloudflare-markdown-for-agents].

**Counter-evidence:** No vendor doc and no study isolates the effect of list/table markup on LLM answer accuracy — the mechanism is well documented, but the magnitude is not measured in any source located for this dossier. ARIA is an accepted substitute. A div grid carrying role='table', role='row' and role='cell' maps to the same accessibility tree nodes. 'div soup' with correct roles is therefore not penalised by a11y-tree consumers, and an audit that only looks for literal <table> and <ul> tags will produce false positives. Conversely raw-HTML consumers (which the observation-reduction study shows strong models sometimes prefer [observation-reduction-paper]) see the div tags either way. Definition lists (dl/dt/dd) in particular have no documented agent consumer beyond generic role mapping.

### Signal: Data tables with th (and scope) header semantics — grade B (semantic-dom-a11y)

**Mechanism:** The presence of <th> or <thead> is what causes an extractor to classify a table as a data table rather than a layout table, and data-table classification is what exempts it from boilerplate deletion. In Mozilla Readability, a table carrying none of col, colgroup, tfoot, thead or th, and no caption or summary, is treated as layout. Its cleanup pass then becomes free to remove it, so a th-less pricing or spec table can be deleted outright before the content reaches the model. In the accessibility tree, th additionally resolves to columnheader/rowheader so header-to-cell association survives.

**Grade: B** — Specific, and readable in Mozilla Readability's own source. A table counts as a data table when it carries `col`, `colgroup`, `tfoot`, `thead` or `th`. Its `_cleanConditionally` pass then skips that table. `th` is literally what saves a table from boilerplate deletion. Two caveats keep it at B. `th` is sufficient but not necessary: the same function also classifies by size, roughly ten or more cells, so the deletion risk is concentrated in small tables. And `scope` specifically is a weaker signal than `th`, which is why the audit does not weight the two alike.

**Evidence:** Readability classifies a table as a data table when it carries col, colgroup, tfoot, thead or th, or a caption or summary. Its `_cleanConditionally` pass then skips it, and a table with none of those is treated as layout and deleted [mozilla-readability-source]. HTML-AAM maps th to the columnheader or rowheader roles [w3c-html-aam], over the WAI-ARIA 1.2 role set [w3c-wai-aria-1-2]. trafilatura keeps tables by default via include_tables, and renders them as markdown under include_formatting [trafilatura-corefunctions]. Markdown table syntax itself requires a header row, so a th-less table converts to a header-less or arbitrarily-headed markdown table. browser-use exposes the row, cell and gridcell roles as addressable [browser-use-clickable-elements].

**Counter-evidence:** Two real caveats. First, th is sufficient but not necessary in Readability. The same function also classifies by size: roughly 10 or more cells, or 10 or more rows and 4 or more columns. A large th-less table survives anyway, so the deletion risk is concentrated in small tables. Second, the `scope` attribute is a weaker signal than `th`, and should be graded C on its own. None of the extractors examined — Readability, trafilatura, htmldate — reads @scope, and no agent harness doc mentions it. scope matters for the HTML header-association algorithm, and for screen readers. It reaches agents only indirectly, through the a11y tree on complex multi-level tables. Caption adoption is tiny (1.6% of desktop sites [web-almanac-2025-accessibility]) so caption should be advisory, not required. Recommend scoring th/thead presence, and treating scope and caption as informative sub-checks.

## Implementation deviations

- 2026-08-28 — the audit declines when the scan holds no response it can
  attribute to this site. It read the tables on the scanned pages, and
  `ctx.pages`/`ctx.rootFiles` carry whatever answered 200 — on a parked domain
  a broker's page from another host, on a walled or throttled origin nothing
  at all. It now consults `scanReadTheSite()` and returns `notApplicable`
  carrying the gate's own reason.
  Verdicts that moved on the four nothing-obtained contract states: walled
  pass → na, throttled pass → na, redirected away pass → na, non-HTML homepage
  pass → na. Found by
  `packages/core/src/tests/hostile-state-contract.test.ts`.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
