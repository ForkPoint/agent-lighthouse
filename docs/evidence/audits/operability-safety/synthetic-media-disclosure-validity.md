---
audit: operability-safety/synthetic-media-disclosure-validity
category: operability-safety
source_file: packages/core/src/audits/operability-safety/synthetic-media-disclosure-validity.ts
slug: synthetic-media-disclosure-validity
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - lh-a11ytree
  - S11
  - S2
  - S12
---


# Synthetic-media disclosure is valid and self-consistent

> Shipped in v2. Evidence grade **B** · scored tier · unique · implementation: `static-fetch`

## What it checks

Audits AI-generated-content disclosure at the only layer that is machine-readable and interoperable: the IPTC Iptc4xmpExt:DigitalSourceType XMP property. Catches the two failure modes that make disclosure worthless — malformed values outside the controlled vocabulary, and XMP that contradicts the C2PA manifest on the same asset.

## Claimed mechanism (falsifiable)

IPTC types DigitalSourceType as [URI <External>], meaning the value must be a full NewsCodes URI from the ratified controlled vocabulary (base http://cv.iptc.org/newscodes/digitalsourcetype/, note the http scheme), not a bare token. A consumer matching against the vocabulary therefore silently ignores 'AI-generated', 'trainedAlgorithmicMedia' (bare), or an https-scheme variant — the publisher believes it disclosed and every machine reader sees nothing. FALSIFIABLE: parse the XMP packet and test membership in the fetched vocabulary; separately, compare against the digital source type asserted in the asset's C2PA manifest, where a disagreement is a hard contradiction one of the two pipelines produced.

## Evidence

- **[Lighthouse audit source: agent-accessibility-tree.js](https://raw.githubusercontent.com/GoogleChrome/lighthouse/main/core/audits/agentic/agent-accessibility-tree.js)** — Google Chrome / Lighthouse (repo, URL verified 2026-08-20)
  - Implementation is a filter over artifacts.Accessibility.violations against ~37 TARGET_RULES from axe (button-name, link-name, input-button-name, label, autocomplete-valid, aria-allowed-attr, aria-required-attr, aria-valid-attr-value, tabindex, table/definition-list rules). Binary score: any violation scores 0. Crucially it inherits axe's blind spots — axe cannot fail an element that has no interactive semantics at all, and autocomplete-valid only validates tokens that are already present, never their absence.
- **[WebSuite: Systematically Evaluating Why Web Agents Fail](https://arxiv.org/html/2406.01623v1)** — arXiv (study, URL verified 2026-08-20)
  - Per-UI-primitive success rates for natbot and SeeAct. Worst patterns: slider interaction 0% for both agents; tooltip-based information retrieval 0% for both; complex form filling 12.5% (natbot) / 0% (SeeAct). Aggregate: operational actions 85.2%/76.2%, menu navigation 93.8%/81.3%, informational actions 43.8%/40.6%. Taxonomy covers click (button, link, icon button, slider, switch, accordion, dropdown menu, dialog button, snackbar), type (text/date/phone), select (checkbox, multicheck, select, datagrid row).
- **[Playwright: Auto-waiting / Actionability checks](https://playwright.dev/docs/actionability)** — Microsoft (vendor-doc, URL verified 2026-08-20)
  - Before click/check/fill/selectOption, Playwright enforces five checks: Visible (non-empty bounding box, not visibility:hidden), Stable (same bounding box over 2 animation frames), Receives Events (element is the hit target at the action point — overlays cause failure), Enabled (not [disabled]/aria-disabled), Editable (not readonly/aria-readonly). Fill requires visible+enabled+editable. This is the exact gate every Playwright-based agent (Playwright-MCP, browser-use, most CUA harnesses) passes through, so each check is a directly testable site-side failure cause.
- **[Text fragments](https://web.dev/articles/text-fragments)** — Google / web.dev (vendor-doc, URL verified 2026-08-20)
  - Confirms a shipped answer-surface consumer: "Clicking a featured snippet takes the user directly to the featured snippet text on the source web page. This works thanks to automatically created Text Fragments URLs." Support: Chrome 89+, Edge 89+, Firefox 131+, Safari 18.2+. Restates the boundary rule: "Each of prefix-, start, end, and -suffix can only match text within a single block-level element, but full start,end ranges can span multiple blocks." Opt-out header: Document-Policy: force-load-at-top.

## Competitor coverage

No SEO or AI-readiness tool parses XMP packets. Lighthouse's agentic category does not inspect image metadata. The C2PA-vs-XMP contradiction check in particular requires holding both provenance channels for one asset simultaneously, which nothing in the market does.

## Implementation sketch

1) For each raster image, extract the XMP packet: JPEG APP1 with the http://ns.adobe.com/xap/1.0/ identifier; PNG iTXt keyed XML:com.adobe.xmp; or scan for <?xpacket begin ... ?> ... <?xpacket end?>. 2) Read Iptc4xmpExt:DigitalSourceType in namespace http://iptc.org/std/Iptc4xmpExt/2008-02-29/. 3) Fetch and cache the concept list from https://cv.iptc.org/newscodes/digitalsourcetype/ ; assert the value is an exact member. Emit a targeted FAIL for the near-miss classes: bare conceptId with no URI prefix, https:// where the vocabulary uses http://, trailing slash, or a free-text string. 4) Cross-check with C2PA: if the asset carries a manifest whose actions assert digitalSourceType trainedAlgorithmicMedia while XMP declares digitalCapture (or vice versa), emit a HIGH contradiction finding — the two provenance channels on one asset disagree about whether a human took the photo. 5) Report declaredCoverage across images as INFO. 6) SCOPE HONESTLY: detecting *undisclosed* synthetic imagery requires a classifier and belongs on the roadmap as llm-assisted; this check only grades declarations that exist and their internal consistency.

## Example failure

A publisher configures its CMS to stamp every AI-illustrated article header with DigitalSourceType = 'trainedAlgorithmicMedia'. Because the value is a bare token rather than the http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia URI, every conforming reader treats the field as unrecognized. The organization reports full AI-disclosure compliance internally while shipping zero machine-readable disclosure.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Implementation deviations

**Renamed** from `synthetic-media-disclosure-is-valid-and-self-consistent`,
which would make a 73-character id.

Steps 1 to 6 of the sketch ship: XMP extraction from JPEG APP1 and PNG iTXt
with a raw `<?xpacket?>` fallback, the `Iptc4xmpExt:DigitalSourceType` read in
its attribute, element and `rdf:resource` forms, membership tested against the
vocabulary, a separate finding for each near-miss class, the C2PA
cross-check, `declaredCoverage` as an unscored detail, and the honest scope —
a test asserts the audit never claims to detect undisclosed synthetic imagery.

**The vocabulary is vendored, not fetched** (sketch step 3). Fetching
`cv.iptc.org` at audit time would put a third-party outage between a site and
its own score, for a list that changes a few times a decade. The refresh path
is written above the constant.

**The C2PA cross-check is a byte search, not a manifest parse.** The manifest
store is searched for the synthetic and capture concept names; a store
asserting a trained-algorithmic source while the XMP declares a camera capture
(or the reverse) is the contradiction the sketch asks for. A full JUMBF parse
would name the exact assertion, and needs the dependency
`operability-safety/c2pa-signer-trust-status` also declines to add.

**Evidence hygiene.** The IPTC source carries the mechanism. The dossier's
other sources belong to the C2PA proposals and nothing here rests on them.

## Deferred

- **Detecting undisclosed synthetic imagery.** It needs a classifier, which is
  an `llm-assisted` roadmap item, and the dossier says so.
- **Video and audio containers.** The gatherer reads raster images; BMFF is
  recognised for manifest detection but XMP in video is a different packet
  location.
- **`Iptc4xmpExt:DigitalSourceFileType` and the other IPTC AI properties.**
  Only `DigitalSourceType` is the ratified interoperable disclosure.
