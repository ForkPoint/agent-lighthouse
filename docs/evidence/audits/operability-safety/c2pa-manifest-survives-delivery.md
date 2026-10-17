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

## Example failure

A newsroom signs photos in Photoshop, uploads them to a Next.js site behind Cloudflare. The origin /uploads/protest.jpg validates with a full manifest, but every rendered <img> points at /_next/image?url=%2Fuploads%2Fprotest.jpg&w=1920 which returns a re-encoded JPEG with no APP11 segment. Content Credentials verification on the live page shows nothing; 100% of the provenance investment is destroyed at the edge.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Implementation deviations

- The slug is shorter than the dossier title, `c2pa-manifest-survives-the-delivery-pipeline`.
- Detection is structural, not a parse. `findC2paManifest` in `gatherers/media.ts` walks the container and finds the store by its marker: a JPEG APP11 JUMBF segment, a PNG `caBX` chunk, a WebP `C2PA` chunk or a BMFF C2PA `uuid` box. `c2patool` would add a native binary to a pure TypeScript package.
- An image over the 5MB read cap is skipped, not counted as unsigned. C2PA allows the store mid-file, so a truncated read cannot prove absence.
- The scan reads at most six images, three per page, deduplicated.
- A site with no signed image returns `notApplicable`. There is nothing for the pipeline to strip.

## Deferred

- `c2patool` or `c2pa-rs` bindings would give a real parse, at the cost of a native dependency.
- Sampling is per page, not per page template.
