---
audit: content-extraction/image-alt-text
category: content-extraction
source_file: packages/core/src/audits/content-extraction/image-alt-text.ts
slug: image-alt-text
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: scored
consumers:
  - Google Search / Google Images
  - Playwright MCP snapshot
  - Anthropic read_page / Claude-in-Chrome
  - Chrome DevTools MCP take_snapshot
  - browser-use
  - screen readers (accname consumers)
signals:
  - name: Image alt text as the machine-readable representation of images
    grade: A
    domain: semantic-dom-a11y
sources:
  - google-image-seo-docs
  - w3c-accname
  - w3c-html-aam
  - vercel-rise-of-ai-crawler
  - machine-readable-ads-paper
  - web-almanac-2025-accessibility
  - web-almanac-2024-accessibility
  - google-ai-features-trust
  - vercel-ai-crawler-study
  - google-ai-features-docs
---

# image-alt-text (`6.15`)

> semantic-html · source `image-alt-text.ts` · review verdict **fix** · evidence grade **A** · disposition: **keep — fix required**

## What it checks

An image with no text alternative has no accessible name. It appears as an unnamed node in the accessibility-tree snapshot that agent toolkits send to a model: Playwright MCP, Claude-in-Chrome `read_page`, Chrome DevTools `take_snapshot`. It also carries no subject matter for Google Images, which states it uses alt text to understand what an image shows.

This measures the accessible name, not the `alt` attribute alone: `aria-labelledby`, `aria-label`, `alt` and `title`, in the order accname ranks them. Images marked decorative (`alt=""`, `role="presentation"`) or hidden from assistive technology (`aria-hidden="true"`) are excluded, because correct markup is not a defect.

A multimodal agent that fetches the image bytes can caption it without a text alternative. A text-only crawler or a snapshot-driven agent cannot.

## Evidence

### Signal: Image alt text as the machine-readable representation of images — grade A (semantic-dom-a11y)

**Mechanism:** The alt attribute is the native text-alternative source in the accessible-name computation. It therefore becomes the accessible name of an <img> node in every accessibility-tree snapshot. It is also the only representation of the image for text-only crawlers, which neither execute JS nor run vision models over page images. Google separately states it uses alt text as an input to understanding image subject matter. An image with missing alt is an unnamed node an agent cannot refer to; an image with alt='' is mapped to presentation/none and intentionally removed from the tree.

**Grade: A** — Google states it directly: "Google uses alt text along with computer vision algorithms and the contents of the page to understand the subject matter of the image." The mechanism is standardised rather than conventional. accname, a W3C Recommendation, lists `alt` among the native text-alternative sources, ranked below `aria-labelledby` and `aria-label`. The attribute therefore has a defined role in the tree every agent snapshot is built from. A vendor statement plus a ratified specification is the grade-A bar. The grade does not extend to the multimodal framing this audit used to carry: neither OpenAI nor Anthropic documents consuming alt text, and Google's AI-features page says no special optimisation is needed for AI Overviews.

**Evidence:** Direct vendor statement: 'Google uses alt text along with computer vision algorithms and the contents of the page to understand the subject matter of the image' [google-image-seo-docs]. The mechanism is standardised: accname (W3C Recommendation, 2018) lists HTML alt among the native host-language text-alternative sources ranked below aria-labelledby/aria-label [w3c-accname], and HTML-AAM maps img[alt] to the image role and img[alt=''] to none/presentation [w3c-html-aam]. Vercel's crawler-log data shows the AI crawlers that matter here do not execute JavaScript at all [vercel-ai-crawler-study], so server-rendered alt is what they get. The ads experiment gives the behavioural corollary: agents across GPT-4o, Claude 3.7 Sonnet, Gemini 2.0 Flash and OpenAI Operator 'ignore purely visual calls to action, clicking banners only when semantic button overlays or off-screen text labels are present' [machine-readable-ads-paper]. Baseline: 69% of images pass the alt audit and ~8.5% of alt values are just filenames [web-almanac-2025-accessibility].

**Counter-evidence:** The 'multimodal AI' framing is where this overreaches. Neither OpenAI nor Anthropic documents consuming alt text anywhere, and Google's AI-features page says no special optimizations are needed for AI Overviews [google-ai-features-docs]. Vercel's data shows ClaudeBot spends 35.17% of its fetches on images [vercel-ai-crawler-study]. Image bytes are therefore being retrieved, and can plausibly be captioned by a vision model with no alt at all. Capable multimodal systems can substitute for alt in a way they cannot substitute for a missing heading. So grade A rests on Google's explicit statement, not on a general 'all AI reads alt' claim; the audit should say so. Also note alt='' is correct, not a failure, for decorative images (30% of alt attributes are legitimately empty [web-almanac-2024-accessibility]) — an audit that flags empty alt as missing alt is wrong.

## Pass-rule correction (contradiction sweep, 2026-08-24)

The grade is earned by the accessible-name computation; the rule measured one
of its four sources.

This dossier's evidence grades the mechanism A on a standard: accname "lists
HTML alt among the native host-language text-alternative sources ranked below
aria-labelledby/aria-label", and HTML-AAM maps `img[alt='']` to
none/presentation. The audit tested for a non-empty `alt` attribute and nothing
else, so it failed two configurations the cited standard ranks _above_ `alt`,
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
review suggested — failing `alt="IMG_2024.jpg"` — would _widen_ the pass rule
with a test no cited source defines, which is the opposite of what this sweep is
for; it needs its own research. And the pooled-coverage aggregation was left
alone for the same reason: no source sets a threshold or an aggregation unit, so
the answer to the gallery-page problem is attribution, not new scoring maths.

Grade, tier and weight are unchanged at A, scored, 1.0. The 2026-08-20 review's
reference to audit 6.16 honouring `ariaHidden` is now stale — that audit,
`semantic-html/decorative-images`, was sunset in v2 — so the exclusion here
rests on the accessibility-tree mechanism alone, which carries it.

## Deferred

- Images inside a container hidden by an external stylesheet are still
  counted. A large retail site ships an unfilled popup template, hidden by an
  id rule in its stylesheet, holding `<img src="">` with no alt. The audit
  reads no CSS, and the stylesheet scanner in `gatherers/css-rules.ts`
  resolves no specificity and no media queries. Skipping on its answer would
  also drop images a desktop-viewport agent does see. Exact resolution waits
  for the headless tier.

## Limits

### Browser snapshot evidence

The snapshot path reuses this audit on each complete, unredacted, non-loading DOM capture that carries readable text. It reports the original static verdict as an unscored browser finding. It does not prove HTTP delivery, computed appearance, a complete accessibility tree, live form state, or action success. The source and page URL accompany every finding. Existing implementation limits still apply.

The individual evidence review and limits appear in [Browser-rendered snapshot assessment](../../../architecture/browser-snapshots.md#supported-audit-inventory). The explicit eligibility record lives in `packages/core/src/snapshot-eligibility.ts`. Original crawler grades, tiers, and weights stay unchanged.

## Implementation deviations

Browser snapshots provide serialized markup observations only. The browser assessment uses informative display and weight 0. It does not extend the dossier's crawler scoring claim to browser task success. Truncated, redacted, and still-loading captures produce missing-evidence records rather than verdicts.
