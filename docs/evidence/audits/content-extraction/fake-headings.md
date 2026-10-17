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

- With no findings, the audit consults `scanReadPageText()`. A page that served no readable text returns `notApplicable`, not a pass.
- Text made only of figures and punctuation (a statistic, a rating, a price) is a value, not a title, and is skipped.
- Excluded ancestors: `nav`, `footer`, `header`, `aside`, `button`, `a`, `label`, `figcaption`, `summary`, `dialog`, `[role=dialog]`, `[role=navigation]`, `[role=banner]`.
- Subtrees hidden from readers are skipped through the shared `hiddenFromReaders()` helper.
- Bold text inside a `section` or `article` that already has a real heading is emphasis, and is skipped.

## Deferred

- Whole-token class matching. `FAKE_HEADING_CLASS` still matches substrings.
- A wider class vocabulary for heading impersonators.
- A per-page threshold. Five findings across the whole sample fail.
