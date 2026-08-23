---
audit: content-extraction/content-depth
audit_id: "6.14"
category: content-extraction
source_file: packages/core/src/audits/content-extraction/content-depth.ts
slug: content-depth
review_verdict: fix
severity: high
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# content-depth (`6.14`)

> semantic-html · source `content-depth.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

## What it checks

AI RAG systems need sufficient content depth to generate accurate, detailed answers. Pages with fewer than 300 words provide too little context for meaningful vector embeddings, causing your content to rank poorly in retrieval and be excluded from AI-generated responses.

## Code review findings (2026-08-20, 11-agent pass)

Three independent sources of wrong verdicts. (1) getWordCount is 'text.split(/\s+/)' — Chinese, Japanese, Thai, and Khmer do not space-delimit words, so a 4,000-character Chinese article counts as a handful of tokens and every CJK site fails unconditionally. (2) getMainContentText scopes to <main> when present, else <body>: a site WITHOUT <main> gets its nav, sidebar, and footer counted as content and passes, while a site WITH <main> (which audit 6.3 marks high-priority) is measured on content alone and fails — adopting the sibling audit's fix makes this audit worse. (3) Empty ctx.pages returns pass ('allPass = 0 === 0'), and content-depth.test.ts:32 asserts that behavior as correct, so a fully blocked crawl reports sufficient depth.

**Required fix:** Count graphemes/characters for scripts without word delimiters (detect via Unicode ranges or the html lang attribute) and set a character-based threshold for those, or use Intl.Segmenter with the page's locale instead of splitting on whitespace. Measure both sides consistently: strip nav/header/footer/aside from the body fallback so <main> and non-<main> sites are compared on the same basis. Guard ctx.pages.length === 0 with notApplicable() and delete the test that asserts the false pass. Exempt page types where brevity is correct (contact, pricing, product).

**False-positive risks:**
- 'text.split(/\s+/).filter(Boolean).length' — guaranteed false fail for every Chinese/Japanese/Thai site regardless of actual content volume.
- getMainContentText falls back to <body>, so nav+footer boilerplate inflates the count on sites without <main>; the same site scores lower after correctly adopting <main> per audit 6.3.
- Empty ctx.pages → pass, codified by the test suite.
- CSR SPAs report near-zero words from the server HTML → fail although the hydrated page is long.
- A WAF challenge page or a soft-404 is short → fail attributed to the site's content strategy; ctx.wafProtection is never checked.
- Legitimately short pages (contact, pricing, login, product with spec tables) are counted in the denominator with no page-type exemption.
- Boilerplate-heavy pages game the check: a 400-word cookie banner plus footer passes a content-free page when <main> is absent.

**Test gaps:**
- No non-English fixture at all — the CJK failure is entirely uncovered.
- No fixture comparing a with-<main> page against the same content without <main> (the 6.3 contradiction is untested).
- The empty-pages test asserts the wrong expectation ('passes when there are no pages').
- No boundary test at exactly 300 words (the code is 'count > 300', so 300 exactly fails — undocumented and untested).
- No SPA/WAF fixture.
- No nav+footer-only page proving boilerplate can satisfy the threshold.

**Overlaps with:** `6.19`

## Evidence

### Signal: Content depth and text-to-boilerplate token ratio — grade B (semantic-dom-a11y)

**Mechanism:** The larger the share of a page's serialized bytes/tokens that is chrome — nav, repeated headers/footers, wrapper divs, inline scripts — rather than main content, the smaller the fraction of the page that survives extraction into the model's context, and the more likely a fixed truncation cap severs real content. Conversely a page with too little actual content relative to its scaffolding gives an extractor nothing substantive to return.

**Evidence:** Quantified from three independent directions. Cloudflare measured a real blog post at 16,180 HTML tokens versus 3,150 markdown — an 80% reduction — and attributed the delta explicitly to 'the <div> wrappers, nav bars, and script tags that pad every real web page and have zero semantic value'; the response even ships x-original-tokens and x-markdown-tokens headers so agents can compute the ratio [cloudflare-markdown-for-agents]. The 2026 observation study measured HTML at ~56,653 input tokens per agent step against ~6,720 for the accessibility tree, a ~8.4x gap [observation-reduction-paper]. trafilatura's stated purpose is to 'remove the noise consisting of recurring elements (headers and footers, ads, links/blogroll)' [trafilatura-corefunctions], the same job Readability does via link-density and text-density scoring [mozilla-readability-source]. Truncation is real and first-party: Anthropic's read_page caps output at 50,000 characters and truncates at a line boundary [anthropic-browser-use-tool].

**Counter-evidence:** Do not treat 'less boilerplate is always better' as proven. The same study that quantifies the token gap found high-capability models perform BETTER on the fuller HTML observation — Claude Sonnet 4.6 +14.6pp, GPT-5.1 +17.5pp — because they exploit layout information for action grounding, while only weaker models degrade under long inputs [observation-reduction-paper]. No published source defines an acceptable text-to-boilerplate threshold; any specific number an audit uses (e.g. 'main content must be >40% of tokens') is invented and must be presented as a heuristic, not as a standard. Google states no special optimizations are needed for AI features [google-ai-features-docs]. Word-count style 'content depth' minimums in particular have no support in any source found for this domain — score the RATIO with a documented mechanism, not an arbitrary length floor.
**Consumers:** Cloudflare Markdown for Agents, trafilatura, Mozilla Readability, Anthropic read_page / get_page_text (50k char cap), web-agent observation pipelines · **Recommended tier:** scored

**Sources:** [Introducing Markdown for Agents](https://blog.cloudflare.com/markdown-for-agents/) · [Read More, Think More: Revisiting Observation Reduction for Web Agents](https://arxiv.org/abs/2604.01535) · [trafilatura core functions documentation](https://trafilatura.readthedocs.io/en/latest/corefunctions.html) · [mozilla/readability Readability.js source](https://raw.githubusercontent.com/mozilla/readability/main/Readability.js) · [Browser use tool (browser_toolset_20260801)](https://platform.claude.com/docs/en/agents-and-tools/tool-use/browser-use-tool) · [Beyond Pixels: Exploring DOM Downsampling for LLM-Based Web Agents](https://arxiv.org/html/2508.04412v1) · [AI features and your website — Google Search Central](https://developers.google.com/search/docs/appearance/ai-features)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
