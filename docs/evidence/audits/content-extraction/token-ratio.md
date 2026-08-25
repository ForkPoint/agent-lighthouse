---
audit: content-extraction/token-ratio
category: content-extraction
source_file: packages/core/src/audits/content-extraction/token-ratio.ts
slug: token-ratio
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: scored
consumers:
  - "Anthropic read_page (50,000-char cap, depth 15 default)"
  - Playwright MCP snapshot
  - Chrome DevTools MCP
  - browser-use DOM serializer
  - Cloudflare Markdown for Agents
signals:
  - name: Content depth and text-to-boilerplate token ratio
    grade: B
    domain: semantic-dom-a11y
  - name: Inline SVG and DOM bloat consuming LLM context
    grade: B
    domain: semantic-dom-a11y
sources:
  - cloudflare-markdown-for-agents
  - observation-reduction-paper
  - trafilatura-corefunctions
  - readability-src
  - anthropic-browser-use-tool
  - dom-downsampling-paper
  - google-ai-features-trust
  - playwright-mcp-snapshots
  - browser-use-clickable-elements
  - vercel-rise-of-ai-crawler
  - cf-tomarkdown-rest
  - distracted-irrelevant
  - tiktoken
  - mozilla-readability-source
  - google-ai-features-docs
---

# token-ratio (`6.19`)

