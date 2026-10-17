---
audit: content-extraction/fake-headings
category: content-extraction
source_file: packages/core/src/audits/content-extraction/fake-headings.ts
slug: fake-headings
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: scored
consumers:
  - LangChain HTMLHeaderTextSplitter / HTMLSectionSplitter
  - Playwright MCP browser_snapshot
  - Chrome DevTools MCP take_snapshot
  - Anthropic browser use / Claude-in-Chrome read_page
  - Mozilla Readability (Firefox Reader Mode and derived reader pipelines)
  - Cloudflare Markdown for Agents
signals:
  - name: Heading hierarchy (h1–h6) for LLM parsing and chunking
    grade: B
    domain: semantic-dom-a11y
sources:
  - langchain-html-splitters
  - playwright-mcp-snapshots
  - anthropic-browser-use-tool
  - w3c-html-aam
  - readability-src
  - cloudflare-markdown-for-agents
  - web-almanac-2025-accessibility
  - google-ai-features-trust
  - mozilla-readability-source
  - google-ai-features-docs
---

# fake-headings (`6.20`)

> semantic-html · source `fake-headings.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

## What it checks

AI agents chunk and outline page content by reading real <h1>–<h6> tags. A page can style a <div>, <span>, <p> or <b> to look like a heading — large text, bold weight, "heading" classes — instead of using a semantic heading element. That text is then invisible to the agent's document outline. Sections cannot be navigated, summarized or cited correctly. This audit is distinct from the sequential-heading check (6.2). 6.2 verifies that real headings appear in the right order. This audit catches content that impersonates headings without using heading tags at all. Replace styled generic elements with the appropriate <h1>–<h6> level.

## Evidence

### Signal: Heading hierarchy (h1–h6) for LLM parsing and chunking — grade B (semantic-dom-a11y)

**Mechanism:** Real h1–h6 elements are the boundary markers that heading-aware chunkers and accessibility-tree serializers use to segment a page; visually-styled div, span or p pseudo-headings are not. LangChain's HTMLHeaderTextSplitter and HTMLSectionSplitter split on header tags, and attach the enclosing header chain as chunk metadata. Readability scores h2–h6, and uses a lone h1 to recover the article title. a11y snapshots emit heading nodes with an explicit level. If a page has no true heading elements, these consumers produce either one undifferentiated blob (no heading metadata to attach) or fall back to guessing (HTMLSectionSplitter infers sections from font size).

**Grade: B** — Documented consumer behaviour exists on the retrieval side. LangChain's `HTMLHeaderTextSplitter` operates on `<h1>`, `<h2>` and `<h3>`, and "adds metadata for each header 'relevant' to any given chunk". A real heading element is therefore what a chunker segments on, and a styled `<div>` is not. That is a named consumer acting on the element, but the consumer is a library in a pipeline rather than an AI vendor's own documented behaviour, and no measurement attaches a magnitude — grade B. The falsifiable claim that survives is narrow: headings must exist and be real elements. The stricter claim that levels must never skip has no documented consumer at all; every splitter and snapshot cited records whatever level it finds.

**Evidence:** Consumer behaviour on the RAG side is documented. LangChain's splitter docs state that it operates on <h1>, <h2> and <h3>, and 'adds metadata for each header "relevant" to any given chunk'. The stated goal is 'keeping related text grouped (more or less) semantically and preserving context-rich information encoded in document structures' [langchain-html-splitters]. On the agent side, HTML-AAM maps h1–h6 to the heading role with aria-level [w3c-html-aam], and Playwright MCP snapshots explicitly include 'headings with levels' [playwright-mcp-snapshots]; Anthropic's read_page returns the same tree [anthropic-browser-use-tool]. On the extraction side, Readability scores section, h2 to h6, p, td and pre when it looks for the article body, and prefers the single h1 as the title when <title> is ambiguous [mozilla-readability-source]. Cloudflare's markdown conversion maps headings to '##', costing ~3 tokens vs 12-15 for the HTML form [cloudflare-markdown-for-agents]. Baseline: 59% of mobile sites pass the ordered-headings audit [web-almanac-2025-accessibility].

**Counter-evidence:** The falsifiable claim that survives is 'headings must exist and be real elements'. The stricter claim audited by sequential-headings is that levels must never skip, as in h2 to h4. That claim has no documented consumer. Every splitter and snapshot cited tolerates skipped levels, and simply records whatever level it finds. No vendor doc or study shows a measured penalty for skipped levels in LLM parsing. Google states outright that 'there are no additional requirements to appear in AI Overviews or AI Mode, nor other special optimizations necessary' [google-ai-features-docs], so no AI-search vendor endorses heading structure as an extraction or ranking requirement. LangChain is a library used by site owners' own pipelines, not a public crawler of third-party sites — treat it as mechanism evidence, not proof that ChatGPT chunks your page this way.

## Implementation deviations

- 2026-08-28 — the audit declines when the scan holds no response it can
  attribute to this site. It read the heading-like text on the scanned pages,
  and `ctx.pages`/`ctx.rootFiles` carry whatever answered 200 — on a parked
  domain a broker's page from another host, on a walled or throttled origin
  nothing at all. It now consults `scanReadTheSite()` and returns
  `notApplicable` carrying the gate's own reason.
  Verdicts that moved on the five nothing-obtained contract states: walled
  pass → na, throttled pass → na, redirected away pass → na, non-HTML homepage
  pass → na, HTTP 200 bot challenge pass → na. Found by
  `packages/core/src/tests/hostile-state-contract.test.ts`.
- 2026-08-28 — heading-like text is body text, and a JS shell serves none, so
  such a page holds neither fake headings nor real ones to have got right. The
  empty-findings branch now returns `notApplicable` when `scanReadPageText()` is
  false; every reported fake heading still fails as before. Verdict moved on the
  shell contract state: pass → na. Found by
  `packages/core/src/tests/hostile-state-contract.test.ts`.

- 2026-10-06 — three parts of the required fix above now ship. A small
  marketing site failed on seven hits, and none was a missing heading: bold
  statistics (`25,000+`, `4.9 / 5`, `87%`), brand labels in interface chrome,
  and a label inside a hidden dialog.
  - Text made only of figures and punctuation is a value, not a title, and is
    skipped.
  - The excluded ancestors grow to the list the fix names: `header`, `aside`,
    `label`, `figcaption`, `summary`, `dialog`, `[role=dialog]`,
    `[role=navigation]` and `[role=banner]`, beside `nav`, `footer`, `button`
    and `a`.
  - Subtrees the markup hides (`hidden`, `aria-hidden="true"`, inline
    `display:none`, a closed `<dialog>`, `<template>`) are skipped, through the
    shared `hiddenFromReaders()` helper.
  - Bold text inside a `section` or `article` that already has a real heading
    is emphasis within that section. The fix flags only "where a heading is
    structurally missing", so it is skipped.
    Five real-page corpus verdicts moved, every one away from a false hit:
    prices on a plans page (fail → warn; one "Custom" price label remains),
    syntax-highlighted code tokens (fail → pass), menu headlines in a retail
    header (fail → pass), template placeholders (warn → pass), and inline
    `<strong>` emphasis in documentation prose (fail → pass).
    Still open from the required fix: whole-token class matching, the extra
    class vocabulary, and a per-page threshold.
