---
audit: content-extraction/single-h1
category: content-extraction
source_file: packages/core/src/audits/content-extraction/single-h1.ts
slug: single-h1
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

# single-h1 (`6.1`)

> semantic-html · source `single-h1.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

## What it checks

AI agents use the single <h1> as the authoritative title of the page for content indexing and answer generation. Ensure exactly one <h1> per page.

## Code review findings (2026-08-20, 11-agent pass)

Title and description promise 'Single h1 per page' but the code only ever inspects ctx.pages[0] ('const homepage = ctx.pages[0]'), so a 20-page crawl where 19 pages have three h1s each reports a green pass. It also treats zero h1 and five h1 identically (both hard fail, priority high) although zero-h1 is a materially worse problem, and hard-fails the extremely common responsive pattern of duplicate desktop/mobile h1 markup where only one is visible. Signal is real but the audit under-delivers on its own stated scope.

**Required fix:** Loop all ctx.pages like the sibling audits do and report an X/Y ratio with offending URLs. Split the verdict: 0 h1 = fail (high), 2+ h1 = warn (medium) rather than fail. Exclude h1s inside <template>, and inside subtrees hidden via hidden/[aria-hidden=true]/style="display:none" so responsive duplicates are not double-counted.

**False-positive risks:**
- Only the homepage is audited despite the 'per page' title — 'const homepage = ctx.pages[0]; const h1Count = $('h1').length'. Deep-page h1 problems are invisible; users get false reassurance.
- Responsive themes that render a desktop h1 and a mobile h1 (one CSS-hidden) count as 2 → fail, though exactly one is visible and exactly one is in the accessibility tree.
- Cookie banners, off-canvas menus, and modal dialogs injected server-side often carry their own h1 → fail on an otherwise correct page.
- CSR SPAs served as an empty shell have 0 h1 in server HTML → fail, though the rendered page an agentic browser sees has one.
- A WAF/Cloudflare challenge page ('Checking your browser…') typically has 1 h1 → PASS. ctx.wafProtection is never consulted.
- h1 inside <svg><title> is not an issue, but h1 inside <template> IS counted by cheerio and is not rendered.

**Test gaps:**
- No test asserting the homepage-only limitation (a multi-page ctx where page 2 has three h1s still passes) — the bug is invisible to the suite.
- No hidden/responsive duplicate-h1 fixture.
- No h1-inside-<template> or h1-inside-modal fixture.
- No SPA shell or WAF interstitial fixture.
- No non-English page.

**Overlaps with:** `6.2`, `6.20`

## Evidence

### Signal: Heading hierarchy (h1–h6) for LLM parsing and chunking — grade B (semantic-dom-a11y)

**Mechanism:** Real h1–h6 elements are the boundary markers that heading-aware chunkers and accessibility-tree serializers use to segment a page; visually-styled div, span or p pseudo-headings are not. LangChain's HTMLHeaderTextSplitter and HTMLSectionSplitter split on header tags, and attach the enclosing header chain as chunk metadata. Readability scores h2–h6, and uses a lone h1 to recover the article title. a11y snapshots emit heading nodes with an explicit level. If a page has no true heading elements, these consumers produce either one undifferentiated blob (no heading metadata to attach) or fall back to guessing (HTMLSectionSplitter infers sections from font size).

**Grade: B** — The evidence is for real heading elements as chunk boundaries: LangChain's `HTMLHeaderTextSplitter` splits on `<h1>`, `<h2>` and `<h3>` and attaches the enclosing header chain as chunk metadata. That covers the part of this audit which asks for an `h1` to exist and to be a real element. The single-`h1` half is a convention rather than a documented requirement. HTML5 permits several, and no cited splitter or snapshot fails on the second one. The audit therefore reports extra `h1` elements as an ambiguity in the page's top-level label, not as a parsing failure.

**Evidence:** Documented consumer behaviour on the RAG side. LangChain's splitter docs state it operates on <h1>, <h2> and <h3>, and 'adds metadata for each header "relevant" to any given chunk'. The stated goal is 'keeping related text grouped (more or less) semantically and preserving context-rich information encoded in document structures' [langchain-html-splitters]. On the agent side, HTML-AAM maps h1–h6 to the heading role with aria-level [w3c-html-aam]. Playwright MCP snapshots explicitly include 'headings with levels' [playwright-mcp-snapshots], and Anthropic's read_page returns the same tree [anthropic-browser-use-tool]. On the extraction side, Readability's DEFAULT_TAGS_TO_SCORE is 'section,h2,h3,h4,h5,h6,p,td,pre', and _getArticleTitle prefers the single h1 when <title> is ambiguous [mozilla-readability-source]. Cloudflare's markdown conversion maps headings to '##', costing about 3 tokens against 12-15 for the HTML form [cloudflare-markdown-for-agents]. As a baseline, 59% of mobile sites pass the ordered-headings audit [web-almanac-2025-accessibility].

**Counter-evidence:** The falsifiable claim that survives is 'headings must exist and be real elements'. The stricter claim audited by sequential-headings is that levels must never skip, as in h2 to h4. That claim has no documented consumer. Every splitter and snapshot cited tolerates skipped levels, and simply records whatever level it finds. No vendor doc or study shows a measured penalty for skipped levels in LLM parsing. Google states outright that 'there are no additional requirements to appear in AI Overviews or AI Mode, nor other special optimizations necessary' [google-ai-features-docs], so no AI-search vendor endorses heading structure as an extraction or ranking requirement. LangChain is a library used by site owners' own pipelines, not a public crawler of third-party sites — treat it as mechanism evidence, not proof that ChatGPT chunks your page this way.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
