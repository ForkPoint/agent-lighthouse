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

## Evidence

### Signal: figure / figcaption binding captions to images — grade C (semantic-dom-a11y)

**Mechanism:** Wrapping an image in <figure> with a <figcaption> creates a programmatic association between the caption text and the image. The caption is then exposed as the figure's accessible name or description, and it stays adjacent to the image reference through extraction and markdown conversion. Without it, the caption floats as an unattached paragraph whose relationship to the image must be inferred from proximity.

**Evidence:** The mapping is specified: HTML-AAM maps figure→figure role and figcaption→caption role [w3c-html-aam], and accname's recursive name-from-content rules let figcaption text contribute to the figure's accessible name [w3c-accname]. Google states it draws image context from 'captions and image titles' alongside alt text and surrounding copy [google-image-seo-docs]. Playwright and Chrome DevTools snapshots surface figure nodes like any other role [playwright-mcp-snapshots, chrome-devtools-mcp-tool-reference].

**Counter-evidence:** Weak and largely inferential. No AI vendor names figcaption anywhere. Mozilla Readability does not preserve or prioritise figcaption — figures are touched only by the pass that recovers lazy-loaded image sources [mozilla-readability-source] — and trafilatura's documented preservation list covers tables, lists, headings and formatting without singling out figcaption [trafilatura-corefunctions]. Google's caption statement does not distinguish <figcaption> from a nearby <p>, so the specific claim that the ELEMENT (rather than mere text proximity) is what helps is unproven. Adoption is not measured in the Web Almanac accessibility chapter. This is a plausible mechanism with no demonstrated consumer of the binding itself — informative, never scored.

## Implementation deviations

- When no image or figure is found, the audit consults `scanReadPageText()`. A page that served no readable text returns `notApplicable`, not a pass.
