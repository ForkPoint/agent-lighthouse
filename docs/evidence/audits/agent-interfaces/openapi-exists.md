---
audit: agent-interfaces/openapi-exists
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/openapi-exists.ts
slug: openapi-exists
evidence_grade: B
disposition: "merged 2026-08-22 (Plan 4, Task 7) — absorbs openapi-link (4.18); 4.18's redeem resolves here"
reviewed: 2026-08-22
sources:
  - rfc-9727
  - iana-well-known-uris
  - ard-spec-repo
  - hf-discover
  - apievangelist-api-catalog-adoption
  - fern-api-catalog
  - openapi-31-spec
  - openai-gpt-actions-openapi
  - ms-copilot-api-plugins
---

# openapi-exists (`5.1`, `4.18`)

> agent-interfaces · source `openapi-exists.ts` · merged API-discovery audit, absorbs openapi-link (4.18) · evidence grade **B** · tier **informative** (weight 0)

## What it checks

One discovery audit over the API-description mechanisms that actually exist, strongest first.

| State                                                                                                                                               | Result                    |
| :-------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------ |
| an RFC 9727 linkset at `/.well-known/api-catalog` — served as data, parseable, with a non-empty `linkset` array                                     | `pass`                    |
| a valid OpenAPI document at `/openapi.json` or `/openapi.yaml` (version key **and** a `paths` object, non-HTML content type)                        | `pass`                    |
| a `<link rel="service-desc">` (or a spec-shaped `alternate`) on any crawled page, followed and verified                                             | `pass`                    |
| `/openapi.json` served but not an OpenAPI document; or a `<link>` advertising a spec that does not resolve to one; or the scan was blocked by a WAF | `warn`, priority `medium` |
| none of the above — no API surface at all                                                                                                           | `na`                      |

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** An AI agent given only a site's origin fetches `/openapi.json` or `/openapi.yaml`, and converts the operations it finds into callable tools, without a developer having registered the document with the agent first.

**Grade: C** — OpenAPI is unambiguously the format documented consumers ingest. But every documented consumer receives the document from a developer at build time, and no vendor documents a named agent that discovers a spec by probing a site root. The discovery leg this audit actually measures is convention, not proven behavior.

**Evidence:**

- OpenAPI 3.1 defines no discovery path or well-known URI; it only states "It is RECOMMENDED that the root OpenAPI document be named: `openapi.json` or `openapi.yaml`", which is the sole basis for probing those two paths — https://spec.openapis.org/oas/v3.1.0.html (verified 2026-08-21)
- OpenAI GPT Actions are built by pasting the OpenAPI schema into the Action editor, not by ChatGPT retrieving it from the site. The doc describes what happens next: "ChatGPT uses those names and descriptions to understand (a) which API action should be called and (b) which parameter should be used" — https://developers.openai.com/api/docs/actions/getting-started (verified 2026-08-21)
- Microsoft 365 Copilot plugins "interact with … REST APIs that have an OpenAPI description", supplied inside a plugin manifest that the developer packages and publishes — https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/overview-api-plugins (verified 2026-08-21)
- The standards-track machine-discovery path for APIs is `/.well-known/api-catalog` (RFC 9727, June 2025), a linkset that may point at OpenAPI documents — not `/openapi.json`; no AI-agent consumer of it is documented — https://www.rfc-editor.org/rfc/rfc9727.html (verified 2026-08-21)

**Counter-evidence:** No crawler or agent documentation from OpenAI, Anthropic, Google, Microsoft, or Perplexity states that any named agent fetches `/openapi.json` from a site root. The plugin-era discovery chain (`/.well-known/ai-plugin.json` pointing at a spec URL) is gone from OpenAI's current documentation, which describes pasting a schema instead. For remote tool surfaces, the documented discovery paths in 2026 are MCP's `server/discover` and the DNS-verified MCP Registry, not a root OpenAPI file. Passing this audit therefore proves an artifact exists, not that any agent will find it.

- 2026-08-24 — evidence sweep: re-checked, no change. B / informative / weight 0 stands; the "adopted forward rather than fading" sentence is withdrawn on ARD counter-evidence.

## Implementation deviations

- The audit absorbs openapi-link (4.18). Its record is `docs/evidence/merged/agent-interfaces/openapi-link.md`.
- The tier is `informative` at grade B. The ratified RFC 9727 path has no documented agent consumer.
- A `text/html` body at any probed path is rejected.
- A `<link>` passes only by producing a spec. `rel="service-desc"` counts on its own. `alternate` counts when the href looks like a spec or the media type is `application/vnd.oai.openapi*`. Media type parameters are stripped, and `title` is never read.
- Every crawled page is searched, but only the first advertised link is followed. Its URL is gated by `isSafeUrl()`.
- A blocked scan (`ctx.wafProtection.isBlocked`) warns instead of reporting absence.
- `/api/openapi.json`, `/v1/openapi.json`, `/swagger.json` and `/api-docs` are not probed. The link follow covers that ground.
- The `Link:` response header is not read.
- YAML is not parsed. The check anchors on `^openapi:` or `^swagger:` plus `^paths:`, behind a non-HTML content type.

## Deferred

- Re-review the grade if ARD (`/.well-known/ai-catalog.json`) keeps gaining consumers while RFC 9727 gains none. ARD has a first-party client in hf-discover; api-catalog has none.
