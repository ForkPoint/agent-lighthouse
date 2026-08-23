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
---


# C2PA signer chains to the live C2PA Trust List

> Shipped in v2. Evidence grade **B** · scored tier · unique · implementation: `static-fetch`

## What it checks

A manifest that exists is not a manifest that verifies. Grades the signing certificate behind each Content Credential: trusted (on the official C2PA Trust List), legacy (Interim Trust List, frozen 2026-01-01), or untrusted (self-signed, expired, or unknown CA) — and separately reports whether a CAWG identity assertion binds a real named creator.

## Claimed mechanism (falsifiable)

Conforming C2PA validators resolve the signing certificate against the published C2PA Trust List. The Interim Trust List was frozen on 2026-01-01: no new entries are accepted and legacy ITL certificates are not renewed, and C2PA explicitly urges products to distinguish ITL-era credentials from conforming-product credentials. Therefore an asset signed with a self-signed or ITL-legacy certificate will surface as untrusted/unknown-signer in any conforming validator, regardless of how well-formed the manifest is. FALSIFIABLE: extract the x5chain from the COSE signature and attempt a chain build to the trust list; the check is wrong if untrusted-signer manifests validate cleanly in conforming tools.

## Evidence

- **[MCP Specification 2026-07-28 — Authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - 'MCP servers MUST implement OAuth 2.0 Protected Resource Metadata (RFC9728).' Authorization servers MUST provide RFC8414 or OIDC Discovery. Servers SHOULD include a scope parameter in the WWW-Authenticate challenge. Example verbatim: `WWW-Authenticate: Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource", scope="files:read"`. Insufficient scope -> 403 with error="insufficient_scope". Servers SHOULD NOT include offline_access in WWW-Authenticate scope or in PRM scopes_supported. Canonical server URI rules: no fragment, scheme required, prefer no trailing slash. Servers MUST validate token audience; MUST NOT accept or transit other tokens.
- **[Playwright: Auto-waiting / Actionability checks](https://playwright.dev/docs/actionability)** — Microsoft (vendor-doc, URL verified 2026-08-20)
  - Before click/check/fill/selectOption, Playwright enforces five checks: Visible (non-empty bounding box, not visibility:hidden), Stable (same bounding box over 2 animation frames), Receives Events (element is the hit target at the action point — overlays cause failure), Enabled (not [disabled]/aria-disabled), Editable (not readonly/aria-readonly). Fill requires visible+enabled+editable. This is the exact gate every Playwright-based agent (Playwright-MCP, browser-use, most CUA harnesses) passes through, so each check is a directly testable site-side failure cause.
- **[Text fragments](https://web.dev/articles/text-fragments)** — Google / web.dev (vendor-doc, URL verified 2026-08-20)
  - Confirms a shipped answer-surface consumer: "Clicking a featured snippet takes the user directly to the featured snippet text on the source web page. This works thanks to automatically created Text Fragments URLs." Support: Chrome 89+, Edge 89+, Firefox 131+, Safari 18.2+. Restates the boundary rule: "Each of prefix-, start, end, and -suffix can only match text within a single block-level element, but full start,end ranges can span multiple blocks." Opt-out header: Document-Policy: force-load-at-top.

## Competitor coverage

Nothing in the Lighthouse agentic category touches certificates. SEO suites do not parse COSE signatures. Even most C2PA-adjacent tooling stops at 'manifest present'; distinguishing C2PA Trust List from the frozen Interim Trust List is a 2026-specific distinction no auditing product currently surfaces.

## Implementation sketch

1) Reuse the manifest stores extracted by the pipeline-survival check. 2) Run validation via c2patool or c2pa-rs bindings and read the validation status codes; treat any signingCredential untrusted/expired/revoked status as FAIL. 3) Pin the trust list at build time: the C2PA Conformance Explorer publishes the C2PA Trust List, TSA Trust List and Conforming Products List as JSON on GitHub — resolve the exact path once from c2pa.org/conformance/ and vendor the JSON with a refresh job rather than hardcoding a guessed URL. 4) Classify each manifest: TRUSTED (chains to C2PA TL), LEGACY_ITL (chains only to the frozen interim list — WARN, will not be renewed), UNTRUSTED (self-signed / unknown root — FAIL). 5) Also assert the timestamp authority is on the TSA trust list, so credentials stay valid past certificate expiry. 6) Bonus signal: report presence of a CAWG identity assertion, which binds a named creator identity rather than only a signing tool.

## Example failure

A brand runs an in-house signing script using a self-generated certificate. Every product photo carries a syntactically perfect manifest, and internal tooling shows a green check because it was configured to trust the company's own root. In any conforming external validator the assets report an untrusted signing credential, so the provenance claim carries zero third-party weight.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.

## Implementation deviations

**Renamed** from `c2pa-signer-chains-to-the-live-c2pa-trust-list`, which would
make a 65-character id — one over the cap — and which promises more than this
audit delivers.

**Shipped reduced, by decision, and the finding text says so.** The audit
reports what the signing certificate itself states: self-signed or CA-issued,
inside its validity window or outside it, and whether a timestamp token is
present. Sketch steps 3, 4 and 6 — resolving the chain against the vendored
C2PA Trust List, the TRUSTED / LEGACY_ITL / UNTRUSTED classification, the TSA
trust list, and the CAWG identity assertion — are deferred. A test asserts no
output ever claims the certificate is trusted or chains to anything.

**Certificates are located by DER shape, not by decoding COSE** (sketch step
2 without the c2patool dependency). A COSE_Sign1 carries its chain under
protected header label 33 in CBOR; instead of decoding CBOR, the audit scans
the manifest store for the `30 82` SEQUENCE header a certificate begins with
and hands each candidate to Node's `X509Certificate`, which rejects anything
that is not one. The parser is the test.

**Pass requires a timestamp.** A CA-issued certificate inside its window but
with no RFC 3161 timestamp token warns rather than passes: without one the
credential stops validating the day the certificate expires, which is a
documented C2PA property and is checkable from the bytes.

**It reuses Task 2's image fetches.** `gatherers/media.ts` caches per scan, so
running both C2PA audits in one scan costs one set of image fetches.

## Deferred

- **Trust List membership.** Needs the C2PA Trust List, the TSA Trust List and
  the Conforming Products List vendored as JSON with a refresh job, plus an
  X.509 path builder. Node exposes `checkIssued` but no path building, and the
  lists change independently of this repo's release cycle.
- **The LEGACY_ITL classification.** It is a statement about which list a
  certificate appears on, so it cannot exist before the lists do.
- **CAWG identity assertions.** They need a real JUMBF parse, not a byte scan.
- **Revocation.** No OCSP or CRL check is made.
