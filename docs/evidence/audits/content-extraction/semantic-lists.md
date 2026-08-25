---
audit: content-extraction/semantic-lists
category: content-extraction
source_file: packages/core/src/audits/content-extraction/semantic-lists.ts
slug: semantic-lists
evidence_grade: B
disposition: "merged 2026-08-22 (Plan 4, Task 8) — absorbs definition-elements (6.13) and numbered-steps (9.6)"
reviewed: 2026-08-22
recommended_tier: scored
consumers:
  - trafilatura
  - Mozilla Readability
  - Cloudflare Markdown for Agents
  - Playwright MCP snapshot
  - Anthropic read_page
  - browser-use
signals:
  - name: Semantic lists and tables versus div soup
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
  - mozilla-readability-source
---

# semantic-lists (`6.8`, `6.13`, `9.6`)

> content-extraction · source `semantic-lists.ts` · merged list-markup audit, absorbs definition-elements (6.13) and numbered-steps (9.6) · evidence grade **B** · tier **scored** (weight 0.6)

## What it checks

One audit over every list-shaped block of content: is it marked up as a list, or is it a div stack, a broken `<dl>`, or a run of paragraphs that start with "1.", "2.", "3."?

| State | Result |
| :--- | :--- |
| no list-shaped content anywhere (and no pages scanned counts as this) | `na` |
| every content list uses `<ul>`/`<ol>`/`<dl>` markup | `pass` |
| at least half of the content lists are semantic | `warn`, priority `medium` |
| most content lists are div stacks or numbered prose | `fail`, priority `medium` |

Navigation, breadcrumb, pagination, tab, carousel and table-of-contents lists are excluded from both sides of the ratio — by region (`nav`/`header`/`footer`/`aside`, the matching ARIA roles), by class name, and by `BreadcrumbList`/`SiteNavigationElement` microdata. `<dl>` counts as a semantic list only with a paired `<dt>`/`<dd>`; `<ol>` with ≥3 items is additionally reported as a step list; `<dfn>` is reported as a definition element.

## Code review findings (2026-08-20, 11-agent pass)

The description promises to catch 'content formatted as styled divs instead of semantic lists', but the code never looks at a single div: 'const hasLists = $('ul').length > 0 || $('ol').length > 0 || $('dl').length > 0'. Every site on the web has a <ul> in its navigation, so this passes essentially 100% of real sites — including the exact sites whose feature lists and step-by-step content are all div-based, which is the failure mode it claims to detect. It is a green light that means nothing, which is worse than no audit because the user reads it as 'my lists are fine'.

**Required fix:** Actually detect pseudo-lists: find parents with 3+ sibling children that share a class and each contain short text or a leading bullet/number character ('•', '-', '1.'), and are not inside nav/header/footer; report the ratio of semantic lists to (semantic + pseudo) lists. Exclude nav/header/footer <ul> from the 'has semantic lists' numerator so navigation menus cannot satisfy the check. If that detector is not built, delete the audit rather than ship a check that cannot fail.

**False-positive risks:**
- Any navigation menu's <ul> satisfies the check — near-universal vacuous pass, including on sites made entirely of div-lists.
- The stated failure mode (styled divs used as lists) is never tested for; the audit and its description do not describe the same check.
- Empty ctx.pages → 'allPass = pagesWithSemanticLists === ctx.pages.length' → 0 === 0 → pass.
- A single <dl> emitted by a Shopify product-spec block satisfies the check, and also satisfies audit 6.13 — one incidental element passes two audits.
- CSR SPAs with no server-rendered list markup fail even though the rendered page is list-rich.

**Test gaps:**
- No fixture with div-based pseudo-lists — the audit's own stated subject is untested.
- No fixture where the only <ul> is in <nav> (the near-universal vacuous pass).
- No empty-ctx.pages test.
- No test distinguishing a content list from a nav list.

**Overlaps with:** `6.13` (now absorbed here), `9.6` (now absorbed here)

## Evidence

### Signal: Semantic lists and tables versus div soup — grade B (semantic-dom-a11y)

**Mechanism:** Content marked with ul/ol/li and table/tr/th/td survives HTML-to-markdown conversion and accessibility-tree serialization as discrete list items, rows and columns, with item and cell boundaries preserved. The same content built from nested divs collapses into undelimited running prose. An LLM must then re-infer where one item or row ends and the next begins, and cell-to-header association is lost entirely.

