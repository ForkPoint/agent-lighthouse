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

| State                                                                 | Result                    |
| :-------------------------------------------------------------------- | :------------------------ |
| no list-shaped content anywhere (and no pages scanned counts as this) | `na`                      |
| every content list uses `<ul>`/`<ol>`/`<dl>` markup                   | `pass`                    |
| at least half of the content lists are semantic                       | `warn`, priority `medium` |
| most content lists are div stacks or numbered prose                   | `fail`, priority `medium` |

Navigation, breadcrumb, pagination, tab, carousel and table-of-contents lists are excluded from both sides of the ratio — by region (`nav`/`header`/`footer`/`aside`, the matching ARIA roles), by class name, and by `BreadcrumbList`/`SiteNavigationElement` microdata. `<dl>` counts as a semantic list only with a paired `<dt>`/`<dd>`; `<ol>` with ≥3 items is additionally reported as a step list; `<dfn>` is reported as a definition element.

## Evidence

### Signal: Semantic lists and tables versus div soup — grade B (semantic-dom-a11y)

**Mechanism:** Content marked with ul/ol/li and table/tr/th/td survives HTML-to-markdown conversion and accessibility-tree serialization as discrete list items, rows and columns, with item and cell boundaries preserved. The same content built from nested divs collapses into undelimited running prose. An LLM must then re-infer where one item or row ends and the next begins, and cell-to-header association is lost entirely.

**Grade: B** — The mechanism is documented at the standard level. HTML-AAM maps `table` to table, and `th` to columnheader or rowheader. Lists carry list and listitem roles. Playwright's snapshot contents enumerate lists and table structures, and browser-use treats `role='row'`, `'cell'` and `'gridcell'` as interactive. What is missing for an A is magnitude: no vendor document and no study isolates the effect of list and table markup on answer accuracy. ARIA is also an accepted substitute — a div grid carrying the right roles reaches the same accessibility tree — so "div soup" is not automatically a defect.

**Evidence:** HTML-AAM makes lists and tables first-class in the tree that agents read: table→table, th→columnheader/rowheader, with list/listitem roles for ul/ol/li [w3c-html-aam]; Playwright's snapshot contents explicitly enumerate 'lists' and table structures [playwright-mcp-snapshots]. browser-use treats role='row'/'cell'/'gridcell' as interactive targets [browser-use-clickable-elements]. On the extraction side, trafilatura ships include_tables enabled by default, and include_formatting renders structure 'as markdown for text formats' [trafilatura-corefunctions]. Readability applies a dedicated list-aware threshold: a node survives when more than 90% of its text sits inside list items. Genuinely list-shaped ul and ol therefore survive its cleanup pass while div stacks of links do not [mozilla-readability-source]. Cloudflare's markdown pipeline is the mass-market version of the same conversion, delivering an 80% token reduction while keeping headings, lists and tables [cloudflare-markdown-for-agents].

**Counter-evidence:** No vendor doc and no study isolates the effect of list/table markup on LLM answer accuracy — the mechanism is well documented, but the magnitude is not measured in any source located for this dossier. ARIA is an accepted substitute. A div grid carrying role='table', role='row' and role='cell' maps to the same accessibility tree nodes. 'div soup' with correct roles is therefore not penalised by a11y-tree consumers, and an audit that only looks for literal <table> and <ul> tags will produce false positives. Conversely raw-HTML consumers (which the observation-reduction study shows strong models sometimes prefer [observation-reduction-paper]) see the div tags either way. Definition lists (dl/dt/dd) in particular have no documented agent consumer beyond generic role mapping.

## Implementation deviations

- This audit absorbed `definition-elements` and `numbered-steps`. All three rested on one grade-B signal, so one audit charges for it once. Their records are in [merged/content-extraction/definition-elements.md](../../merged/content-extraction/definition-elements.md) and [merged/answer-readiness/numbered-steps.md](../../merged/answer-readiness/numbered-steps.md).
- The check is a ratio of semantic content lists to semantic plus pseudo-lists. A pseudo-list is 3 or more sibling elements that share a class and hold at most 200 characters each, or 3 or more same-tag siblings opening with a bullet or step number.
- Only the outermost pseudo-list in a subtree counts. The table and select families are never read as pseudo-list containers.
- Chrome is excluded from both sides: `nav`, `header`, `footer`, `aside` and matching ARIA roles, chrome class names, and `BreadcrumbList`/`SiteNavigationElement` microdata.
- Subtrees hidden from readers are skipped through `hiddenFromReaders()`. `kbd` children do not count toward the same-class rule.
- A site with no lists returns `notApplicable`.
- A `<dl>` counts as semantic only when it pairs `<dt>` with `<dd>`. `<dfn>` is reported, not scored. Definition subject matter is not judged.
- An `<ol>` outside chrome with 3 or more items is reported as a step list. Absence of step content is not a failure.
- `applicablePageTypes` is unset. A div-soup product page is as much a defect as a div-soup article.
- ARIA `role="list"`/`role="listitem"` is not credited. The extraction consumers read tags, not roles.
- A repeated short-text card layout that is not a list still counts once against the ratio. On a page with no semantic list, that can fail it.
- Browser snapshots provide serialized markup observations only. The browser assessment is informative with weight 0. Truncated, redacted and still-loading captures produce missing-evidence records rather than verdicts.

## Limits

### Browser snapshot evidence

The snapshot path reuses this audit on each complete, unredacted, non-loading DOM capture that carries readable text. It reports the original static verdict as an unscored browser finding. It does not prove HTTP delivery, computed appearance, a complete accessibility tree, live form state, or action success. The source and page URL accompany every finding. Existing implementation limits still apply.

The individual evidence review and limits appear in [Browser-rendered snapshot assessment](../../../architecture/browser-snapshots.md#supported-audit-inventory). The explicit eligibility record lives in `packages/core/src/snapshot-eligibility.ts`. Original crawler grades, tiers, and weights stay unchanged.
