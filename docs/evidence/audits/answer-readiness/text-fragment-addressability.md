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

## Example failure

A CDN-managed site sends `Document-Policy: force-load-at-top` from a hardening template. Every AI and Search deep link into its documentation lands at the top of a 6,000-word page instead of the cited sentence. Second class. A spec page renders 'Maximum payload size is' in a <p>, and '10 MB' in an adjacent <span class="value"> inside its own <div>. No single-block start string covers the sentence. No fragment can address the one fact the page exists to state.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Implementation deviations

- Each text node belongs to its nearest block ancestor. The run of text nodes sharing one is a block, broken at every block-level child. A span is addressable only when one run contains it whole.
- Block-level means the spec's element list. CSS `display` overrides are not consulted, so no layout engine is needed.
- The matcher searches rendered text only (`notRendered`). `hidden`, inline `display:none` or `visibility:hidden`, a closed `<dialog>` and `<template>` hide text. `hidden="until-found"` and `aria-hidden` content stay searchable. A FAQPage answer found only in hidden text fails with that reason.
- Duplicate inline `display` and `visibility` declarations resolve as a browser would: the last valid one at the winning `!important` priority wins. `visibility` can be set back by a descendant. A value with `var()` never counts as hiding.
- Ambiguity is counted over the same block runs. A repeated span uses same-block context: a prefix when the block has text before the span, otherwise a suffix. Emitted URLs use at most five words of context.
- Terms percent-encode `-` and `,` so they cannot read as the fragment's own delimiters.
- Spans over 300 characters use the `start,end` form, first and last five words.
- A heading that follows a heading introduces no span. A following element with no block descendant gives its first sentence. A wrapper with block descendants gives the sentence its leaf blocks finish within three blocks. A wrapper that finishes none is a grid, carousel or menu and is skipped.
- A block that ends no sentence, followed by one that opens with a capital letter, is a label. The sentence starts at the second block. A sentence split across sibling blocks continues in lower case and still fails.
- Spans under three words are labels and are skipped.
- `Document-Policy` is read from the response header only. A `<meta http-equiv>` neither sets the policy nor proves it is set.

## Deferred

- A headless variant against the post-JS DOM, to catch injected answers and `::before`/`::after` text.
- Entity-encoded smart quotes are flagged by codepoint. Comparing the encoded source with the rendered glyph needs raw byte offsets the parser does not keep.
- Bare text beside block children inside the element after a heading is matched but not taken as the span.
- A list after a heading is not split into one candidate per item.
