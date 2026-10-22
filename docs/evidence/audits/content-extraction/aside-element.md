---
audit: content-extraction/aside-element
category: content-extraction
source_file: packages/core/src/audits/content-extraction/aside-element.ts
slug: aside-element
evidence_grade: B
disposition: "kept — rewritten to a conditional extraction check 2026-08-22 (Plan 4, Task 11)"
reviewed: 2026-10-21
recommended_tier: scored
consumers:
  - trafilatura
  - Mozilla Readability / Firefox Reader Mode
  - Anthropic get_page_text
  - Playwright MCP accessibility snapshot
  - Chrome DevTools MCP take_snapshot
  - Cloudflare Markdown for Agents
signals:
  - name: "Landmark elements (main, nav, header, footer, article, aside) as extraction boundaries"
    grade: A
    domain: semantic-dom-a11y
sources:
  - whatwg-aside
  - trafilatura-xpaths
  - trafilatura-corefunctions
  - readability-src
  - w3c-html-aam
  - w3c-wai-aria-1-2
  - anthropic-browser-use-tool
  - playwright-mcp-snapshots
  - web-almanac-2025-accessibility
  - google-ai-features-trust
  - mozilla-readability-source
  - google-ai-features-docs
---

# aside-element (`6.6`)

> content-extraction · source `aside-element.ts` · evidence grade **B** · tier **scored** (weight 0.6) · rewritten from "any page has an `<aside>`" to a conditional per-page extraction check — see below

## What it checks

The audit selects visible supplementary blocks on every sampled page type. Explicit `<aside>` or `role="complementary"` markup counts as marked. Class/id hints such as sidebar, related links, advertisements and newsletter boxes identify likely unmarked blocks. Pages with neither do not contribute; an empty relevant population returns `notApplicable`.

Navigation and site-level header and footer containers and their subtrees already have separate semantics and do not require complementary markup. A candidate with `role="main"` is primary content. Hidden blocks do not contribute. Generic widget, secondary, callout and pull-quote names alone do not establish that their content can safely be removed.

## Why it matters

Complementary landmarks identify supplementary content for accessibility tools and extraction libraries. A bare container lacks this explicit signal, but class-name and text-density heuristics may still remove it. Missing `<aside>` does not prove extraction failure.

## Evidence

### Signal: Landmark elements (main, nav, header, footer, article, aside) as extraction boundaries — grade A (semantic-dom-a11y)

**Mechanism:** Wrapping primary content in <main> or <article>, and chrome in <nav>, <header>, <footer> or <aside>, changes what boilerplate-removal extractors keep and drop. Content inside landmark containers matching the extractor's body selectors is retained. Subtrees whose element or ARIA role resolves to navigation, banner, contentinfo or complementary are deleted before the text ever reaches the model. On a page built from undifferentiated divs, the same extractors fall back to class/id string heuristics and text-density guesses, so nav and footer text leaks into the extracted body and body text can be discarded.

**Grade: A** — The proof is in the source of the two dominant extractors, not in a claim about them. trafilatura's body selector keeps `article`, `div`, `main` and `section`, and its discard pass deletes navigation, footer and header subtrees outright. Readable, shipping code that acts on the element is documented consumer behaviour, which is the grade-A bar. The grade is about direction, not sufficiency. trafilatura also matches bare divs by id and class, and falls back to justext and readability. Readability gives `<main>` no special boost at all, so a landmark-free page is degraded rather than invisible.

**Evidence:** Both dominant extractors act on the landmark, and the behaviour is readable in their source. trafilatura keeps `article`, `div`, `main` and `section` nodes, and nodes marked as the article body by `itemprop` or `role`. It deletes subtrees whose role is navigation, along with footer and header markers and anything hidden from assistive technology [trafilatura-xpaths]. Its documented fallback ladder tries 'article tags' before dropping back to 'the raw text of the whole page body' [trafilatura-corefunctions]. Mozilla Readability consults ARIA landmark roles directly. Its `UNLIKELY_ROLES` list — menu, menubar, complementary, navigation, alert, alertdialog and dialog — triggers subtree removal. Its candidate scoring penalises footer, header, menu, sidebar, related and social, and rescues article, body, content and main [mozilla-readability-source]. HTML-AAM makes the element→role mapping normative: main→main, nav→navigation, header→banner, footer→contentinfo, article→article, aside→complementary [w3c-html-aam], over WAI-ARIA 1.2's ratified landmark role set [w3c-wai-aria-1-2]. Anthropic's own get_page_text is documented to 'return the page's visible text as plain text, prioritizing the main article content' [anthropic-browser-use-tool], and Playwright snapshots list 'roles and landmarks… contentinfo sections' as snapshot contents [playwright-mcp-snapshots].

