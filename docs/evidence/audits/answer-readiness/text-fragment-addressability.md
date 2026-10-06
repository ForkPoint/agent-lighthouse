---
audit: answer-readiness/text-fragment-addressability
category: answer-readiness
source_file: packages/core/src/audits/answer-readiness/text-fragment-addressability.ts
slug: text-fragment-addressability
evidence_grade: A
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-22"
reviewed: 2026-08-20
graduated: 2026-08-22
sources:
  - S12
  - S2
  - S3
  - S4
---

# Text-Fragment Citation Addressability

> Shipped in v2. Evidence grade **A** · scored tier · unique · implementation: `static-fetch`

## What it checks

Determines whether a citing surface can construct a working `#:~:text=` deep link to the page's actual answer sentences. Hard-fails on the documented `Document-Policy: force-load-at-top` opt-out header. It then simulates the spec's matching algorithm over the parsed DOM, to prove three things about each candidate answer span. The span is contained in a single block-level element. It is unambiguous, or disambiguable with a same-block prefix or suffix. And it is free of characters that break normalization. Outputs the working fragment URLs as a fix artifact.

## Claimed mechanism (falsifiable)

Google Search auto-generates text-fragment URLs to land users on the exact featured-snippet text (S12), and the spec requires each of prefix/start/end/suffix to match within a single block-level element (S2, S3). When an answer sentence is fragmented across block boundaries, or the header opt-out is set, the fragment silently fails and the link degrades to page-top (S3). Falsifiable and directly testable: take the citing surface's own generated URL, load it, and observe whether the browser scrolls and highlights. Two failure classes are binary and deterministic — the opt-out header, and a start string that straddles two blocks.

## Evidence

- **[Text fragments](https://web.dev/articles/text-fragments)** — Google / web.dev (vendor-doc, URL verified 2026-08-20)
  - Confirms a shipped answer-surface consumer: "Clicking a featured snippet takes the user directly to the featured snippet text on the source web page. This works thanks to automatically created Text Fragments URLs." Support: Chrome 89+, Edge 89+, Firefox 131+, Safari 18.2+. Restates the boundary rule: "Each of prefix-, start, end, and -suffix can only match text within a single block-level element, but full start,end ranges can span multiple blocks." Opt-out header: Document-Policy: force-load-at-top.
- **[Playwright: Auto-waiting / Actionability checks](https://playwright.dev/docs/actionability)** — Microsoft (vendor-doc, URL verified 2026-08-20)
  - Before click, check, fill and selectOption, Playwright enforces five checks. Visible: a non-empty bounding box, and not visibility:hidden. Stable: the same bounding box over 2 animation frames. Receives Events: the element is the hit target at the action point, so overlays cause failure. Enabled: not [disabled] or aria-disabled. Editable: not readonly or aria-readonly. Fill requires visible+enabled+editable. This is the exact gate every Playwright-based agent (Playwright-MCP, browser-use, most CUA harnesses) passes through, so each check is a directly testable site-side failure cause.
- **[MCP Specification 2026-07-28 — Versioning and Compatibility](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - 'There is no negotiation handshake.' Terminology: Modern = 2026-07-28+ (per-request _meta); Legacy = 2025-11-25 and earlier (initialize handshake). Unsupported version MUST return error code -32022 with data.supported[] and data.requested. Verbatim compatibility matrix: Modern client + Legacy server = fails. Legacy client + Modern server = fails. Only dual-era implementations bridge. Extensions negotiated via capabilities.extensions map with mandatory reverse-DNS prefix.
- **[MCP Specification 2026-07-28 — Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - tools/list result set MUST NOT vary per-connection or as a side effect of other requests (MAY vary by authorization). Servers SHOULD return tools in deterministic order — rationale given verbatim: enables client caching and 'improves LLM prompt cache hit rates'. inputSchema MUST be a valid JSON Schema object (not null); defaults to JSON Schema 2020-12. Tool names SHOULD be 1-128 chars, case-sensitive, only [A-Za-z0-9_.-], unique within a server. Full x-mcp-header constraint list including static-reachability rule (chain of only `properties` keys; never through items/oneOf/anyOf/allOf/not/if/then/else/$ref). Clients MUST exclude violating tools from tools/list. If outputSchema present, servers MUST conform. Clients MUST treat annotations as untrusted.

## Competitor coverage

No SEO or agent-readiness tool audits text-fragment constructibility. Lighthouse's agentic category does not touch fragment directives. `Document-Policy: force-load-at-top` is essentially unaudited anywhere — sites set it via CDN security templates without knowing it kills snippet deep-links. Screaming Frog reports response headers but has no rule for this one and no fragment simulation.

## Implementation sketch

Static fetch (headless only for the JS-injection variant). 1) Read response headers; a `Document-Policy` value containing `force-load-at-top` is an immediate hard fail — note in the report that Document Policy is header-only, so a <meta http-equiv> is not a valid workaround or a valid detection site. 2) Build candidate answer spans: first sentence after each h2/h3, every <dd>, and every JSON-LD FAQPage acceptedAnswer.text that also occurs in the HTML. 3) Implement the block-boundary rule: assign each text node a nearest block ancestor using a display-block element list (p, div, li, td, th, h1-h6, section, article, blockquote, dd, dt, figcaption, pre, details, summary, main, aside, header, footer). A span is addressable only if its whitespace-normalized text lies within one block ancestor. 4) Scan the span for normalization hazards: U+00AD soft hyphen, U+200B/200C/200D zero-width, entity-encoded smart quotes that differ from the rendered glyph. 5) Ambiguity: if the normalized span occurs more than once in the document, require a prefix or suffix that also lives in the same block; if none exists, mark unambiguously-unaddressable. 6) Emit the percentage of answer spans that yield a valid fragment, plus the generated `#:~:text=` URLs so the user can click-test them. 7) Roadmap headless variant: re-run against the post-JS DOM to catch answers injected after load and ::before/::after-injected text, which the on-load matcher cannot see.

