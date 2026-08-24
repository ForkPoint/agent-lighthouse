---
audit: content-extraction/sequential-headings
audit_id: "6.2"
category: content-extraction
source_file: packages/core/src/audits/content-extraction/sequential-headings.ts
slug: sequential-headings
review_verdict: fix
severity: medium
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# sequential-headings (`6.2`)

> semantic-html · source `sequential-headings.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

## What it checks

AI systems build content outlines from headings to understand document structure. Skipped levels (e.g., h1 to h3 without h2) break the hierarchy, causing agents to misinterpret section nesting and produce inaccurate content summaries. Fix heading levels to follow a sequential order.

## Code review findings (2026-08-20, 11-agent pass)

Uses flat document order over every heading in the DOM — 'const prev = headings[i-1].level; const curr = headings[i].level; if (curr > prev + 1)' — with no notion of sectioning roots. A footer that opens with <h4>Contact</h4> after the main content's last <h2> is reported as an 'h2 -> h4 skip', which is one of the most common layouts on the web. Compounding this, the warn/fail boundary depends on crawl size rather than site quality: 'majorityPass = pagesWithSkips <= Math.floor(totalPages / 2)' means a single-page scan with one skip FAILS (floor(1/2)=0) while a two-page scan with the same one skip only WARNS.

**Required fix:** Restrict extraction to the main content root (main, else article, else body minus nav/footer/aside/dialog/[role=navigation]/[role=contentinfo]) and evaluate skips per sectioning root rather than in flat document order. Replace the Math.floor(totalPages/2) rule with a page-count-independent ratio (e.g. warn under 50% of pages affected, fail at/above), and make the single-page case behave identically to the multi-page case.

**False-positive risks:**
- Footer/nav/sidebar headings are included — extractHeadings($) selects 'h1, h2, h3, h4, h5, h6' document-wide. Footers using h4/h5 column titles after main-content h2s produce a spurious skip on nearly every WordPress/Shopify theme.
- Flat document order ignores tree nesting: an <aside> containing an h3 placed after an <h1> is flagged h1->h3 even though the aside is a separate sectioning root.
- Crawl-size-dependent severity: identical site quality yields fail at 1 page and warn at 2 pages ('pagesWithSkips <= Math.floor(totalPages / 2)').
- The no-headings branch says 'Page has fewer than 2 headings' (singular) but hasEnoughHeadings is computed globally across all pages — the message misattributes a site-wide condition to one page.
- CSR SPAs yield 0-1 server-rendered headings → permanent warn.
- Widgets injected server-side (Trustpilot, chat, cookie consent) frequently carry their own heading levels.

**Test gaps:**
- No footer-h4-after-h2 fixture — the dominant real-world false positive is entirely untested.
- No test that the same skip yields different verdicts at 1 page vs 2 pages (the Math.floor asymmetry is untested).
- No nested-sectioning fixture (aside/article with independent heading trees).
- No test with headings inside nav/footer.
- No >5-page crawl to exercise the ratio boundary.

**Overlaps with:** `6.1`, `6.7`, `6.20`

## Evidence

### Signal: Heading hierarchy (h1–h6) for LLM parsing and chunking — grade B (semantic-dom-a11y)

**Mechanism:** Real h1–h6 elements (as opposed to visually-styled div/span/p pseudo-headings) are the boundary markers that heading-aware chunkers and accessibility-tree serializers use to segment a page: LangChain's HTMLHeaderTextSplitter/HTMLSectionSplitter split on header tags and attach the enclosing header chain as chunk metadata, Readability scores h2–h6 and uses a lone h1 to recover the article title, and a11y snapshots emit heading nodes with an explicit level. If a page has no true heading elements, these consumers produce either one undifferentiated blob (no heading metadata to attach) or fall back to guessing (HTMLSectionSplitter infers sections from font size).

**Evidence:** Documented consumer behaviour on the RAG side: LangChain's splitter docs state it operates on <h1>,<h2>,<h3> and 'adds metadata for each header "relevant" to any given chunk', with the stated goal of 'keeping related text grouped (more or less) semantically and preserving context-rich information encoded in document structures' [langchain-html-splitters]. On the agent side, HTML-AAM maps h1–h6 to the heading role with aria-level [w3c-html-aam], and Playwright MCP snapshots explicitly include 'headings with levels' [playwright-mcp-snapshots]; Anthropic's read_page returns the same tree [anthropic-browser-use-tool]. Extraction-side: Readability's DEFAULT_TAGS_TO_SCORE is 'section,h2,h3,h4,h5,h6,p,td,pre' and _getArticleTitle prefers the single h1 when <title> is ambiguous [mozilla-readability-source]. Cloudflare's markdown conversion maps headings to '##', costing ~3 tokens vs 12-15 for the HTML form [cloudflare-markdown-for-agents]. Baseline: 59% of mobile sites pass the ordered-headings audit [web-almanac-2025-accessibility].

**Counter-evidence:** The falsifiable claim that survives is 'headings must exist and be real elements'. The stricter claim audited by sequential-headings — that levels must never skip (h2→h4) — has no documented consumer: every splitter and snapshot cited tolerates skipped levels and simply records whatever level it finds; no vendor doc or study shows a measured penalty for skipped levels in LLM parsing. Google states outright that 'there are no additional requirements to appear in AI Overviews or AI Mode, nor other special optimizations necessary' [google-ai-features-docs], so no AI-search vendor endorses heading structure as an extraction or ranking requirement. LangChain is a library used by site owners' own pipelines, not a public crawler of third-party sites — treat it as mechanism evidence, not proof that ChatGPT chunks your page this way.
**Consumers:** LangChain HTMLHeaderTextSplitter / HTMLSectionSplitter, Playwright MCP browser_snapshot, Chrome DevTools MCP take_snapshot, Anthropic browser use / Claude-in-Chrome read_page, Mozilla Readability (Firefox Reader Mode and derived reader pipelines), Cloudflare Markdown for Agents · **Recommended tier:** scored

**Sources:** [Split HTML — LangChain text splitter integrations](https://docs.langchain.com/oss/python/integrations/splitters/split_html) (verified 2026-08-20) · [Snapshots — Playwright MCP](https://playwright.dev/mcp/snapshots) (verified 2026-08-20) · [Browser use tool (browser_toolset_20260801)](https://platform.claude.com/docs/en/agents-and-tools/tool-use/browser-use-tool) (verified 2026-08-20) · [HTML Accessibility API Mappings 1.0](https://www.w3.org/TR/html-aam-1.0/) (verified 2026-08-20) · [mozilla/readability Readability.js source](https://raw.githubusercontent.com/mozilla/readability/main/Readability.js) (verified 2026-08-20) · [Introducing Markdown for Agents](https://blog.cloudflare.com/markdown-for-agents/) (verified 2026-08-20) · [Web Almanac 2025 — Accessibility chapter](https://almanac.httparchive.org/en/2025/accessibility) (verified 2026-08-20) · [AI features and your website — Google Search Central](https://developers.google.com/search/docs/appearance/ai-features) (verified 2026-08-20)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
