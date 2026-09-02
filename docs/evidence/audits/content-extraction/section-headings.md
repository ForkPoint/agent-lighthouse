---
audit: content-extraction/section-headings
category: content-extraction
source_file: packages/core/src/audits/content-extraction/section-headings.ts
slug: section-headings
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

# section-headings (`6.7`)

> semantic-html · source `section-headings.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

## What it checks

AI agents use section headings to build a topic map of your page for retrieval-augmented generation (RAG). Unlabeled sections are opaque to AI systems that chunk content by semantic boundaries, reducing the quality of retrieved context for answer generation.

## Code review findings (2026-08-20, 11-agent pass)

Two defects make it close to vacuous, plus one that penalizes correct markup. The heading test is 'find('> h1..h6').length > 0 || find('h1..h6').length > 0' — the second clause is a strict superset of the first, so the first is dead code and ANY heading at ANY depth counts, including a heading inside a nested <article>, <aside>, or footer that has nothing to do with labelling the section. Almost every real <section> therefore counts as labeled. Separately, when a site uses zero <section> elements it gets a warn telling it to adopt <section> — but <div> + <h2> conveys identical structure to every extractor, and a <section> without an accessible name is not even exposed as a region, so the advice is cargo cult.

**Required fix:** Replace the two-clause test with a real first-child check: the first element child of the section must be h1–h6, or the section must carry a non-blank aria-label / an aria-labelledby whose target id actually exists in the document. Trim aria-label before accepting it ('!!$(el).attr('aria-label')' currently accepts ' '). Change the zero-sections branch from warn to notApplicable() — absence of <section> is not a defect.

**False-positive risks:**

- '|| $(el).find('h1, h2, h3, h4, h5, h6').length > 0' matches a heading nested arbitrarily deep — e.g. <section><div class="cards"><article><h3>…</h3></article></div></section> counts as labeled although the section itself has no accessible name.
- aria-labelledby pointing at a nonexistent or removed id is accepted ('!!$(el).attr('aria-labelledby')') — no id resolution.
- aria-label=" " (whitespace) is truthy and accepted.
- Page builders (Elementor, Divi, Webflow, Tailwind templates) emit <section> purely as layout wrappers; those get counted in the denominator and drag a well-structured page to fail.
- Zero-<section> sites are warned into adopting an element that provides no benefit unless named — actively misleading guidance.
- Sections pooled across all pages with no per-page/per-URL attribution in `found`, so '7/20 labeled sections' is not actionable.

**Test gaps:**

- No fixture with a deeply nested heading inside an unnamed section (the dominant false pass).
- No aria-labelledby-with-missing-target fixture.
- No whitespace-only aria-label fixture.
- No page-builder layout fixture (dozens of wrapper <section>s).
- No multi-page crawl.

**Overlaps with:** `6.2`, `6.20`

## Evidence

### Signal: Heading hierarchy (h1–h6) for LLM parsing and chunking — grade B (semantic-dom-a11y)

**Mechanism:** Real h1–h6 elements are the boundary markers that heading-aware chunkers and accessibility-tree serializers use to segment a page; visually-styled div, span or p pseudo-headings are not. LangChain's HTMLHeaderTextSplitter and HTMLSectionSplitter split on header tags, and attach the enclosing header chain as chunk metadata. Readability scores h2–h6, and uses a lone h1 to recover the article title. a11y snapshots emit heading nodes with an explicit level. If a page has no true heading elements, these consumers produce either one undifferentiated blob (no heading metadata to attach) or fall back to guessing (HTMLSectionSplitter infers sections from font size).

**Grade: B** — Documented consumer behaviour, on the retrieval side rather than the vendor side. LangChain's `HTMLHeaderTextSplitter` operates on `<h1>`, `<h2>` and `<h3>` and "adds metadata for each header 'relevant' to any given chunk", with the stated goal of "keeping related text grouped (more or less) semantically". A named library acting on the element is real evidence; a library in someone's pipeline is not a vendor statement, and no measurement attaches a magnitude — hence B, not A. The claim the grade covers is the narrow one this audit makes: sections need real heading elements to be segmented on.

**Evidence:** Consumer behaviour on the RAG side is documented. LangChain's splitter docs state that it operates on <h1>, <h2> and <h3>, and 'adds metadata for each header "relevant" to any given chunk'. The stated goal is 'keeping related text grouped (more or less) semantically and preserving context-rich information encoded in document structures' [langchain-html-splitters]. On the agent side, HTML-AAM maps h1–h6 to the heading role with aria-level [w3c-html-aam], and Playwright MCP snapshots explicitly include 'headings with levels' [playwright-mcp-snapshots]; Anthropic's read_page returns the same tree [anthropic-browser-use-tool]. On the extraction side, Readability scores section, h2 to h6, p, td and pre when it looks for the article body, and prefers the single h1 as the title when <title> is ambiguous [mozilla-readability-source]. Cloudflare's markdown conversion maps headings to '##', costing ~3 tokens vs 12-15 for the HTML form [cloudflare-markdown-for-agents]. Baseline: 59% of mobile sites pass the ordered-headings audit [web-almanac-2025-accessibility].

**Counter-evidence:** The falsifiable claim that survives is 'headings must exist and be real elements'. The stricter claim audited by sequential-headings is that levels must never skip, as in h2 to h4. That claim has no documented consumer. Every splitter and snapshot cited tolerates skipped levels, and simply records whatever level it finds. No vendor doc or study shows a measured penalty for skipped levels in LLM parsing. Google states outright that 'there are no additional requirements to appear in AI Overviews or AI Mode, nor other special optimizations necessary' [google-ai-features-docs], so no AI-search vendor endorses heading structure as an extraction or ranking requirement. LangChain is a library used by site owners' own pipelines, not a public crawler of third-party sites — treat it as mechanism evidence, not proof that ChatGPT chunks your page this way.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
