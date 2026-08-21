---
audit: semantic-html/image-alt-text
audit_id: "6.15"
category: semantic-html
source_file: packages/core/src/audits/semantic-html/image-alt-text.ts
slug: image-alt-text
review_verdict: fix
severity: medium
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# image-alt-text (`6.15`)

> semantic-html · source `image-alt-text.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

Most AI agents are text-only and rely entirely on alt text to understand images. Missing alt text makes your visual content invisible to AI systems, meaning product images, diagrams, and infographics contribute nothing to AI-generated answers about your page.

## Code review findings (2026-08-20, 11-agent pass)

The decorative-exclusion logic is careful and correct (it properly distinguishes hasAlt===false from alt===''), which makes the gaps stand out. It ignores the other valid accessible-name sources — aria-label, aria-labelledby, and title on the <img> — so an image named via aria-label is scored as missing alt. It ignores aria-hidden="true" (which extractImages does capture and which sibling audit 6.16 does honor), so genuinely hidden images count against coverage. The zero-image branch returns pass() rather than notApplicable(), inflating the score for image-free sites. And results are pooled across all pages with no URL attribution, so a 200-thumbnail gallery page sinks the site-wide number with no indication of where.

**Required fix:** Treat aria-label / aria-labelledby (with id resolution) / title as satisfying the accessible name, and exclude aria-hidden="true" images from the denominator the same way role=presentation is excluded. Swap the totalImages===0 pass() for notApplicable(). Record per-page counts and emit the worst offending URLs in `found`. Consider flagging non-informative alt values ('image', 'photo', the file name) since alt="IMG_2024.jpg" currently scores as full coverage.

**False-positive risks:**
- aria-label / aria-labelledby / title on an <img> are not accepted — false fail on correctly-named images.
- aria-hidden="true" images are counted in the denominator, unlike in audit 6.16 which does honor ariaHidden — the two audits disagree about the same image.
- 'if (totalImages === 0) return this.pass(...)' — free scored 1.0 for image-free sites.
- alt="IMG_2024.jpg", alt="image", alt="photo", or the raw filename all count as descriptive alt text.
- Lazy-loading themes emit <img data-src=… > placeholders and sometimes duplicate <noscript><img> copies; both are counted, double-penalizing or double-crediting the same visual.
- Pooled across pages: one gallery page with 200 unlabeled thumbs drops a 20-page site below 80% and the report names no URL.
- CSR SPAs have no server-rendered <img> → 'No non-decorative images' pass.

**Test gaps:**
- No aria-label / aria-labelledby / title fixture.
- No aria-hidden="true" fixture (and no test of the disagreement with 6.16).
- No test asserting na vs pass for the zero-image case.
- No junk-alt fixture (alt="IMG_1234.jpg").
- No multi-page crawl and no test that `found` identifies offending pages.
- No boundary test at exactly 80% coverage.
- No <noscript>/lazy-load duplicate-image fixture.

**Overlaps with:** `6.16`, `6.17`

## Evidence

### Signal: Image alt text as the machine-readable representation of images — grade A (semantic-dom-a11y)

**Mechanism:** The alt attribute is the native text-alternative source in the accessible-name computation, so it becomes the accessible name of an <img> node in every accessibility-tree snapshot and the only representation of the image for text-only crawlers that do not execute JS or run vision models over page images. Google separately states it uses alt text as an input to understanding image subject matter. An image with missing alt is an unnamed node an agent cannot refer to; an image with alt='' is mapped to presentation/none and intentionally removed from the tree.

**Evidence:** Direct vendor statement: 'Google uses alt text along with computer vision algorithms and the contents of the page to understand the subject matter of the image' [google-image-seo-docs]. The mechanism is standardised: accname (W3C Recommendation, 2018) lists HTML alt among the native host-language text-alternative sources ranked below aria-labelledby/aria-label [w3c-accname], and HTML-AAM maps img[alt] to the image role and img[alt=''] to none/presentation [w3c-html-aam]. Vercel's crawler-log data shows the AI crawlers that matter here do not execute JavaScript at all [vercel-ai-crawler-study], so server-rendered alt is what they get. The ads experiment gives the behavioural corollary: agents across GPT-4o, Claude 3.7 Sonnet, Gemini 2.0 Flash and OpenAI Operator 'ignore purely visual calls to action, clicking banners only when semantic button overlays or off-screen text labels are present' [machine-readable-ads-paper]. Baseline: 69% of images pass the alt audit and ~8.5% of alt values are just filenames [web-almanac-2025-accessibility].

**Counter-evidence:** The 'multimodal AI' framing is where this overreaches. Neither OpenAI nor Anthropic documents consuming alt text anywhere, and Google's AI-features page says no special optimizations are needed for AI Overviews [google-ai-features-docs]. Vercel's data shows ClaudeBot spends 35.17% of its fetches on images [vercel-ai-crawler-study], meaning image bytes are being retrieved and can plausibly be captioned by a vision model without any alt at all — capable multimodal systems can substitute for alt in a way they cannot substitute for a missing heading. So grade A rests on Google's explicit statement, not on a general 'all AI reads alt' claim; the audit should say so. Also note alt='' is correct, not a failure, for decorative images (30% of alt attributes are legitimately empty [web-almanac-2024-accessibility]) — an audit that flags empty alt as missing alt is wrong.
**Consumers:** Google Search / Google Images, Playwright MCP snapshot, Anthropic read_page / Claude-in-Chrome, Chrome DevTools MCP take_snapshot, browser-use, screen readers (accname consumers) · **Recommended tier:** scored

**Sources:** [Image SEO Best Practices — Google Search Central](https://developers.google.com/search/docs/appearance/google-images) · [Accessible Name and Description Computation 1.1](https://www.w3.org/TR/accname/) · [HTML Accessibility API Mappings 1.0](https://www.w3.org/TR/html-aam-1.0/) · [The rise of the AI crawler](https://vercel.com/blog/the-rise-of-the-ai-crawler) · [Machine-Readable Ads: Accessibility and Trust Patterns for AI Web Agents interacting with Online Advertisements](https://arxiv.org/abs/2507.12844) · [Web Almanac 2025 — Accessibility chapter](https://almanac.httparchive.org/en/2025/accessibility) · [Web Almanac 2024 — Accessibility chapter](https://almanac.httparchive.org/en/2024/accessibility) · [AI features and your website — Google Search Central](https://developers.google.com/search/docs/appearance/ai-features)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
