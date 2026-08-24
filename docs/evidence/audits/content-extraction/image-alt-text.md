---
audit: content-extraction/image-alt-text
audit_id: "6.15"
category: content-extraction
source_file: packages/core/src/audits/content-extraction/image-alt-text.ts
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

An image with no text alternative has no accessible name. It appears as an unnamed node in the accessibility-tree snapshot agent toolkits send to a model — Playwright MCP, Claude-in-Chrome `read_page`, Chrome DevTools `take_snapshot` — and it carries no subject matter for Google Images, which states it uses alt text to understand what an image shows.

This measures the accessible name, not the `alt` attribute alone: `aria-labelledby`, `aria-label`, `alt` and `title`, in the order accname ranks them. Images marked decorative (`alt=""`, `role="presentation"`) or hidden from assistive technology (`aria-hidden="true"`) are excluded, because correct markup is not a defect.

A multimodal agent that fetches the image bytes can caption it without a text alternative. A text-only crawler or a snapshot-driven agent cannot.

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

**Grade: A** — Google states it directly: "Google uses alt text along with computer vision algorithms and the contents of the page to understand the subject matter of the image." The mechanism is also standardised rather than conventional — accname (a W3C Recommendation) lists `alt` among the native text-alternative sources, ranked below `aria-labelledby` and `aria-label` — so the attribute has a defined role in the tree every agent snapshot is built from. A vendor statement plus a ratified specification is the grade-A bar. The grade does not extend to the multimodal framing this audit used to carry: neither OpenAI nor Anthropic documents consuming alt text, and Google's AI-features page says no special optimisation is needed for AI Overviews.

**Evidence:** Direct vendor statement: 'Google uses alt text along with computer vision algorithms and the contents of the page to understand the subject matter of the image' [google-image-seo-docs]. The mechanism is standardised: accname (W3C Recommendation, 2018) lists HTML alt among the native host-language text-alternative sources ranked below aria-labelledby/aria-label [w3c-accname], and HTML-AAM maps img[alt] to the image role and img[alt=''] to none/presentation [w3c-html-aam]. Vercel's crawler-log data shows the AI crawlers that matter here do not execute JavaScript at all [vercel-ai-crawler-study], so server-rendered alt is what they get. The ads experiment gives the behavioural corollary: agents across GPT-4o, Claude 3.7 Sonnet, Gemini 2.0 Flash and OpenAI Operator 'ignore purely visual calls to action, clicking banners only when semantic button overlays or off-screen text labels are present' [machine-readable-ads-paper]. Baseline: 69% of images pass the alt audit and ~8.5% of alt values are just filenames [web-almanac-2025-accessibility].

**Counter-evidence:** The 'multimodal AI' framing is where this overreaches. Neither OpenAI nor Anthropic documents consuming alt text anywhere, and Google's AI-features page says no special optimizations are needed for AI Overviews [google-ai-features-docs]. Vercel's data shows ClaudeBot spends 35.17% of its fetches on images [vercel-ai-crawler-study], meaning image bytes are being retrieved and can plausibly be captioned by a vision model without any alt at all — capable multimodal systems can substitute for alt in a way they cannot substitute for a missing heading. So grade A rests on Google's explicit statement, not on a general 'all AI reads alt' claim; the audit should say so. Also note alt='' is correct, not a failure, for decorative images (30% of alt attributes are legitimately empty [web-almanac-2024-accessibility]) — an audit that flags empty alt as missing alt is wrong.
**Consumers:** Google Search / Google Images, Playwright MCP snapshot, Anthropic read_page / Claude-in-Chrome, Chrome DevTools MCP take_snapshot, browser-use, screen readers (accname consumers) · **Recommended tier:** scored

