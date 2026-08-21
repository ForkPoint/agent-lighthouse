---
audit: semantic-html/definition-elements
audit_id: "6.13"
category: semantic-html
source_file: packages/core/src/audits/semantic-html/definition-elements.ts
slug: definition-elements
review_verdict: merge
severity: low
evidence_grade: B
disposition: "merge (approved 2026-08-21)"
reviewed: 2026-08-21
---

# definition-elements (`6.13`)

> semantic-html · source `definition-elements.ts` · review verdict **merge** · evidence grade **B** · disposition: **merge (approved 2026-08-21)**

## What it checks

AI agents use <dfn> and <dl> elements to extract term-definition pairs for "what is X?" queries. Semantic definition markup makes your glossary terms and key concepts directly extractable as AI-generated answer snippets.

## Code review findings (2026-08-20, 11-agent pass)

Duplicate signal and falsy on its own. It passes when '$('dfn').length > 0 || $('dl').length > 0' on any page — and audit 6.8 (semantic-lists) already counts <dl> in its own OR chain, so a single Shopify product-spec <dl> passes both audits simultaneously for the same markup. Neither <dl> nor <dfn> presence tells you anything about whether the site's glossary terms are extractable; <dl> is far more often used for key/value product specs than for definitions, so the pass is usually earned for the wrong reason. Warning a site for having no glossary is not actionable.

**Required fix:** Fold the <dl>/<dfn> detection into the semantic-lists audit (6.8) as one 'semantic grouping elements' dimension, and drop the standalone warn-if-absent verdict. If a definitions signal is genuinely wanted, make it conditional: only evaluate on pages that actually contain term/definition patterns (a glossary heading, DefinedTerm/DefinedTermSet JSON-LD, or repeated 'X is …' constructs), and check that <dt> and <dd> are paired.

**False-positive risks:**
- '$('dfn').length > 0 || $('dl').length > 0' with pagesWithDefinitions > 0 — one <dl> anywhere in the crawl passes.
- <dl> used for product specs, metadata rows, or footer link groups (common in Shopify/WooCommerce themes) passes a check about definitions.
- A <dl> with no <dt>/<dd> children passes.
- Warns every site that legitimately has no glossary — unactionable.
- applicablePageTypes ['content'] gates the run but the loop counts all pages.
- Same markup satisfies 6.8 and 6.13, double-counting one incidental element toward the category score.

**Test gaps:**
- No product-spec <dl> fixture (passes for the wrong reason).
- No malformed <dl> (no dt/dd) fixture.
- No test of the 6.8 double-credit interaction.
- No multi-page crawl.

**Overlaps with:** `6.8`, `6.6`, `6.12`

## Evidence

### Signal: Semantic lists and tables versus div soup — grade B (semantic-dom-a11y)

**Mechanism:** Content marked with ul/ol/li and table/tr/th/td survives HTML→markdown conversion and accessibility-tree serialization as discrete list items and rows/columns with preserved item and cell boundaries; the same content built from nested divs collapses into undelimited running prose, so an LLM must re-infer where one item or row ends and the next begins, and cell-to-header association is lost entirely.

**Evidence:** HTML-AAM makes lists and tables first-class in the tree that agents read: table→table, th→columnheader/rowheader, with list/listitem roles for ul/ol/li [w3c-html-aam]; Playwright's snapshot contents explicitly enumerate 'lists' and table structures [playwright-mcp-snapshots]. browser-use treats role='row'/'cell'/'gridcell' as interactive targets [browser-use-clickable-elements]. On the extraction side trafilatura ships include_tables enabled by default and include_formatting renders structure 'as markdown for text formats' [trafilatura-corefunctions], and Readability applies a dedicated list-aware threshold (listLength / innerText.length > 0.9) so genuinely list-shaped ul/ol survive _cleanConditionally while div stacks of links do not [mozilla-readability-source]. Cloudflare's markdown pipeline is the mass-market version of the same conversion, delivering an 80% token reduction while keeping headings, lists and tables [cloudflare-markdown-for-agents].

**Counter-evidence:** No vendor doc and no study isolates the effect of list/table markup on LLM answer accuracy — the mechanism is well documented but the magnitude is not measured anywhere I could verify. ARIA is an accepted substitute: a div grid carrying role='table'/'row'/'cell' maps to the same accessibility tree nodes, so 'div soup' with correct roles is not penalised by a11y-tree consumers, and an audit that only looks for literal <table>/<ul> tags will produce false positives. Conversely raw-HTML consumers (which the observation-reduction study shows strong models sometimes prefer [observation-reduction-paper]) see the div tags either way. Definition lists (dl/dt/dd) in particular have no documented agent consumer beyond generic role mapping.
**Consumers:** trafilatura, Mozilla Readability, Cloudflare Markdown for Agents, Playwright MCP snapshot, Anthropic read_page, browser-use · **Recommended tier:** scored

**Sources:** [HTML Accessibility API Mappings 1.0](https://www.w3.org/TR/html-aam-1.0/) · [Snapshots — Playwright MCP](https://playwright.dev/mcp/snapshots) · [browser-use ClickableElementDetector source](https://raw.githubusercontent.com/browser-use/browser-use/main/browser_use/dom/serializer/clickable_elements.py) · [trafilatura core functions documentation](https://trafilatura.readthedocs.io/en/latest/corefunctions.html) · [mozilla/readability Readability.js source](https://raw.githubusercontent.com/mozilla/readability/main/Readability.js) · [Introducing Markdown for Agents](https://blog.cloudflare.com/markdown-for-agents/) · [Read More, Think More: Revisiting Observation Reduction for Web Agents](https://arxiv.org/abs/2604.01535)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
