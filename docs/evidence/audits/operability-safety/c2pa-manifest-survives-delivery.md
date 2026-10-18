---
audit: operability-safety/c2pa-manifest-survives-delivery
category: operability-safety
source_file: packages/core/src/audits/operability-safety/c2pa-manifest-survives-delivery.ts
slug: c2pa-manifest-survives-delivery
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - c2pa-spec-2-4
  - cloudflare-images-preserve-content-credentials
  - google-c2pa-transparency
  - linkedin-content-credentials
---

# C2PA manifest survives the delivery pipeline

> Shipped in v2. Evidence grade **B** · scored tier · unique · implementation: `static-fetch`

## What it checks

A publisher can sign an image at creation and still serve unsigned bytes. The CDN or image optimizer drops the Content Credentials on the way out. The audit fetches the images each page serves and looks for a C2PA manifest store in the bytes. It reads up to six same-host images, three per page, from `img` sources, `srcset` candidates, `og:image`, `twitter:image` and JSON-LD images.

Where a served image is a transformed variant, the audit also fetches the origin asset and compares the two. Three variant shapes are recognised: Next.js `/_next/image?url=…`, Cloudflare `/cdn-cgi/image/<options>/<path>`, and WordPress `-<width>x<height>` renditions.

## Claimed mechanism (falsifiable)

Image transformation layers discard C2PA manifests unless preservation is turned on. Cloudflare states it outright: with its preservation setting disabled, existing Content Credentials "will always be discarded". The C2PA specification marks the PNG manifest chunk "not safe to copy", so a PNG editor that rewrites the image is expected to drop it. Consumers read provenance from the bytes they receive. Google's "About this image" works only "if an image contains C2PA metadata", and LinkedIn marks content that is "cryptographically signed using C2PA Content Credentials". A stripped variant therefore shows no provenance, even when the origin asset carries it.

FALSIFIABLE: fetch the origin asset and the served variant. If the origin holds a C2PA manifest store and the variant does not, the pipeline strips provenance. The claim is wrong if variants keep manifests with no preservation setting, or if origin and variant provenance always agree.

## Evidence

- **[C2PA Technical Specification 2.4](https://spec.c2pa.org/specifications/specifications/2.4/specs/C2PA_Specification.html)** — C2PA (spec, verified 2026-10-17)
  - Appendix A defines where the manifest store sits in each container. JPEG: "embedded as the data contained in an APP11 marker segment". PNG: "an ancillary, private, not safe to copy, chunk type of 'caBX'". WebP: "a chunk with an identifier of C2PA". BMFF (HEIF, AVIF): a `uuid` box with the C2PA extended type. These are the four markers the audit looks for.
  - A re-encoder that does not copy the store forward leaves the variant with no manifest to validate.
- **[Preserve Content Credentials](https://developers.cloudflare.com/images/transform-images/preserve-content-credentials/)** — Cloudflare (vendor-doc, verified 2026-10-17)
  - "When this setting is disabled, any existing Content Credentials will always be discarded." Preservation is opt-in. This is the documented stripping behaviour of one major image pipeline.
- **[How we're increasing transparency for gen AI content with the C2PA](https://blog.google/innovation-and-ai/products/google-gen-ai-content-transparency-c2pa/)** — Google (announcement, verified 2026-10-17)
  - "If an image contains C2PA metadata, people will be able to use our 'About this image' feature to see if it was created or edited with AI tools." The feature is in Google Images, Lens and Circle to Search. Google's ad systems "are starting to integrate C2PA metadata".
- **[Content credentials](https://www.linkedin.com/help/linkedin/answer/a6282984)** — LinkedIn Help (vendor-doc, verified 2026-10-17)
  - "Image and video content that is cryptographically signed using C2PA Content Credentials will be noted with the C2PA icon", visible to all viewers.

**Counter-evidence:** The Google source is a 2024 announcement in the future tense. It names the consumer and the condition, not a current rate of use. The documented consumers read images uploaded to them or indexed by them; no source documents an AI agent that fetches a page and reads C2PA from its images. Only three variant shapes are mapped back to an origin, and third-party image hosts such as imgix or Cloudinary sit on another host and are not sampled at all. A served image with no recognised origin counts toward coverage but cannot be judged stripped. Detection finds the store marker; it does not validate the manifest, its hashes or its signature.

## Scoring

**Grade: B** — the C2PA specification is a published, versioned industry specification, not a ratified standards-body document. Its adoption is documented by named consumers that read the manifest from delivered bytes, Google Search and LinkedIn, and one major pipeline documents the stripping behaviour. That meets the policy's B bar: a draft-status standard with meaningful adoption. It falls short of A because no vendor documents an AI agent consuming the signal.

The audit fails only when an origin asset carries a manifest and its served variant does not. It passes when at least one sampled image is signed and no variant loses its manifest. A site with no signed image is `notApplicable`: there is nothing for the pipeline to strip.

## Example failure

A newsroom signs photos in its editing tool and uploads them to a Next.js site behind a CDN. The origin `/uploads/photo.jpg` carries a full manifest. Every rendered `<img>` points at `/_next/image?url=%2Fuploads%2Fphoto.jpg&w=1920`, which returns a re-encoded JPEG with no APP11 segment. A consumer that reads the served image finds no Content Credentials.

## Implementation deviations

- The slug is shorter than the dossier title, `c2pa-manifest-survives-the-delivery-pipeline`.
- Detection is structural, not a parse. `findC2paManifest` in `gatherers/media.ts` walks the container and finds the store by its marker: a JPEG APP11 JUMBF segment, a PNG `caBX` chunk, a WebP `C2PA` chunk or a BMFF C2PA `uuid` box. `c2patool` would add a native binary to a pure TypeScript package.
- An image over the 5MB read cap is skipped, not counted as unsigned. C2PA allows the store mid-file, so a truncated read cannot prove absence.
- The scan reads at most six images, three per page, deduplicated.
- A site with no signed image returns `notApplicable`. There is nothing for the pipeline to strip.

## Deferred

- `c2patool` or `c2pa-rs` bindings would give a real parse, at the cost of a native dependency.
- Sampling is per page, not per page template.