**Sources:** [Image SEO Best Practices — Google Search Central](https://developers.google.com/search/docs/appearance/google-images) (verified 2026-08-20) · [Accessible Name and Description Computation 1.1](https://www.w3.org/TR/accname/) (verified 2026-08-20) · [HTML Accessibility API Mappings 1.0](https://www.w3.org/TR/html-aam-1.0/) (verified 2026-08-20) · [The rise of the AI crawler](https://vercel.com/blog/the-rise-of-the-ai-crawler) (verified 2026-08-20) · [Machine-Readable Ads: Accessibility and Trust Patterns for AI Web Agents interacting with Online Advertisements](https://arxiv.org/abs/2507.12844) (verified 2026-08-20) · [Web Almanac 2025 — Accessibility chapter](https://almanac.httparchive.org/en/2025/accessibility) (verified 2026-08-20) · [Web Almanac 2024 — Accessibility chapter](https://almanac.httparchive.org/en/2024/accessibility) (verified 2026-08-20) · [AI features and your website — Google Search Central](https://developers.google.com/search/docs/appearance/ai-features) (verified 2026-08-20)

## Pass-rule correction (contradiction sweep, 2026-08-24)

The grade is earned by the accessible-name computation; the rule measured one
of its four sources.

This dossier's evidence grades the mechanism A on a standard: accname "lists
HTML alt among the native host-language text-alternative sources ranked below
aria-labelledby/aria-label", and HTML-AAM maps `img[alt='']` to
none/presentation. The audit tested for a non-empty `alt` attribute and nothing
else, so it failed two configurations the cited standard ranks *above* `alt`,
plus the `title` fallback it maps below. An image named `aria-label="Sales by
quarter"` has an accessible name by the very document the grade rests on, and
the audit called it a failure at weight 1.0.

The rule now computes the name the standard defines: `aria-labelledby` (ids
resolved against the page), then `aria-label`, then `alt`, then `title`. Only an
image that ends with no name at all counts against coverage.

Three further corrections, each asked for by name in this dossier's own required
fix:

- **`aria-hidden="true"` images leave the denominator.** They are not in the
  accessibility tree, so none of the snapshot consumers in the consumer list can
  see them. Counting them scored a site down for images the mechanism does not
  reach.
- **An empty population is not applicable, not a pass.** The old rule returned a
  scored 1.0 when a site had no non-decorative images — a free full mark for
  image-free pages and for every client-rendered site whose served HTML carries
  no `<img>` at all.
- **Failures name the pages they came from.** Coverage is pooled across every
  scanned page, so a single gallery page could sink a whole site with no
  indication of where the problem was. The message now names the worst offending
  URLs and the result carries the worst page's URL. This is attribution only; no
  threshold moved, because no source sets one.

One boundary is deliberate. A global ARIA name defeats a decorative marker —
`<img alt="" aria-label="Sales by quarter">` is a named node under ARIA's
presentational-role conflict resolution, so it enters the denominator as
covered. `title` does not have that effect: it names an image that already
counts, but it does not pull a decorative one back in.

**The user-facing claim was withdrawn.** The description and the failure copy
asserted that "Most AI agents are text-only and rely entirely on alt text" and
that missing alt text makes content "invisible to AI systems". This dossier's
own counter-evidence rejects it: "Neither OpenAI nor Anthropic documents
consuming alt text anywhere, and Google's AI-features page says no special
optimizations are needed for AI Overviews … So grade A rests on Google's
explicit statement, not on a general 'all AI reads alt' claim; the audit should
say so." It now says so, and it names the accessibility-tree consumers the
research actually found.

Two things were considered and left out. The junk-alt heuristic the 2026-08-20
review suggested — failing `alt="IMG_2024.jpg"` — would *widen* the pass rule
with a test no cited source defines, which is the opposite of what this sweep is
for; it needs its own research. And the pooled-coverage aggregation was left
alone for the same reason: no source sets a threshold or an aggregation unit, so
the answer to the gallery-page problem is attribution, not new scoring maths.

Grade, tier and weight are unchanged at A, scored, 1.0. The 2026-08-20 review's
reference to audit 6.16 honouring `ariaHidden` is now stale — that audit,
`semantic-html/decorative-images`, was sunset in v2 — so the exclusion here
rests on the accessibility-tree mechanism alone, which carries it.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
- 2026-08-24 — contradiction sweep: pass rule narrowed from the `alt` attribute to the accessible name the grade rests on.
