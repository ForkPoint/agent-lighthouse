---
audit: content-extraction/sequential-headings
category: content-extraction
source_file: packages/core/src/audits/content-extraction/sequential-headings.ts
slug: sequential-headings
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

# sequential-headings (`6.2`)

> semantic-html · source `sequential-headings.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

## What it checks

AI systems build content outlines from headings to understand document structure. Skipped levels (e.g., h1 to h3 without h2) break the hierarchy, causing agents to misinterpret section nesting and produce inaccurate content summaries. Fix heading levels to follow a sequential order.

## Evidence

### Signal: Heading hierarchy (h1–h6) for LLM parsing and chunking — grade B (semantic-dom-a11y)

**Mechanism:** Real h1–h6 elements are the boundary markers that heading-aware chunkers and accessibility-tree serializers use to segment a page; visually-styled div, span or p pseudo-headings are not. LangChain's HTMLHeaderTextSplitter and HTMLSectionSplitter split on header tags, and attach the enclosing header chain as chunk metadata. Readability scores h2–h6, and uses a lone h1 to recover the article title. a11y snapshots emit heading nodes with an explicit level. If a page has no true heading elements, these consumers produce either one undifferentiated blob (no heading metadata to attach) or fall back to guessing (HTMLSectionSplitter infers sections from font size).

**Grade: B** — The B applies to the well-evidenced half of this signal — that real `h1`–`h6` elements are what heading-aware chunkers such as LangChain's `HTMLHeaderTextSplitter` segment on. It does not extend to the stricter claim this audit checks. No documented consumer cares whether levels skip: every splitter and accessibility-tree snapshot examined tolerates an `h2` followed by an `h4` and simply records the level it finds, and no vendor document or study shows a measurable cost. That gap is why the finding reads as a structure warning rather than a claim about how agents read the page.

**Evidence:** Consumer behaviour on the RAG side is documented. LangChain's splitter docs state that it operates on <h1>, <h2> and <h3>, and 'adds metadata for each header "relevant" to any given chunk'. The stated goal is 'keeping related text grouped (more or less) semantically and preserving context-rich information encoded in document structures' [langchain-html-splitters]. On the agent side, HTML-AAM maps h1–h6 to the heading role with aria-level [w3c-html-aam], and Playwright MCP snapshots explicitly include 'headings with levels' [playwright-mcp-snapshots]; Anthropic's read_page returns the same tree [anthropic-browser-use-tool]. On the extraction side, Readability scores section, h2 to h6, p, td and pre when it looks for the article body, and prefers the single h1 as the title when <title> is ambiguous [mozilla-readability-source]. Cloudflare's markdown conversion maps headings to '##', costing ~3 tokens vs 12-15 for the HTML form [cloudflare-markdown-for-agents]. Baseline: 59% of mobile sites pass the ordered-headings audit [web-almanac-2025-accessibility].

**Counter-evidence:** The falsifiable claim that survives is 'headings must exist and be real elements'. The stricter claim audited here is that levels must never skip, as in h2 to h4. That claim has no documented consumer. Every splitter and snapshot cited tolerates skipped levels, and simply records whatever level it finds. No vendor doc or study shows a measured penalty for skipped levels in LLM parsing. Google states outright that 'there are no additional requirements to appear in AI Overviews or AI Mode, nor other special optimizations necessary' [google-ai-features-docs], so no AI-search vendor endorses heading structure as an extraction or ranking requirement. LangChain is a library used by site owners' own pipelines, not a public crawler of third-party sites — treat it as mechanism evidence, not proof that ChatGPT chunks your page this way.
