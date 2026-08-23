---
audit: content-extraction/fake-headings
audit_id: "6.20"
category: content-extraction
source_file: packages/core/src/audits/content-extraction/fake-headings.ts
slug: fake-headings
review_verdict: fix
severity: high
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# fake-headings (`6.20`)

> semantic-html · source `fake-headings.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

## What it checks

AI agents chunk and outline page content by reading real <h1>–<h6> tags. When a page styles a <div>, <span>, <p>, or <b> to look like a heading (large text, bold weight, "heading" classes) instead of using a semantic heading element, that text is invisible to the agent\'s document outline — sections cannot be navigated, summarized, or cited correctly. This audit is distinct from the sequential-heading check (6.2): 6.2 verifies that real headings appear in the right order, while this audit catches content that impersonates headings without using heading tags at all. Replace styled generic elements with the appropriate <h1>–<h6> level.

## Code review findings (2026-08-20, 11-agent pass)

Best idea in the category, wrecked by the detection regex. FAKE_HEADING_CLASS = /(text-(xl|2xl|3xl|4xl|5xl)|font-(bold|semibold|extrabold)|heading|headline)/i is an unanchored substring match against Tailwind's most common utilities. I verified it matches 'text-xl text-gray-600' (a lead paragraph), 'price font-bold' (a price), 'md:text-2xl' (a responsive variant), and 'subheading'. Any element under 120 chars carrying those classes and not inside nav/footer/button/a is reported as a fake heading — and the fail threshold is only 5 across the ENTIRE crawl, so any Tailwind site of more than a couple of pages fails automatically. At the same time it misses 'section-title' and 'card-title' (verified false) — the single most common heading-impersonator class names — and every non-English convention ('titulo', 'ueberschrift') and Bootstrap's 'fw-bold'. It is simultaneously over- and under-inclusive.

**Required fix:** Stop inferring from class names. Require corroborating structure before flagging: the element must be a direct child of a content container, be followed by sibling prose or a list, and sit in a section that contains no real heading — i.e. flag only where a heading is structurally missing, not merely where bold text exists. Anchor any class matching to whole tokens (/(^|\s|:)(text-(xl|\dxl)|font-(bold|semibold|extrabold))(\s|$)/) and add 'title' to the vocabulary. Extend EXCLUDED_ANCESTORS well beyond 'nav, footer, button, a' to include header, aside, label, form, table, figcaption, summary, dialog, [role=navigation], [role=banner], [aria-hidden=true]. Make the fail threshold per-page and density-relative rather than an absolute 5 across the crawl.

**False-positive risks:**
- Verified: 'text-xl text-gray-600' on a short lead paragraph matches FAKE_HEADING_CLASS → flagged, though it is body copy.
- Verified: 'price font-bold' on a <span> containing '$49' matches → a price is reported as a fake heading.
- Verified: 'md:text-2xl' matches — responsive variants are treated as heading evidence.
- EXCLUDED_ANCESTORS is only 'nav, footer, button, a': a site logo in <header><div class="font-bold">Acme</div></header>, a <label><span class="font-bold">Email</span></label>, a bold table cell span, and a <figcaption class="font-bold"> are all flagged.
- 'if (found.length >= 5)' counts across ALL pages, so a 10-page Tailwind site accumulates dozens of hits and fails regardless of quality — the verdict is driven by crawl size and CSS framework, not by missing structure.
- Verified false negatives: 'section-title' and 'card-title' do NOT match, and neither does Bootstrap's 'fw-bold' — the most common real impersonators pass.
- English-only class vocabulary ('heading', 'headline'): German/Spanish/French design systems ('ueberschrift', 'titulo', 'titre') are never detected.
- Inline-style detection only parses px ('font-size\s*:\s*(\d+(?:\.\d+)?)px'), so rem, em, and clamp() sizes are missed entirely.
- font-weight:bold on a <b>/<strong> used for genuine emphasis is flagged as a fake heading.
- CSS-file-driven styling (the normal case outside utility frameworks) is invisible, so the audit effectively only fires on Tailwind-class sites — a framework-specific penalty.

**Test gaps:**
- No Tailwind lead-paragraph fixture ('<p class="text-xl text-gray-600">short intro</p>') — the dominant false positive is untested.
- No price / stat / badge fixture with font-bold.
- No <header> logo, <label>, <table>, or <figcaption> fixture (all missing from EXCLUDED_ANCESTORS).
- No 'section-title' / 'card-title' fixture — the false negatives are untested.
- No non-English class-name fixture.
- No rem/em/clamp inline-style fixture.
- The multi-page test ('counts fake headings across multiple pages') asserts the crawl-size-driven fail as correct rather than questioning it.
- No realistic full-page Tailwind fixture showing how many hits a normal marketing page produces.

**Overlaps with:** `6.2`, `6.7`, `6.1`

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