## Example failure

A CDN-managed site sends `Document-Policy: force-load-at-top` from a hardening template. Every AI and Search deep link into its documentation lands at the top of a 6,000-word page instead of the cited sentence. Second class. A spec page renders 'Maximum payload size is' in a <p>, and '10 MB' in an adjacent <span class="value"> inside its own <div>. No single-block start string covers the sentence. No fragment can address the one fact the page exists to state.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Implementation deviations

- **Block containment is decided over leaf blocks.** Every element in the spec's
  block-level list that contains no other block-level element is treated as one
  block; a span is addressable only when some leaf block's normalized text
  contains it whole. This is the spec's rule expressed over the parsed DOM,
  without a layout engine, so `display` overrides in CSS are not consulted.
- **Ambiguity is counted over the same leaf-block texts**, including repeats
  inside one block. A repeated span is addressable only through same-block
  context: a prefix when the block has text before the span, otherwise a suffix.
  Emitted URLs use at most five words of context.
- **Term encoding** percent-encodes `-` and `,` inside terms so they cannot be
  read as the fragment's own delimiters.
- Spans over 300 characters are emitted in the `start,end` form (first and last
  five words) rather than whole.
- **`Document-Policy` is read from the response header only.** A
  `<meta http-equiv="Document-Policy">` is explicitly not treated as a signal,
  and the finding says so, because Document Policy is header-only: the meta form
  neither sets the policy nor proves it is set.

### Heading spans must be sentences (2026-10-06)

The sketch's span is "the first sentence after each h2/h3". The audit took the text of whatever followed the heading and, finding no sentence terminator, used all of it. On a large retail site that turned a grid of 28 product tiles into one "answer" crossing every tile's block. It also turned a one-word button repeated under every tile into an ambiguous answer. Neither is a sentence, and both were reported as unaddressable.