**Grade: B** — The mechanism is documented at the standard level: HTML-AAM maps `table` to table and `th` to columnheader or rowheader, lists carry list and listitem roles, Playwright's snapshot contents enumerate lists and table structures, and browser-use treats `role='row'`/`'cell'`/`'gridcell'` as interactive. What is missing for an A is magnitude: no vendor document and no study isolates the effect of list and table markup on answer accuracy. ARIA is also an accepted substitute — a div grid carrying the right roles reaches the same accessibility tree — so "div soup" is not automatically a defect.

**Evidence:** HTML-AAM makes lists and tables first-class in the tree that agents read: table→table, th→columnheader/rowheader, with list/listitem roles for ul/ol/li [w3c-html-aam]; Playwright's snapshot contents explicitly enumerate 'lists' and table structures [playwright-mcp-snapshots]. browser-use treats role='row'/'cell'/'gridcell' as interactive targets [browser-use-clickable-elements]. On the extraction side trafilatura ships include_tables enabled by default and include_formatting renders structure 'as markdown for text formats' [trafilatura-corefunctions], and Readability applies a dedicated list-aware threshold (listLength / innerText.length > 0.9) so genuinely list-shaped ul/ol survive _cleanConditionally while div stacks of links do not [mozilla-readability-source]. Cloudflare's markdown pipeline is the mass-market version of the same conversion, delivering an 80% token reduction while keeping headings, lists and tables [cloudflare-markdown-for-agents].

**Counter-evidence:** No vendor doc and no study isolates the effect of list/table markup on LLM answer accuracy — the mechanism is well documented but the magnitude is not measured anywhere I could verify. ARIA is an accepted substitute: a div grid carrying role='table'/'row'/'cell' maps to the same accessibility tree nodes, so 'div soup' with correct roles is not penalised by a11y-tree consumers, and an audit that only looks for literal <table>/<ul> tags will produce false positives. Conversely raw-HTML consumers (which the observation-reduction study shows strong models sometimes prefer [observation-reduction-paper]) see the div tags either way. Definition lists (dl/dt/dd) in particular have no documented agent consumer beyond generic role mapping.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
- 2026-08-21 — approved: 6.13 merges away into 6.8 (§5).
- 2026-08-22 — merged (Plan 4, Task 8), and 9.6 folded here as a late addition on its own grading; registry 154 → 152 for this fold.

## The merge (Plan 4, Task 8, 2026-08-22)

Three audits read the same tags for the same reason and graded on one shared evidence signal (*Semantic lists and tables versus div soup*, grade B). 9.6's grading states the consequence outright: *"this signal is not independent: it rests on the same evidence as `semantic-html/semantic-lists` (already grade B) … Scoring both audits double-counts one mechanism."* 6.13's required fix says the same about `<dl>`: *"Fold the `<dl>`/`<dfn>` detection into the semantic-lists audit (6.8) as one 'semantic grouping elements' dimension, and drop the standalone warn-if-absent verdict."* Both land here, and with them 6.8's own required fix.

**The audit finally looks at divs.** Its description always promised to catch "content formatted as styled divs instead of semantic lists", while the code was `$('ul').length > 0 || $('ol').length > 0 || $('dl').length > 0` — satisfied by the `<ul>` in every site's navigation, so it passed essentially 100% of real sites *including* the div-soup sites it exists to catch. The check is now a ratio of semantic content lists to (semantic + pseudo) lists, where a pseudo-list is ≥3 sibling elements that share a class and each hold one item's worth of text (≤200 characters), or ≥3 same-tag siblings whose text opens with a bullet or a step number. Only the **outermost** match in a subtree counts — a card grid whose cards are themselves stacks of same-class children is one pseudo-list, not one per card — and the table and select families (`table`/`thead`/`tbody`/`tr`/`td`/`th`, `select`/`optgroup`/`datalist`) are never read as containers of a pseudo-list, because their repeated children are already structured markup.

**Chrome is excluded from both sides.** Navigation, breadcrumb and pagination lists no longer earn credit, which is what made the old check unfailable — and, from 9.6's side, what made it fire on nothing: *"Breadcrumbs are the canonical `<ol>` … Any Shopify/WooCommerce/Next-commerce page therefore passes with 'Found 1 ordered list(s)' and zero step-by-step content."* Exclusion is by region (`nav`, `header`, `footer`, `aside` and the matching ARIA roles), by class name, and by `BreadcrumbList`/`SiteNavigationElement` microdata.

**A site with no lists is `na`, not a pass and not a failure.** The old code computed `allPass = pagesWithSemanticLists === ctx.pages.length`, so an empty crawl passed 0 === 0; 9.6 meanwhile *failed* a site with no ordered lists and told it to "convert any step-by-step or procedural content from paragraphs to `<ol>`" — advice to invent content, as its dossier notes. Neither outcome survives.