**Counter-evidence:** Landmarks are one path among several, not a gate. trafilatura also matches bare divs by id and class, and falls back to justext or readability. Readability gives no special boost to <main> at all, and can extract a landmark-free page perfectly well via text density. So a page with zero landmarks is degraded, not invisible. Adoption is partial — only 40.72% of pages use <main> [web-almanac-2025-accessibility] — which means extractors cannot depend on landmarks and have been tuned to work without them. No AI-search vendor documents landmarks as a requirement, and Google explicitly disclaims special optimizations for AI features [google-ai-features-docs]. Over-nesting also backfires: multiple <main> or a <nav> wrapping real content will actively delete content, so this signal is bidirectional and an audit should penalise misuse as well as absence.

## Limits

Class/id hints remain heuristic. A `sidebar` or `side-bar` name can refer to primary content, so a block with that positional name and purchase signals for one product (an offer or price, a cart form, a quantity field or an add-to-cart button) is treated as a buy box and skipped. Two product cards or two offers mark a rail instead. Role names such as `related` or `promo` stay candidates whatever they hold. Hint words followed by `-tag`, `-badge`, `-label`, `-price`, `-code` or `-icon` name a badge, not a block, and blocks inside a product card or any `<header>` are skipped as part of that card or introduction. Other primary content behind a sidebar name can still produce a finding, so review each finding before changing markup. This audit does not run extraction to prove text contamination, infer layout from CSS, or detect misuse of existing `<aside>` elements. It does not require navigation or other already identified page chrome to gain another landmark.

## How it scores

The existing grade B, scored tier and weight 0.6 remain unchanged. The wider page-type population is a patch-level correction: the consumer path in the dossier never depended on the scanner's page-type label, and the added WHATWG source states the element's definition rather than a new consumer. Explicit extraction behavior supports the signal; heuristic identification of unmarked supplementary content limits the finding. All relevant blocks marked: pass. Marked and unmarked blocks: warn. Only unmarked blocks: fail. No relevant blocks: not applicable. Each nested candidate stack counts once. Reports show at most five unmarked candidates per page.

## Sources

- [WHATWG HTML: aside](https://html.spec.whatwg.org/multipage/sections.html#the-aside-element) (verified 2026-10-21): supplementary content is separate from the surrounding main flow. The definition has no article-only restriction [whatwg-aside].
- [Mozilla Readability source](https://github.com/mozilla/readability/blob/main/Readability.js): removes aside content and also uses class-name heuristics [readability-src].

## Implementation deviations

- Common scope replaces the article/general list. The existing landmark consumer path does not depend on the scanner's page-type label. Runner tests cover all five types with declared and detected provenance, absent features and mixed readable/unread samples.
- Detection is class/id-based. A Tailwind-only or CSS-Modules sidebar produces no candidate, so the page is not evaluated. Geometry-based detection needs a rendered layout the scanner does not have.
- Hidden blocks and site-chrome subtrees do not contribute to either count. Primary `role="main"` candidates are excluded without suppressing separately identified supplementary descendants.
- Ambiguous `widget`, `secondary`, `callout`, `pullquote`, `pull-quote`, `sidenav` and `side-nav` tokens no longer establish a candidate. These names do not prove the content is expendable; valid explicitly marked asides still count.
- Misuse is not penalised. Detecting citable text inside an `<aside>` needs a judgement the audit cannot make, so the guidance states the warning instead.
- The purchase test covers the candidate itself as well as its descendants. A buy box excluded as primary content does not suppress a separate supplementary block nested inside it.
- Candidates inside any `<header>` are skipped. A section header holds introductory content such as the title, date or a promo badge, which is primary. Section footers are still assessed, because they often carry related links.
- The buy-box exemption applies only to positional `sidebar`/`side-bar` names. Inside one buy box, buttons, cart forms and quantity fields repeat legitimately: a sticky copy of "Add to cart", an installment form, mobile and desktop quantity fields. Only repeated product identity, two outermost product cards or two offers, marks a rail. Checkout labels must say only "Checkout" or include "proceed to checkout".
- Badge-shaped class names such as `promo-tag` and blocks inside a product card are not candidates. The captured furniture-retailer homepage previously failed on sale badges inside its product cards; it is now not applicable.

## Deferred

- Distinguish other primary content, such as specifications or author details, from supplementary content when both use a `sidebar` class. Purchase controls are the only primary signal the audit checks.
- Detect rendered geometry or external stylesheet visibility. The shared visibility helper covers DOM attributes and inline styles only.