A heading-derived span now follows four rules. A heading that follows a heading introduces no span. A following element with no block-level descendant contributes its first sentence. A wrapper with block-level descendants contributes the sentence its leaf blocks finish within three blocks. A sentence split across sibling paragraphs stays a candidate and still fails, which is the failure the block rule describes. A wrapper that finishes no sentence there is a grid, carousel or menu and is skipped. Spans under three words are labels and are skipped. `dd` and FAQPage answers are unchanged.

Verdicts that moved in the real-page corpus: `aljazeera-com-article` fail → na; `barclays-co-uk-current-accounts`, `gov-uk-vehicle-tax` and `react-dev-usestate` fail → warn; `cdc-gov-flu-about`, `discourse-meta-topic`, `kubernetes-docs-pods`, `stripe-com-pricing` and `walmart-com-wall-200` fail → pass. Every dropped candidate was a menu list, a tile or topic grid, a heading or a short label.

### Text is grouped by its nearest block ancestor (2026-10-06)

Block containment was decided over leaf blocks only. A block holding both a
block child and bare text yielded no block for the bare text. On a small
marketing site, each feature card was `<li><h3>…</h3><span>answer</span></li>`.
The answer sat in the `li`, the `li` was not a leaf, and every answer was
reported as crossing a block boundary.

The audit now does the walk step 3 of the sketch describes. Each text node
belongs to its nearest block ancestor, and the run of text nodes that share
one is a block, broken at every block-level child. A leaf block is one run.
The `li` above yields two runs, the heading's and the answer's. This replaces
the leaf-block deviation above and closes the first Deferred item below.

Two further rules came with it:

- **The matcher searches rendered text only.** The spec skips text that is
  not rendered. A subtree the markup hides (`hidden`, inline `display:none` or
  `visibility:hidden`, a closed `<dialog>`, `<template>`) yields no heading
  candidate and does not count toward ambiguity. `hidden="until-found"` and
  `aria-hidden` content stay searchable: find-in-page reveals the first, and
  the second is still rendered. A declared FAQPage answer that sits only in
  hidden text now fails with that reason, not with "crosses a block boundary".
- **A card title is not the start of its description.** When a block that
  ends no sentence is followed by one that opens with a capital letter, the
  first was a label, and the sentence starts at the second. A sentence split
  across sibling blocks continues in lower case and still fails.

Verdicts that moved in the real-page corpus: `allbirds-com-collection` fail →
warn (a hazard warning remains); `bbc-co-uk-article`, `canada-ca-income-tax`
and `hiutdenim-co-uk` fail → pass; `irs-gov-form-1040`, `otto-de-category` and
`tattly-com-shell` fail → na, whose only candidates sat in hidden menus,
flyouts or a search panel; `stripe-com-pricing` pass → fail, whose three
FAQPage answers are only in `display:none` accordion panels. That last move
corrects a false pass.

### Inline declaration order (2026-10-06)

The shared visibility helper resolves duplicate inline `display` and
`visibility` declarations before deciding whether text is hidden. The last
declaration at the winning `!important` priority wins. Thus
`display:none;display:block` keeps an answer searchable, while an earlier
`display:none!important` still hides it from a later plain declaration.
This does not add stylesheet specificity or block-layout computation.

## Deferred

- The headless variant — re-running the matcher against the post-JS DOM to catch
  answers injected after load and `::before`/`::after` text — stays a roadmap
  item.
- Entity-encoded smart quotes are flagged as a hazard by codepoint; comparing
  the encoded source against the rendered glyph needs the raw byte offsets the
  parser does not retain.
- Heading spans are still collected from the element after an `h2`/`h3` and its leaf blocks. Bare text beside block children inside that element, such as an alert `div` holding an `h4` and bare text, is matched correctly now but is not taken as the span.
- CSS `display` overrides are still not consulted. A `span` styled `display:block` is treated as inline. The headless variant would resolve it.
- A list after a heading is not split into one candidate per item. A list that finishes no sentence within three items is skipped.