> semantic-html · source `token-ratio.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

## What it checks

AI agents pay for every token of raw HTML they download, but only the visible text carries meaning. This audit compares the character weight of the raw HTML against the extracted main-content text to produce a "context bloat score": the share of the page that is actual content rather than markup, scripts, and styles. The ratio is evaluated on the homepage (the first crawled page), which is the entry point agents most often fetch. A ratio under 5% means an agent parses 20 tokens of noise for every token of content; under 15% still wastes most of the context window on boilerplate. Unlike content depth (which measures text volume), this measures how efficiently that text is packaged.

## Code review findings (2026-08-20, 11-agent pass)

Good idea, miscalibrated and internally inconsistent. The numerator is getMainContentText (scoped to <main> when present) while the denominator is the entire raw HTML — so adopting <main>, which audit 6.3 pushes as high priority, shrinks the numerator and lowers this score. The two audits in the same category reward opposite behavior on the same markup. Separately the thresholds are set where nearly the whole modern web fails: a typical Next.js/Nuxt/Shopify homepage carries 200–400KB of HTML with hydration payloads and 3–6KB of visible text, i.e. 1–3% — under the 5% FAIL floor. An audit that fails almost every site conveys no information, and its stated harm ('the page may be truncated before the real content is read') does not hold for the Readability/Turndown pipelines that strip scripts first.

**Required fix:** Compute the ratio against comparable scopes: strip script/style/template/svg/noscript and inline data blobs from the denominator before dividing, or use the whole body text as the numerator when <main> is present so both sides cover the same subtree. Recalibrate thresholds against a real corpus of SSR framework output rather than round numbers. Make CHARS_PER_TOKEN script-aware (~1.5 for CJK, ~3 for markup) or drop the token estimate from displayValue. Reject non-HTML content types and WAF interstitials (ctx.wafProtection is available and unused) instead of scoring them.

**False-positive risks:**
- 'const cleanText = getMainContentText(page.$)' (main-scoped) over 'rawHtml.length' (whole document) — a site is penalized for adopting <main>, directly contradicting audit 6.3.
- Every SSR React/Vue/Svelte site with a hydration payload lands under 5% → fail. Near-universal failure means the check does not discriminate good sites from bad.
- Pretty-printed HTML is penalized versus minified HTML for identical content — the audit measures build configuration, not agent experience.
- 'CHARS_PER_TOKEN = 4' is wrong for HTML (~3) and badly wrong for CJK (~1–1.5), so displayValue's 'est. tokens' misleads on non-English pages.
- A WAF challenge page or a small soft-404 has a high text-to-markup ratio and PASSES; ctx.wafProtection is never consulted.
- Only the homepage is measured (documented), so a lean homepage in front of bloated deep pages passes.
- A CSR shell (tiny HTML, tiny text) can land anywhere on the scale for reasons unrelated to content packaging.

**Test gaps:**
- No fixture comparing the same content with and without <main> — the 6.3 contradiction is untested.
- No realistic SSR framework fixture (Next.js __NEXT_DATA__ / Nuxt payload) to show where real sites land against the thresholds.
- No CJK fixture for the token estimate.
- No WAF/soft-404 fixture (currently would pass).
- No boundary tests at exactly 5% and 15%.
- No minified-vs-pretty-printed comparison.

**Overlaps with:** `6.14`, `6.18`

## Evidence

### Signal: Content depth and text-to-boilerplate token ratio — grade B (semantic-dom-a11y)

**Mechanism:** Chrome is everything that is not main content: nav, repeated headers and footers, wrapper divs, inline scripts. The larger its share of a page's serialized bytes and tokens, the smaller the fraction of the page that survives extraction into the model's context — and the more likely a fixed truncation cap severs real content. Conversely a page with too little actual content relative to its scaffolding gives an extractor nothing substantive to return.

**Grade: B** — Quantified from three independent directions rather than asserted. Cloudflare measured one real blog post at 16,180 HTML tokens against 3,150 in markdown, an 80% reduction. It attributed the delta to "the `<div>` wrappers, nav bars, and script tags that pad every real web page and have zero semantic value". Strong empirical evidence of an effect, with no vendor stating a requirement, is grade B. The grade deliberately does not carry the stronger claim that less boilerplate is always better: the same study found high-capability models performed *better* on the fuller HTML — Claude Sonnet 4.6 by 14.6pp, GPT-5.1 by 17.5pp — because they exploit layout for action grounding.

**Evidence:** Quantified from three independent directions. Cloudflare measured a real blog post at 16,180 HTML tokens against 3,150 in markdown — an 80% reduction. It attributed the delta explicitly to 'the <div> wrappers, nav bars, and script tags that pad every real web page and have zero semantic value'. The response even ships x-original-tokens and x-markdown-tokens headers, so agents can compute the ratio [cloudflare-markdown-for-agents]. The 2026 observation study measured HTML at about 56,653 input tokens per agent step, against about 6,720 for the accessibility tree. That is a gap of roughly 8.4x [observation-reduction-paper]. trafilatura's stated purpose is to 'remove the noise consisting of recurring elements (headers and footers, ads, links/blogroll)' [trafilatura-corefunctions]. Readability does the same job, via link-density and text-density scoring [mozilla-readability-source]. Truncation is real and first-party: Anthropic's read_page caps output at 50,000 characters and truncates at a line boundary [anthropic-browser-use-tool].

**Counter-evidence:** Do not treat 'less boilerplate is always better' as proven. The same study that quantifies the token gap found high-capability models perform better on the fuller HTML observation — Claude Sonnet 4.6 +14.6pp, GPT-5.1 +17.5pp — because they exploit layout information for action grounding, while only weaker models degrade under long inputs [observation-reduction-paper]. No published source defines an acceptable text-to-boilerplate threshold; any specific number an audit uses (e.g. 'main content must be >40% of tokens') is invented and must be presented as a heuristic, not as a standard. Google states no special optimizations are needed for AI features [google-ai-features-docs]. Word-count style 'content depth' minimums in particular have no support in any source found for this domain — score the RATIO with a documented mechanism, not an arbitrary length floor.

### Signal: Inline SVG and DOM bloat consuming LLM context — grade B (semantic-dom-a11y)

**Mechanism:** Deeply nested DOM and large inline SVG inflate the serialized page representation an agent receives, pushing it against fixed truncation caps and depth limits so content below the cut is never seen. The general DOM-size claim is well supported; the SVG-specific claim is that inline path data is pure token cost with no semantic payload, since it carries no accessible name and contributes nothing an LLM can reason about.

**Grade: B** — The truncation half is documented first-party: Anthropic's `read_page` caps output at 50,000 characters, truncates at a line boundary, and offers a depth limit (default 15) and ref-scoping as the remedy — an explicit admission that page size forces partial reads. Real DOMs are reported to exceed model context windows outright. That is a documented consumer with a stated limit but no measured effect on answer quality, which is grade B. The SVG-specific half is weaker, and the audit treats it that way. No vendor document, specification or study singles out inline SVG. Mechanically, an `<svg>` with no title and no `aria-label` collapses to one unnamed node in the accessibility tree. Its path data therefore costs nothing in a tree-based snapshot, and costs a great deal only in raw-HTML pipelines.

**Evidence:** Truncation is documented first-party: Anthropic's read_page caps output at 50,000 characters, truncates at a line boundary, and offers depth (default 15) and ref-scoping as the remedy — an explicit admission that page size forces partial reads [anthropic-browser-use-tool]. The scale of the problem is measured: 'Some real world DOMs surpass the size of a megabyte', roughly 1e6 tokens, against 1e3 to 1e4 after downsampling. The D2Snap ablation found DOM hierarchy 'the strongest among those features' for LLM performance. Its attribute filter preserves alt, href and aria-*, and discards the rest [dom-downsampling-paper]. Token magnitudes corroborated at ~56,653 HTML tokens per step [observation-reduction-paper] and by Cloudflare's 80% markdown reduction attributed to semantically empty wrappers and scripts [cloudflare-markdown-for-agents].

**Counter-evidence:** The SVG-specific half is materially weaker than the DOM-size half and should be graded C on its own. No vendor doc, spec, or study I could verify singles out inline SVG as an agent problem. Mechanically the cost is asymmetric. An inline <svg> without a title or aria-label collapses to a single unnamed node in the accessibility tree, or is omitted from it. Its bloat therefore lands on raw-HTML and markdown consumers, not on the a11y-tree agents that dominate this domain. An SVG-bloat audit is really a payload-weight audit, not an agent-perception audit. And bigger is not uniformly worse: strong models gained double-digit points from the larger HTML observation [observation-reduction-paper]. Recommend scoring total serialized DOM size / node depth with the truncation cap as the documented anchor, and demoting the SVG-specific rule to an informative sub-check unless the SVG is also unnamed where it acts as a control.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Absorbed proposal — Signal Density Index (content tokens ÷ delivered tokens)

On 2026-08-23 the `token-economics/signal-density-index-content-tokens-delivered-tokens`
proposal (evidence grade **B**, `static-fetch`) was folded into this audit
rather than shipped beside it. Both measure the same quantity — how much of
what a site delivers is content — and shipping both would have scored one
defect twice and given `content-extraction` 1.2 evidence mass for it.

What the fold changed here:

- The ratio is now BPE tokens under `o200k_base`, not characters. Base64,
  minified script and SVG path data tokenize four to eight times worse than
  prose of the same length, which a character ratio cannot see.
- The numerator is `@mozilla/readability` — the extractor most of the industry
  deploys — falling back to the semantic container when readability declines.
  `found` and `details.extractor` name which one produced the number.
- `details` carries the denominator split into `script`, `style`, `comment`,
  `text` and `structure` tokens. `structure` is the residual, so the buckets
  always sum to the delivered count. The split is what makes the finding
  actionable: it names the bucket to attack.

Thresholds did not move: ≥ 15% passes, ≥ 5% warns, below 5% fails.

The proposal's evidence carries over. AI crawlers do not execute JavaScript or
apply CSS, so the whole response body is what enters the agent's context
([Vercel, The rise of the AI crawler](https://vercel.com/blog/the-rise-of-the-ai-crawler));
infrastructure vendors already bill and report HTML→markdown conversion in
tokens per document ([Cloudflare Workers AI, Markdown Conversion](https://developers.cloudflare.com/workers-ai/features/markdown-conversion/usage/rest-api/));
irrelevant context measurably degrades answer quality, so the waste is not only
a cost ([Shi et al., ICML 2023](https://arxiv.org/abs/2302.00093)); and
`o200k_base` makes the number reproducible offline
([openai/tiktoken](https://github.com/openai/tiktoken)).

The proposal's letter grades (A ≥ 0.20, B 0.10–0.20, C 0.04–0.10, F < 0.04) were
**not** adopted. This audit's three-band ternary result predates them and is
what the migration map and every consumer of `content-extraction/token-ratio`
already expect.
