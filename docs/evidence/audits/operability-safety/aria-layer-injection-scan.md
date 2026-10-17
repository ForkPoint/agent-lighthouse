---
audit: operability-safety/aria-layer-injection-scan
category: operability-safety
source_file: packages/core/src/audits/operability-safety/aria-layer-injection-scan.ts
slug: aria-layer-injection-scan
evidence_grade: A
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-22"
reviewed: 2026-08-20
graduated: 2026-08-22
sources:
  - anthropic-claude-for-chrome
  - anthropic-cu-tool
  - eia-iclr25
---

# Accessibility-Layer Injection Scan

> Shipped in v2. Evidence grade **A** · scored tier · partial overlap · implementation: `static-fetch`

## What it checks

Audit the text that reaches an agent through the accessibility tree and non-visual attributes rather than through body copy: alt, aria-label, aria-labelledby targets, aria-description, title, placeholder, hidden input values, <option> labels, document title and og:* metadata. Flag instruction-shaped content, anomalously long values, and aria-label/visible-text divergence.

## Claimed mechanism (falsifiable)

Computer-use and browser agents drive pages through the DOM and accessibility tree, not pixels, so a11y attributes enter the model context with the same weight as visible text while remaining invisible to a sighted human. Anthropic names the vector explicitly: 'hidden malicious form fields in a webpage's DOM invisible to humans, and other hard-to-catch injections such as through the URL text and tab title that only an agent might see.' The divergence sub-check is a defect in its own right, independent of injection. An agent that clicks by accessible name will actuate an aria-label that contradicts the rendered label. Falsifier: if every a11y attribute is short, descriptive, and token-consistent with its element's visible text, this channel carries no payload.

## Evidence

- **[Piloting Claude for Chrome](https://claude.com/blog/claude-for-chrome)** — Anthropic (vendor-doc, URL verified 2026-08-20)
  - Red-team attack success rate 23.6% in autonomous browsing mode, 11.2% after mitigations; a browser-specific challenge set went 35.7% -> 0%. Names the exact vectors: 'hidden malicious form fields in a webpage's Document Object Model (DOM) invisible to humans, and other hard-to-catch injections such as through the URL text and tab title that only an agent might see.' This is the vendor-documented basis for auditing hidden inputs and a11y/metadata attributes.
- **[Computer use tool — security and prompt injection guidance](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool)** — Anthropic (vendor-doc, URL verified 2026-08-20)
  - 'In some circumstances, Claude will follow commands found in content even when they conflict with your instructions. For example, instructions on webpages or contained in images might override your instructions.' Classifiers run on screenshots to flag injections and force user confirmation. Also recommends asking a human to confirm consequential actions — the vendor-side counterpart to the site-side 'don't hide consequence behind a GET link' check.
- **[EIA: Environmental Injection Attack on Generalist Web Agents](https://arxiv.org/abs/2409.11295)** — arXiv / ICLR 2025 (study, URL verified 2026-08-20)
  - Injects content into the page environment that blends into the surrounding site. Up to 70% ASR for stealing specific PII, 16% for extracting the full user request, over 177 Mind2Web action steps. Authors report EIA is hard to detect and that well-adapted injections survive human inspection — i.e. detection has to be mechanical, not eyeballed.

## Scoring

Tier per evidence policy: **scored** — grade A meets the A/B bar required for scored audits.

## Implementation deviations

- Shipped as `operability-safety/aria-layer-injection-scan`. The shorter slug keeps the id inside the 64-character limit.
- The instruction lexicon is imported from `operability-safety/invisible-instruction-scan`. One lexicon serves both surfaces, so they cannot drift apart.
- Stopwords are dropped before the Jaccard comparison. Raw Jaccard warns on legitimate pairs such as "Place your order now" against "Submit order" only because of function words.
- The finite-verb test for hidden input values is a closed verb list, not a parser. The heuristic should miss a sentence sooner than flag a nonce.
- The overlap and opposing-verb comparisons run only on native controls and widget roles. A landmark or container name describes a region, not its children's text. Every `aria-label` is still read for the lexicon and length checks.
- A clean result on a page with no readable text returns `notApplicable`. That branch runs after the payload branches, because an instruction planted in a shell's `<title>` or `og:*` value is still served.

## Deferred

- `aria-labelledby` and `aria-describedby` targets are read for lexicon hits only. No divergence check compares a referenced label with the element's visible text.
- The long-value warning covers `alt` and `aria-label` only. A long `title` is an ordinary tooltip.
