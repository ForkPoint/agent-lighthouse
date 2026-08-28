---
audit: content-extraction/figure-figcaption
category: content-extraction
source_file: packages/core/src/audits/content-extraction/figure-figcaption.ts
slug: figure-figcaption
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
recommended_tier: informative
consumers:
  - Playwright MCP snapshot
  - Chrome DevTools MCP take_snapshot
  - Anthropic read_page
  - "Google Images (captions generally, element unattributed)"
signals:
  - name: figure / figcaption binding captions to images
    grade: C
    domain: semantic-dom-a11y
sources:
  - w3c-html-aam
  - w3c-accname
  - google-image-seo-docs
  - playwright-mcp-snapshots
  - chrome-devtools-mcp-tool-reference
  - readability-src
  - trafilatura-corefunctions
  - mozilla-readability-source
---

# figure-figcaption (`6.17`)

> semantic-html · source `figure-figcaption.ts` · review verdict **fix** · evidence grade **C** · disposition: **keep — fix required**

## What it checks

AI agents use <figcaption> to understand the purpose and context of figures beyond what alt text provides. Without captions, agents treat figures as opaque image containers with no semantic meaning, missing opportunities to cite your visual data in AI-generated answers.

## Code review findings (2026-08-20, 11-agent pass)

The core check (do existing <figure>s have a <figcaption>) is sound. The problem is the fallback: when a page has no <figure> at all but any <img> exists, it warns that the images 'could benefit from <figure>/<figcaption>' — which fires on essentially every website ever built, including ones where every image is a logo, an icon, or a product thumbnail that must not be captioned. That is unfixable noise. The no-images branch then returns pass() instead of notApplicable(), a free 1.0. The caption test is also presence-only ('$(el).find('figcaption').length > 0'), so an empty <figcaption></figcaption> satisfies a check whose entire premise is that the caption's text carries context.

**Required fix:** Change the no-figures-but-images branch from warn() to notApplicable() — or fire it only when images sit inside <article>/<main> prose AND exceed some size, never for logos/icons/thumbnails. Change the no-images branch from pass() to notApplicable(). Require the figcaption to contain non-whitespace text of meaningful length rather than merely existing. Scope find('figcaption') to direct children so a nested figure's caption is not credited to its parent.

**False-positive risks:**
- 'if (totalImages > 0) return this.warn(... could benefit from <figure>/<figcaption>)' fires on virtually every real site, including ones whose only images are logos and icons — permanent unactionable warning.
- 'if (totalFigures === 0 && totalImages === 0) return this.pass(...)' — free scored 1.0 for image-free sites.
- An empty <figcaption></figcaption> or one containing only 'Fig. 1' passes a check about conveying context.
- '$(el).find('figcaption')' descends into nested figures, so an outer figure inherits an inner figure's caption.
- Themes that wrap every product thumbnail in <figure> (common in WooCommerce/Shopify) create a large uncaptioned denominator and fail, though captioning product grid thumbnails would be wrong.
- Figures pooled across pages with no URL attribution.

**Test gaps:**
- No fixture where the only images are logos/icons (the dominant false warn).
- No empty-<figcaption> fixture.
- No nested-<figure> fixture.
- No product-grid fixture with many uncaptioned <figure> thumbnails.
- No test asserting na vs pass for the no-images case.

**Overlaps with:** `6.15`

## Evidence

### Signal: figure / figcaption binding captions to images — grade C (semantic-dom-a11y)

**Mechanism:** Wrapping an image in <figure> with a <figcaption> creates a programmatic association between the caption text and the image. The caption is then exposed as the figure's accessible name or description, and it stays adjacent to the image reference through extraction and markdown conversion. Without it, the caption floats as an unattached paragraph whose relationship to the image must be inferred from proximity.

**Evidence:** The mapping is specified: HTML-AAM maps figure→figure role and figcaption→caption role [w3c-html-aam], and accname's recursive name-from-content rules let figcaption text contribute to the figure's accessible name [w3c-accname]. Google states it draws image context from 'captions and image titles' alongside alt text and surrounding copy [google-image-seo-docs]. Playwright and Chrome DevTools snapshots surface figure nodes like any other role [playwright-mcp-snapshots, chrome-devtools-mcp-tool-reference].

**Counter-evidence:** Weak and largely inferential. No AI vendor names figcaption anywhere. Mozilla Readability does not preserve or prioritise figcaption — figures are touched only by the pass that recovers lazy-loaded image sources [mozilla-readability-source] — and trafilatura's documented preservation list covers tables, lists, headings and formatting without singling out figcaption [trafilatura-corefunctions]. Google's caption statement does not distinguish <figcaption> from a nearby <p>, so the specific claim that the ELEMENT (rather than mere text proximity) is what helps is unproven. Adoption is not measured in the Web Almanac accessibility chapter. This is a plausible mechanism with no demonstrated consumer of the binding itself — informative, never scored.

## Implementation deviations

- 2026-08-28 — the audit declines when the scan holds no response it can
  attribute to this site. It read the figures on the scanned pages, and
  `ctx.pages`/`ctx.rootFiles` carry whatever answered 200 — on a parked domain
  a broker's page from another host, on a walled or throttled origin nothing
  at all. It now consults `scanReadTheSite()` and returns `notApplicable`
  carrying the gate's own reason.
  Verdicts that moved on the five nothing-obtained contract states: walled
  pass → na, throttled pass → na, redirected away pass → na, non-HTML homepage
  pass → na, HTTP 200 bot challenge pass → na. Found by
  `packages/core/src/tests/hostile-state-contract.test.ts`.
- 2026-08-28 — the "no images or figures" branch no longer passes a page that
  served no readable text. A JS shell serves neither, so the pass credited a page
  that never showed a figure. That branch now returns `notApplicable` when
  `scanReadPageText()` is false; the warning for images that exist without a
  `<figure>` still fires whenever images arrived. Verdict moved on the shell
  contract state: pass → na. Found by
  `packages/core/src/tests/hostile-state-contract.test.ts`.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
