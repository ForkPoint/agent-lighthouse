---
audit: content-extraction/data-tables
audit_id: "6.9"
category: content-extraction
source_file: packages/core/src/audits/content-extraction/data-tables.ts
slug: data-tables
review_verdict: fix
severity: medium
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# data-tables (`6.9`)

> semantic-html · source `data-tables.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

## What it checks

AI agents use <thead> and <th> elements to understand column headers and interpret table data correctly. Without proper structure, agents cannot map cell values to their column meanings, leading to garbled data extraction in AI-generated comparisons and summaries.

## Code review findings (2026-08-20, 11-agent pass)

Correct core logic (I verified parse5 auto-inserts <tbody>, so the '<table><tr><th>' pattern is handled), but three problems. The zero-table branch returns 'this.pass('No data tables found — check not applicable')' — a scored 1.0 for absence, when audit.ts explicitly provides notApplicable() for this. The counters descend into nested tables ('$(el).find('th')'), so a layout table wrapping a data table inherits its headers and is scored proper. And a layout table (still common in legacy/govt/email-style pages) is counted in the denominator, dragging pages to fail for a table that carries no data to label.

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

**Mechanism:** Content marked with ul/ol/li and table/tr/th/td survives HTML→markdown conversion and accessibility-tree serialization as discrete list items and rows/columns with preserved item and cell boundaries; the same content built from nested divs collapses into undelimited running prose, so an LLM must re-infer where one item or row ends and the next begins, and cell-to-header association is lost entirely.

**Evidence:** HTML-AAM makes lists and tables first-class in the tree that agents read: table→table, th→columnheader/rowheader, with list/listitem roles for ul/ol/li [w3c-html-aam]; Playwright's snapshot contents explicitly enumerate 'lists' and table structures [playwright-mcp-snapshots]. browser-use treats role='row'/'cell'/'gridcell' as interactive targets [browser-use-clickable-elements]. On the extraction side trafilatura ships include_tables enabled by default and include_formatting renders structure 'as markdown for text formats' [trafilatura-corefunctions], and Readability applies a dedicated list-aware threshold (listLength / innerText.length > 0.9) so genuinely list-shaped ul/ol survive _cleanConditionally while div stacks of links do not [mozilla-readability-source]. Cloudflare's markdown pipeline is the mass-market version of the same conversion, delivering an 80% token reduction while keeping headings, lists and tables [cloudflare-markdown-for-agents].

**Counter-evidence:** No vendor doc and no study isolates the effect of list/table markup on LLM answer accuracy — the mechanism is well documented but the magnitude is not measured anywhere I could verify. ARIA is an accepted substitute: a div grid carrying role='table'/'row'/'cell' maps to the same accessibility tree nodes, so 'div soup' with correct roles is not penalised by a11y-tree consumers, and an audit that only looks for literal <table>/<ul> tags will produce false positives. Conversely raw-HTML consumers (which the observation-reduction study shows strong models sometimes prefer [observation-reduction-paper]) see the div tags either way. Definition lists (dl/dt/dd) in particular have no documented agent consumer beyond generic role mapping.
**Consumers:** trafilatura, Mozilla Readability, Cloudflare Markdown for Agents, Playwright MCP snapshot, Anthropic read_page, browser-use · **Recommended tier:** scored

**Sources:** [HTML Accessibility API Mappings 1.0](https://www.w3.org/TR/html-aam-1.0/) (verified 2026-08-20) · [Snapshots — Playwright MCP](https://playwright.dev/mcp/snapshots) (verified 2026-08-20) · [browser-use ClickableElementDetector source](https://raw.githubusercontent.com/browser-use/browser-use/main/browser_use/dom/serializer/clickable_elements.py) (verified 2026-08-20) · [trafilatura core functions documentation](https://trafilatura.readthedocs.io/en/latest/corefunctions.html) (verified 2026-08-20) · [mozilla/readability Readability.js source](https://raw.githubusercontent.com/mozilla/readability/main/Readability.js) (verified 2026-08-20) · [Introducing Markdown for Agents](https://blog.cloudflare.com/markdown-for-agents/) (verified 2026-08-20) · [Read More, Think More: Revisiting Observation Reduction for Web Agents](https://arxiv.org/abs/2604.01535) (verified 2026-08-20)

### Signal: Data tables with th (and scope) header semantics — grade B (semantic-dom-a11y)

**Mechanism:** The presence of <th>/<thead> is what causes an extractor to classify a table as a DATA table rather than a layout table, and data-table classification is what exempts it from boilerplate deletion. Concretely, in Mozilla Readability a table containing none of col/colgroup/tfoot/thead/th and no caption/summary is treated as layout and becomes eligible for removal by _cleanConditionally, so a th-less pricing or spec table can be deleted outright before the content reaches the model. In the accessibility tree, th additionally resolves to columnheader/rowheader so header-to-cell association survives.

**Evidence:** Source-level: Readability's dataTableDescendants = ['col','colgroup','tfoot','thead','th'], with caption and summary as additional data-table markers, and _cleanConditionally short-circuits with 'if (tag === "table" && isDataTable(node)) return false' [mozilla-readability-source]. HTML-AAM maps th to columnheader or rowheader roles [w3c-html-aam] over the WAI-ARIA 1.2 role set [w3c-wai-aria-1-2]. trafilatura keeps tables by default via include_tables and renders them as markdown under include_formatting [trafilatura-corefunctions]; markdown table syntax itself requires a header row, so a th-less table converts to a header-less or arbitrarily-headed markdown table. browser-use exposes role='row'/'cell'/'gridcell' as addressable [browser-use-clickable-elements].

**Counter-evidence:** Two real caveats. First, th is sufficient but not necessary in Readability: the same function also classifies by size (roughly ≥10 cells, or ≥10 rows and ≥4 columns), so a large th-less table survives anyway — the deletion risk is concentrated in small tables. Second, the `scope` attribute specifically is a weaker signal than `th` and should be graded C on its own: none of the extractors examined (Readability, trafilatura, htmldate) reads @scope, and no agent harness doc mentions it; scope matters for the HTML header-association algorithm and screen readers, and only indirectly for agents via the a11y tree on complex multi-level tables. Caption adoption is tiny (1.6% of desktop sites [web-almanac-2025-accessibility]) so caption should be advisory, not required. Recommend scoring th/thead presence, and treating scope and caption as informative sub-checks.
**Consumers:** Mozilla Readability, trafilatura, Playwright MCP / Chrome DevTools MCP snapshots, Anthropic read_page, browser-use · **Recommended tier:** scored

**Sources:** [mozilla/readability Readability.js source](https://raw.githubusercontent.com/mozilla/readability/main/Readability.js) (verified 2026-08-20) · [HTML Accessibility API Mappings 1.0](https://www.w3.org/TR/html-aam-1.0/) (verified 2026-08-20) · [Accessible Rich Internet Applications (WAI-ARIA) 1.2](https://www.w3.org/TR/wai-aria-1.2/) (verified 2026-08-20) · [trafilatura core functions documentation](https://trafilatura.readthedocs.io/en/latest/corefunctions.html) (verified 2026-08-20) · [browser-use ClickableElementDetector source](https://raw.githubusercontent.com/browser-use/browser-use/main/browser_use/dom/serializer/clickable_elements.py) (verified 2026-08-20) · [Web Almanac 2025 — Accessibility chapter](https://almanac.httparchive.org/en/2025/accessibility) (verified 2026-08-20)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
