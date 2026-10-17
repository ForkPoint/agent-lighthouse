---
audit: operability-safety/c2pa-signer-trust-status
category: operability-safety
source_file: packages/core/src/audits/operability-safety/c2pa-signer-trust-status.ts
slug: c2pa-signer-trust-status
evidence_grade: B
tier: scored
disposition: "new in v2 — graduated from proposal 2026-08-23"
reviewed: 2026-08-20
graduated: 2026-08-23
sources:
  - S6
  - S2
  - S12
---

# C2PA signer chains to the live C2PA Trust List

> Shipped in v2. Evidence grade **B** · scored tier · unique · implementation: `static-fetch`

## What it checks

A manifest that exists is not a manifest that verifies. Grades the signing certificate behind each Content Credential as one of three states: trusted, meaning it is on the official C2PA Trust List; legacy, meaning the Interim Trust List, frozen 2026-01-01; or untrusted, meaning self-signed, expired, or an unknown CA. Separately reports whether a CAWG identity assertion binds a real named creator.

## Claimed mechanism (falsifiable)

Conforming C2PA validators resolve the signing certificate against the published C2PA Trust List. The Interim Trust List was frozen on 2026-01-01: no new entries are accepted and legacy ITL certificates are not renewed, and C2PA explicitly urges products to distinguish ITL-era credentials from conforming-product credentials. Therefore an asset signed with a self-signed or ITL-legacy certificate will surface as untrusted/unknown-signer in any conforming validator, regardless of how well-formed the manifest is. FALSIFIABLE: extract the x5chain from the COSE signature and attempt a chain build to the trust list; the check is wrong if untrusted-signer manifests validate cleanly in conforming tools.

## Evidence

- **[MCP Specification 2026-07-28 — Authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - 'MCP servers MUST implement OAuth 2.0 Protected Resource Metadata (RFC9728).' Authorization servers MUST provide RFC8414 or OIDC Discovery. Servers SHOULD include a scope parameter in the WWW-Authenticate challenge. Example verbatim: `WWW-Authenticate: Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource", scope="files:read"`. Insufficient scope -> 403 with error="insufficient_scope". Servers SHOULD NOT include offline_access in WWW-Authenticate scope or in PRM scopes_supported. Canonical server URI rules: no fragment, scheme required, prefer no trailing slash. Servers MUST validate token audience; MUST NOT accept or transit other tokens.
- **[Playwright: Auto-waiting / Actionability checks](https://playwright.dev/docs/actionability)** — Microsoft (vendor-doc, URL verified 2026-08-20)
  - Before click/check/fill/selectOption, Playwright enforces five checks: Visible (non-empty bounding box, not visibility:hidden), Stable (same bounding box over 2 animation frames), Receives Events (element is the hit target at the action point — overlays cause failure), Enabled (not [disabled]/aria-disabled), Editable (not readonly/aria-readonly). Fill requires visible+enabled+editable. This is the exact gate every Playwright-based agent (Playwright-MCP, browser-use, most CUA harnesses) passes through, so each check is a directly testable site-side failure cause.
- **[Text fragments](https://web.dev/articles/text-fragments)** — Google / web.dev (vendor-doc, URL verified 2026-08-20)
  - Confirms a shipped answer-surface consumer: "Clicking a featured snippet takes the user directly to the featured snippet text on the source web page. This works thanks to automatically created Text Fragments URLs." Support: Chrome 89+, Edge 89+, Firefox 131+, Safari 18.2+. Restates the boundary rule: "Each of prefix-, start, end, and -suffix can only match text within a single block-level element, but full start,end ranges can span multiple blocks." Opt-out header: Document-Policy: force-load-at-top.

## Example failure

A brand runs an in-house signing script using a self-generated certificate. Every product photo carries a syntactically perfect manifest, and internal tooling shows a green check because it was configured to trust the company's own root. In any conforming external validator the assets report an untrusted signing credential, so the provenance claim carries zero third-party weight.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Implementation deviations

- The slug is shorter than the dossier title. The full name would exceed the 64-character id cap and promise more than the audit delivers.
- The audit reports only what the signing certificate states: self-signed or CA-issued, inside or outside its validity window, and whether a timestamp token is present. A test asserts no output claims the certificate is trusted or chains to anything.
- Certificates are found by DER shape, not by decoding COSE. The audit scans the store for the `30 82` SEQUENCE header and hands each candidate to Node's `X509Certificate`, which rejects anything else.
- A CA-issued certificate with no RFC 3161 timestamp warns rather than passes. Without one the credential stops validating when the certificate expires.
- Image fetches are shared with `c2pa-manifest-survives-delivery` through the per-scan cache in `gatherers/media.ts`.

## Deferred

- Trust List membership. It needs the C2PA Trust List, the TSA Trust List and the Conforming Products List vendored with a refresh job, plus an X.509 path builder.
- The LEGACY_ITL classification. It depends on the vendored lists.
- CAWG identity assertions. They need a real JUMBF parse.
- Revocation. No OCSP or CRL check is made.
