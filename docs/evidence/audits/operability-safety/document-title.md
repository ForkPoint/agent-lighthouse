---
audit: operability-safety/document-title
category: operability-safety
source_file: packages/core/src/audits/operability-safety/document-title.ts
slug: document-title
evidence_grade: A
disposition: "keep"
reviewed: 2026-08-21
sources:
  - google-title-link-docs
  - mdn-title-element
  - wcag-f41
  - playwright-mcp-repo
  - chrome-devtools-mcp-tools
---

# Page has a non-empty <title> (`7.18`)

> operability-safety · source `_a11y.ts` · review verdict **keep** · evidence grade **A** · disposition: **keep**

## What it checks

The document title is the page’s identity in the accessibility tree and in agent context windows. A missing/empty title leaves the page unnamed.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** The `<title>` element is the document's name. A browser tab list exposes it, assistive technology announces it on page load, and Google uses it as a source for the title link in search results. A page with a missing or empty title is therefore unnamed in every consumer that identifies a page by name rather than by URL.

**Grade: A** — documented consumer behavior (Google states it generates title links from `<title>` content) plus a ratified Level A success criterion (WCAG 2.4.2 Page Titled) with universal browser/AT implementation.

**Evidence:**

- Google: title links are generated from several sources, first among them "Content in `<title>` elements" — https://developers.google.com/search/docs/appearance/title-link (verified 2026-08-21)
- MDN: the title "defines the document's title that is shown in a browser's title bar or a page's tab". It adds that "A common navigation technique for users of assistive technology is to read the page title and infer the content the page contains", and gives the guidance to "make titles unique to every page" — https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/title (verified 2026-08-21)
- WCAG 2.2 documents the page-title expectation as a Level A requirement (2.4.2 Page Titled) — referenced from the failure/technique set at https://www.w3.org/WAI/WCAG22/Techniques/failures/F41 (verified 2026-08-21)
- Agent tool-chains address pages as tabs. Playwright MCP `browser_tabs` will "List, create, close, or select a browser tab", and chrome-devtools-mcp `list_pages` will "Get a list of pages open in the browser". On that surface a document's title is the only identifier a human or a model can read — https://github.com/microsoft/playwright-mcp and https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md (both verified 2026-08-21)

**Counter-evidence:** Neither Playwright MCP nor Chrome DevTools MCP documents the page title as part of the accessibility snapshot the model reasons over. A tree-driven agent can therefore complete tasks on an untitled page. The documented dependence is on identification and citation surfaces, not on action. The check is also presence-only. A site shipping the same generic title on every page — the actual disambiguation failure — passes. And JS-assigned titles in a CSR SPA fail here, while every real consumer that executes JS sees a title.