### Absorbed evidence — definition-elements (6.13)

6.13's dossier is kept verbatim at [merged/content-extraction/definition-elements.md](../../merged/content-extraction/definition-elements.md) (grade **B**, the same shared signal, whose counter-evidence explicitly says "Definition lists (dl/dt/dd) in particular have no documented agent consumer beyond generic role mapping"). Its central defect was double credit: `$('dfn').length > 0 || $('dl').length > 0` passed on one `<dl>` anywhere in the crawl, *and* 6.8 counted the same `<dl>` in its own OR chain, so a single Shopify product-spec block satisfied two scored audits at once.

Here `<dl>` is one dimension of the list ratio rather than an audit: it counts as a semantic list only when it actually pairs `<dt>` with `<dd>` (a `<dl>` full of bare divs is grouping markup that groups nothing, and counts as a pseudo-list), `<dfn>` is reported in the found string, and the standalone "no glossary" warning — unactionable for any site that legitimately has none — is gone.

### Absorbed evidence — numbered-steps (9.6), a late fold

9.6's dossier is kept verbatim at [merged/answer-readiness/numbered-steps.md](../../merged/answer-readiness/numbered-steps.md) (grade **B**). It is the one audit in this task whose v1 map row was a plain `move`, not a `merge-away`: the fold was decided during Plan 4 on the strength of its own grading, and `migration-map.json` carries a `note` on the 9.6 row recording exactly that.

Its evidence is the shared list-preservation mechanism plus GEO-SFE's measured "structured formats (lists, tables) demonstrate 43% higher extraction accuracy than equivalent prose" — a figure that covers lists and tables together and cannot separate `<ol>` from `<ul>`. Its stated mechanism, meanwhile, is refuted: Google's HowTo rich result is "no longer shown in search results, on both desktop and mobile devices" (removed 14 September 2023), so the "how-to answer snippet" the audit was named for no longer exists.

What survives is the procedural half of the required fix. An `<ol>` outside chrome with ≥3 items is reported as a step list, and the false negative 9.6 named — steps written as `<p>1. …</p><p>2. …</p>` — is now detected as a pseudo-list, which is the only place in the merged audit where prose can *lower* the score. What does not survive is the standalone verdict: the absence of step content is no longer a failure, because "this site has no how-to content" is not a defect.

### Grade decision: stays **B**, tier `scored`, weight 0.6

All three audits carry grade **B** off the same signal, so nothing here is a stronger proven path and the grade does not move: **B**, `tier: scored`, `weightForGrade('B', 'scored')` = **0.6**. The merge's effect on scoring is to stop charging three times for one mechanism — the exact double-count 9.6's counter-evidence names — and to make the one remaining charge fail when it should. `scoreDisplayMode` moves from `binary`/`ternary` per-audit to `ternary` on the survivor, matching its three-state ratio.

### Deviations

- **`applicablePageTypes` stays unset** (6.13 and 9.6 both declared `['content']`). Both dossiers record that the declaration was cosmetic — the loops ran over `ctx.pages` anyway — and the merged audit deliberately reads every crawled page, since a div-soup product page is as much of a defect as a div-soup article.
- **The pseudo-list detector is heuristic and deliberately conservative, but it is not proof against a false failure.** It requires ≥3 siblings and either a shared class with short text or a leading bullet/number, so a 2-item div list and a grid of long-form cards are invisible to it, and it errs toward under-reporting. Two rules bound the over-count: only the outermost match in a subtree is counted, so a nested card grid cannot multiply into one defect per card; and the table and select families are skipped, so a data table is never reported as a list that should have been a `<ul>`. What remains is a genuine residual risk in the other direction: a repeated short-text card or tile layout that is a legitimate component and not a list at all still counts once against the ratio, and on a page with no semantic list of its own that is enough to fail. The bound is one count per layout, not zero.
- **ARIA-substituted structure is not credited.** The shared counter-evidence notes that a div carrying `role="list"`/`role="listitem"` maps to the same accessibility-tree nodes; the merged audit does not treat those roles as semantic markup, because the markdown/extraction consumers in the same evidence (trafilatura, Readability, Cloudflare's converter) read tags, not roles.
- **Definition *quality* is not judged.** 6.13's optional fix suggested gating on glossary intent (a glossary heading, `DefinedTerm` JSON-LD, repeated "X is …" constructs). That is not implemented: `<dl>` pairing is checked, its subject matter is not.
