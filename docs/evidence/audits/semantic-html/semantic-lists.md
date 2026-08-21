---
audit: semantic-html/semantic-lists
audit_id: "6.8"
category: semantic-html
source_file: packages/core/src/audits/semantic-html/semantic-lists.ts
slug: semantic-lists
review_verdict: fix
severity: high
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# semantic-lists (`6.8`)

> semantic-html · source `semantic-lists.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

## What it checks

AI agents recognize <ul>, <ol>, and <dl> as structured data lists and extract them as bullet points in generated answers. Content formatted as styled divs instead of semantic lists is invisible to list-extraction algorithms, meaning your feature lists and step-by-step content will not be surfaced as structured answers.

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

**Overlaps with:** `6.13`

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
