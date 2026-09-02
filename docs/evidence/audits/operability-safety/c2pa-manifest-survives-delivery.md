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
  - S7
  - S2
  - S12
---

# C2PA manifest survives the delivery pipeline

> Shipped in v2. Evidence grade **B** · scored tier · unique · implementation: `static-fetch`

## What it checks

Detects the single most common provenance failure: a publisher signs images at creation, then the CDN/image optimizer silently discards the Content Credentials, so every byte an agent or crawler actually downloads is unsigned. Compares provenance on origin assets against the transformed variants that are really served (srcset candidates, /_next/image, /cdn-cgi/image/, imgix/Cloudinary renditions).

## Claimed mechanism (falsifiable)

Image transformation pipelines strip C2PA manifests by default. Cloudflare states it outright: 'When this setting is disabled, any existing Content Credentials will always be discarded' — preservation is an opt-in toggle. Therefore, for any site whose images pass through a transformation layer without explicit preservation enabled, the served variant carries no manifest even when the origin asset does. FALSIFIABLE: fetch the origin asset and the served variant; if the origin contains a C2PA manifest store and the variant does not, the pipeline is stripping provenance. The check fails if variants are found to retain manifests without any preservation setting, or if origin and variant provenance always agree.

## Evidence

- **[MCP Specification 2026-07-28 — Authorization Server Discovery](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/authorization-server-discovery)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - PRM document returned by the MCP server MUST include authorization_servers with at least one entry (stronger than RFC 9728, where it is OPTIONAL). Two discovery mechanisms, both of which clients MUST support: WWW-Authenticate resource_metadata, then well-known probing in order — path-inserted (https://example.com/public/mcp -> https://example.com/.well-known/oauth-protected-resource/public/mcp) then root. AS metadata probing order for issuers with a path: /.well-known/oauth-authorization-server/{path}, /.well-known/openid-configuration/{path}, {path}/.well-known/openid-configuration; without a path: /.well-known/oauth-authorization-server then /.well-known/openid-configuration. Clients MUST reject a metadata doc whose issuer differs from the issuer used to build the URL.
- **[Playwright: Auto-waiting / Actionability checks](https://playwright.dev/docs/actionability)** — Microsoft (vendor-doc, URL verified 2026-08-20)
  - Before click/check/fill/selectOption, Playwright enforces five checks: Visible (non-empty bounding box, not visibility:hidden), Stable (same bounding box over 2 animation frames), Receives Events (element is the hit target at the action point — overlays cause failure), Enabled (not [disabled]/aria-disabled), Editable (not readonly/aria-readonly). Fill requires visible+enabled+editable. This is the exact gate every Playwright-based agent (Playwright-MCP, browser-use, most CUA harnesses) passes through, so each check is a directly testable site-side failure cause.
- **[Text fragments](https://web.dev/articles/text-fragments)** — Google / web.dev (vendor-doc, URL verified 2026-08-20)
  - Confirms a shipped answer-surface consumer: "Clicking a featured snippet takes the user directly to the featured snippet text on the source web page. This works thanks to automatically created Text Fragments URLs." Support: Chrome 89+, Edge 89+, Firefox 131+, Safari 18.2+. Restates the boundary rule: "Each of prefix-, start, end, and -suffix can only match text within a single block-level element, but full start,end ranges can span multiple blocks." Opt-out header: Document-Policy: force-load-at-top.

## Competitor coverage

Lighthouse 13.3's Agentic Browsing category covers llms.txt, WebMCP tools, agent accessibility and layout stability — no binary media parsing at all. Semrush/Ahrefs AI toolkits check image alt text, size and format, never embedded JUMBF/C2PA. Profound and Otterly measure answer-engine share of voice from the outside and never parse the site's image bytes. No SEO or AI-readiness tool ships container-level provenance parsing.

## Implementation sketch

1. Collect candidate image URLs from <img src>, every <img>/<source> srcset candidate, og:image/twitter:image, and JSON-LD image/logo/primaryImageOfPage. 2) For each, GET the bytes (Range-limited first pass is unsafe — JPEG APP11 can sit mid-file per C2PA spec, so fetch fully but cap at ~5MB). 3) Detect the manifest store per container: JPEG scan APP11 (0xFFEB) segments for the 'JP' identifier wrapping a JUMBF box; PNG scan for the C2PA chunk carrying the JUMBF store; WebP scan RIFF for the C2PA chunk; AVIF/HEIF scan BMFF for the C2PA uuid box. Prefer shelling out to c2patool / binding c2pa-rs via its C API rather than reimplementing JUMBF+COSE. 4) Derive origin-vs-variant pairs: for /_next/image?url=X and /cdn-cgi/image/<opts>/X, decode X as the origin; for WordPress -WxH.jpg suffixes, strip to the base upload. 5) Emit manifestCoverage = signed images / total images, and strippedInTransit = pairs where origin has a manifest and variant does not. 6) Report a HIGH finding for strippedInTransit > 0, INFO when the whole site has zero manifests (nothing to strip). Sample 2-3 images per page template rather than every asset.

## Example failure

A newsroom signs photos in Photoshop, uploads them to a Next.js site behind Cloudflare. The origin /uploads/protest.jpg validates with a full manifest, but every rendered <img> points at /_next/image?url=%2Fuploads%2Fprotest.jpg&w=1920 which returns a re-encoded JPEG with no APP11 segment. Content Credentials verification on the live page shows nothing; 100% of the provenance investment is destroyed at the edge.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Implementation deviations

**Renamed** from `c2pa-manifest-survives-the-delivery-pipeline`, which would
make a 63-character id with the category prefix — inside the cap, but the
shorter slug reads better beside its five siblings. The full name survives as
the dossier title.

Steps 1, 2, 4, 5 and 6 of the sketch ship: candidate collection from `<img>`,
every `srcset` candidate, `og:image`/`twitter:image` and JSON-LD
`image`/`logo`/`primaryImageOfPage`; a full byte fetch capped at 5MB;
origin-vs-variant derivation for Next.js, Cloudflare and WordPress; and the
`manifestCoverage` / `strippedInTransit` pair, with a site of zero manifests
reported as not-applicable rather than as a failure.

**Detection is structural, not a parse** (sketch step 3 without the
c2patool dependency). The gatherer walks the container — JPEG marker
segments, PNG chunks, RIFF chunks, BMFF boxes — and locates a manifest store
by its own container marker: an APP11 segment opening with the `JP` JUMBF
identifier, a PNG `caBX` chunk, a WebP `C2PA` chunk, or a `uuid` box carrying
the C2PA UUID. Shelling out to `c2patool` would add a native binary to a pure
TypeScript package, and reimplementing JUMBF+COSE is not needed to answer
"did the pipeline strip it", which is what this audit asks.

**An image over the read cap is skipped, not counted as unsigned.** C2PA
allows the store to sit mid-file, so a truncated read cannot prove absence.
The skipped URLs are reported.

**The scan reads at most six images**, three per page, deduplicated, each
fetched once through the shared cache. A stripping pipeline strips every
image it touches; six samples find it if it is there.

## Deferred

- **Validating the manifest.** Whether the store parses, what it asserts, and
  who signed it is `operability-safety/c2pa-signer-trust-status`.
- **`c2patool` / `c2pa-rs` bindings.** They would give a real parse and real
  validation, at the cost of a native dependency in a package that has none.
- **Per-template sampling.** The sketch samples per page template; this audit
  samples per page, because the scan's page set is already type-diverse and a
  template classifier would be a second inference on top of it.
