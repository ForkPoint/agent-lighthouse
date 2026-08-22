---
audit: content-extraction/section-headings
audit_id: "6.7"
category: content-extraction
source_file: packages/core/src/audits/content-extraction/section-headings.ts
slug: section-headings
review_verdict: fix
severity: medium
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
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

**Mechanism:** Real h1–h6 elements (as opposed to visually-styled div/span/p pseudo-headings) are the boundary markers that heading-aware chunkers and accessibility-tree serializers use to segment a page: LangChain's HTMLHeaderTextSplitter/HTMLSectionSplitter split on header tags and attach the enclosing header chain as chunk metadata, Readability scores h2–h6 and uses a lone h1 to recover the article title, and a11y snapshots emit heading nodes with an explicit level. If a page has no true heading elements, these consumers produce either one undifferentiated blob (no heading metadata to attach) or fall back to guessing (HTMLSectionSplitter infers sections from font size).

**Evidence:** Documented consumer behaviour on the RAG side: LangChain's splitter docs state it operates on <h1>,<h2>,<h3> and 'adds metadata for each header "relevant" to any given chunk', with the stated goal of 'keeping related text grouped (more or less) semantically and preserving context-rich information encoded in document structures' [langchain-html-splitters]. On the agent side, HTML-AAM maps h1–h6 to the heading role with aria-level [w3c-html-aam], and Playwright MCP snapshots explicitly include 'headings with levels' [playwright-mcp-snapshots]; Anthropic's read_page returns the same tree [anthropic-browser-use-tool]. Extraction-side: Readability's DEFAULT_TAGS_TO_SCORE is 'section,h2,h3,h4,h5,h6,p,td,pre' and _getArticleTitle prefers the single h1 when <title> is ambiguous [mozilla-readability-source]. Cloudflare's markdown conversion maps headings to '##', costing ~3 tokens vs 12-15 for the HTML form [cloudflare-markdown-for-agents]. Baseline: 59% of mobile sites pass the ordered-headings audit [web-almanac-2025-accessibility].

**Counter-evidence:** The falsifiable claim that survives is 'headings must exist and be real elements'. The stricter claim audited by sequential-headings — that levels must never skip (h2→h4) — has no documented consumer: every splitter and snapshot cited tolerates skipped levels and simply records whatever level it finds; no vendor doc or study shows a measured penalty for skipped levels in LLM parsing. Google states outright that 'there are no additional requirements to appear in AI Overviews or AI Mode, nor other special optimizations necessary' [google-ai-features-docs], so no AI-search vendor endorses heading structure as an extraction or ranking requirement. LangChain is a library used by site owners' own pipelines, not a public crawler of third-party sites — treat it as mechanism evidence, not proof that ChatGPT chunks your page this way.
**Consumers:** LangChain HTMLHeaderTextSplitter / HTMLSectionSplitter, Playwright MCP browser_snapshot, Chrome DevTools MCP take_snapshot, Anthropic browser use / Claude-in-Chrome read_page, Mozilla Readability (Firefox Reader Mode and derived reader pipelines), Cloudflare Markdown for Agents · **Recommended tier:** scored

**Sources:** [Split HTML — LangChain text splitter integrations](https://docs.langchain.com/oss/python/integrations/splitters/split_html) · [Snapshots — Playwright MCP](https://playwright.dev/mcp/snapshots) · [Browser use tool (browser_toolset_20260801)](https://platform.claude.com/docs/en/agents-and-tools/tool-use/browser-use-tool) · [HTML Accessibility API Mappings 1.0](https://www.w3.org/TR/html-aam-1.0/) · [mozilla/readability Readability.js source](https://raw.githubusercontent.com/mozilla/readability/main/Readability.js) · [Introducing Markdown for Agents](https://blog.cloudflare.com/markdown-for-agents/) · [Web Almanac 2025 — Accessibility chapter](https://almanac.httparchive.org/en/2025/accessibility) · [AI features and your website — Google Search Central](https://developers.google.com/search/docs/appearance/ai-features)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
