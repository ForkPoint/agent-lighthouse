---
audit: operability-safety/synthetic-media-disclosure-validity
category: operability-safety
source_file: packages/core/src/audits/operability-safety/synthetic-media-disclosure-validity.ts
slug: synthetic-media-disclosure-validity
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-10-18
graduated: 2026-08-23
sources:
  - iptc-photo-metadata-2025-1
  - iptc-synthetic-media-guidance
  - google-image-metadata
---

# Synthetic-media disclosure is valid and self-consistent

> Shipped in v2. Evidence grade **B** · scored tier · unique · implementation: `static-fetch`

## What it checks

Audits AI-generated-content disclosure at the only layer that is machine-readable and interoperable: the IPTC Iptc4xmpExt:DigitalSourceType XMP property. Catches the two failure modes that make disclosure worthless — malformed values outside the controlled vocabulary, and XMP that contradicts the C2PA manifest on the same asset.

| State                                                          | Result |
| :------------------------------------------------------------- | :----- |
| no sampled image declares a digital source type                | `na`   |
| every declaration is a full vocabulary URI, agreeing with C2PA | `pass` |
| a bare concept, an `https` spelling or a trailing slash        | `warn` |
| free text, or a concept outside the vocabulary                 | `fail` |
| the XMP declaration contradicts the asset's C2PA manifest      | `fail` |

## Claimed mechanism (falsifiable)

IPTC types DigitalSourceType as [URI <External>], meaning the value must be a full NewsCodes URI from the ratified controlled vocabulary (base http://cv.iptc.org/newscodes/digitalsourcetype/, note the http scheme), not a bare token. A consumer matching against the vocabulary therefore silently ignores free text such as 'AI-generated' — the publisher believes it disclosed and every machine reader sees nothing. A bare 'trainedAlgorithmicMedia' or an https-scheme variant is a near miss: it is not the form IPTC defines, but Google's documentation shows exactly those spellings without saying which it reads. FALSIFIABLE: parse the XMP packet and test membership in the fetched vocabulary; separately, compare against the digital source type asserted in the asset's C2PA manifest, where a disagreement is a hard contradiction one of the two pipelines produced.

## Evidence

- **[IPTC Photo Metadata Standard 2025.1 — Digital Source Type](https://www.iptc.org/std/photometadata/specification/IPTC-PhotoMetadata-2025.1.html)** — IPTC (spec, verified 2026-10-17)
  - Property 11.13. Data type "CV-code", with the CV note "Required: Digital Source Type NewsCodes" at `http://cv.iptc.org/newscodes/digitalsourcetype/`. The XMP form is "Iptc4xmpExt:DigitalSourceType [URI <External>]". The value is a vocabulary URI, not free text.
- **[IPTC publishes metadata guidance for AI-generated "synthetic media"](https://iptc.org/news/iptc-publishes-metadata-guidance-for-ai-generated-synthetic-media/)** — IPTC (spec, verified 2026-10-17)
  - Software that generates images with trained AI models should write the Digital Source Type `trainedAlgorithmicMedia` into the file's XMP packet, or into a C2PA manifest. "The complete URI for the recommended Trained Algorithmic Media term is" `http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia`.
- **[Google Images SEO: Image Metadata](https://developers.google.com/search/docs/appearance/structured-data/image-license-metadata)** — Google Search Central (vendor-doc, verified 2026-10-17)
  - A named consumer. Google reads the IPTC Digital Source Type field and "supports the following IPTC NewsCodes": `trainedAlgorithmicMedia`, `compositeSynthetic`, `algorithmicMedia` and `compositeWithTrainedAlgorithmicMedia`.
  - Counter-evidence for the scheme rule. The page shows the codes as bare tokens linked to `https://cv.iptc.org/…` URIs. It does not say which spellings Google's parser accepts. A bare token or an `https` URI may still be read by Google, though neither is the form the IPTC standard defines.

## Example failure

A publisher configures its CMS to stamp every AI-illustrated article header with DigitalSourceType = 'AI-generated'. Because the value is free text rather than the http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia URI, every conforming reader treats the field as unrecognized. The organization reports full AI-disclosure compliance internally while shipping zero machine-readable disclosure.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

**Grade: B** — IPTC defines the property and its vocabulary, and Google documents reading it. The grade stays at B because no consumer documents rejecting the malformed values this audit fails, and no AI agent is documented to read the field.

## Implementation deviations

- The id is shortened. The proposal's name would make a 73-character id.
- The IPTC vocabulary is vendored, not fetched. Fetching `cv.iptc.org` at audit time would put a third-party outage between a site and its score. The refresh path is written above the constant.
- The C2PA cross-check is a byte search of the manifest store for the synthetic and capture concept names, not a manifest parse. A full JUMBF parse needs the dependency `c2pa-signer-trust-status` also declines to add.
- `declaredCoverage` is reported as an unscored detail.
- **Near-miss spellings warn, not fail (2026-10-18).** A bare concept, an
  `https` spelling and a trailing slash used to fail. Google's Image Metadata
  page lists the codes as bare tokens linked to `https` URIs and does not say
  which spelling it accepts, so the dossier's own counter-evidence could not
  support a failure. Free text, unknown concepts and C2PA contradictions still
  fail. The near misses are listed under `details.warnings`.

## Deferred

- **Undisclosed synthetic imagery** needs a classifier, an `llm-assisted` roadmap item.
- **Video and audio containers.** XMP in video sits in a different packet location. BMFF is recognised only for manifest detection.
- **Other IPTC AI properties** such as `Iptc4xmpExt:DigitalSourceFileType`. Only `DigitalSourceType` is the ratified interoperable disclosure.
