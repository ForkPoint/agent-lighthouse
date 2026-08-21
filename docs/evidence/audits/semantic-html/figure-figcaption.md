---
audit: semantic-html/figure-figcaption
audit_id: "6.17"
category: semantic-html
source_file: packages/core/src/audits/semantic-html/figure-figcaption.ts
slug: figure-figcaption
review_verdict: fix
severity: medium
evidence_grade: C
disposition: "keep — fix required"
reviewed: 2026-08-21
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

**Mechanism:** Wrapping an image in <figure> with a <figcaption> creates a programmatic association between the caption text and the image, so the caption is exposed as the figure's accessible name/description and stays adjacent to the image reference through extraction and markdown conversion, instead of floating as an unattached paragraph whose relationship to the image must be inferred from proximity.

**Evidence:** The mapping is specified: HTML-AAM maps figure→figure role and figcaption→caption role [w3c-html-aam], and accname's recursive name-from-content rules let figcaption text contribute to the figure's accessible name [w3c-accname]. Google states it draws image context from 'captions and image titles' alongside alt text and surrounding copy [google-image-seo-docs]. Playwright and Chrome DevTools snapshots surface figure nodes like any other role [playwright-mcp-snapshots, chrome-devtools-mcp-tool-reference].

**Counter-evidence:** Weak and largely inferential. No AI vendor names figcaption anywhere. Mozilla Readability does not preserve or prioritise figcaption — figures are touched only by _fixLazyImages to recover image sources [mozilla-readability-source] — and trafilatura's documented preservation list covers tables, lists, headings and formatting without singling out figcaption [trafilatura-corefunctions]. Google's caption statement does not distinguish <figcaption> from a nearby <p>, so the specific claim that the ELEMENT (rather than mere text proximity) is what helps is unproven. Adoption is not measured in the Web Almanac accessibility chapter. This is a plausible mechanism with no demonstrated consumer of the binding itself — informative, never scored.
**Consumers:** Playwright MCP snapshot, Chrome DevTools MCP take_snapshot, Anthropic read_page, Google Images (captions generally, element unattributed) · **Recommended tier:** informative

**Sources:** [HTML Accessibility API Mappings 1.0](https://www.w3.org/TR/html-aam-1.0/) · [Accessible Name and Description Computation 1.1](https://www.w3.org/TR/accname/) · [Image SEO Best Practices — Google Search Central](https://developers.google.com/search/docs/appearance/google-images) · [Snapshots — Playwright MCP](https://playwright.dev/mcp/snapshots) · [chrome-devtools-mcp tool reference (take_snapshot)](https://raw.githubusercontent.com/ChromeDevTools/chrome-devtools-mcp/main/docs/tool-reference.md) · [mozilla/readability Readability.js source](https://raw.githubusercontent.com/mozilla/readability/main/Readability.js) · [trafilatura core functions documentation](https://trafilatura.readthedocs.io/en/latest/corefunctions.html)

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
