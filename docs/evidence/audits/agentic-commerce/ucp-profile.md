---
audit: agentic-commerce/ucp-profile
category: agentic-commerce
source_file: packages/core/src/audits/agentic-commerce/ucp-profile.ts
slug: ucp-profile
evidence_grade: B
disposition: "new 2026-10-18 — split out of agent-interfaces/mcp-discovery"
reviewed: 2026-10-18
public_extra:
  - Limits
recommended_tier: scored
consumers:
  - Google Merchant UCP integration (pilot; Google says the profile "will enable" it to negotiate, not that it fetches the file)
sources:
  - google-merchant-ucp-profile
  - google-merchant-ucp-publish-profile
  - ucp-spec-overview
  - ucp-spec-2026-01-11
---

# ucp-profile

> agentic-commerce · source `ucp-profile.ts` · evidence grade **B** · tier **scored** (weight 0.6)

## What it checks

Whether the Universal Commerce Protocol business profile at `/.well-known/ucp` can be read in the shape Google documents.

| State                                                                                | Verdict                            |
| :----------------------------------------------------------------------------------- | :--------------------------------- |
| No 200, an HTML page answering for the path, or an empty body                        | notApplicable                      |
| 401 or 403                                                                           | notApplicable                      |
| JSON with no `ucp` key (for example one document served at every path)               | notApplicable                      |
| Body is not a JSON object, or `ucp` is not an object                                 | fail                               |
| `ucp.services` missing or empty                                                      | fail                               |
| No service has a readable binding (`null`, a scalar, `[]`, or only non-object items) | fail                               |
| A malformed service entry beside readable bindings                                   | warn; the readable ones are graded |
| `ucp.version` missing                                                                | warn                               |
| A declared `endpoint` is not an absolute https URL                                   | warn                               |
| A binding with no `endpoint` (for example an `embedded` binding)                     | not judged                         |
| `ucp.capabilities` missing                                                           | not judged                         |
| All of the above in order                                                            | pass                               |

Both published profile shapes are read: the current one, where each service lists bindings with `transport` and `endpoint`, and the 2026-01-11 one, where each service holds one object per transport (`rest.endpoint`) and capabilities are an array.

## Claimed mechanism (falsifiable)

Google's Merchant UCP guide says the profile at `/.well-known/ucp` "will enable Google to efficiently negotiate capabilities with your server": which UCP version and checkout capabilities the store supports, and where to send requests. A profile that cannot be parsed, or one with no services, names no endpoint for that negotiation.

## Evidence

- "Your UCP profile (known as business profile in UCP) will enable Google to efficiently negotiate capabilities with your server. This profile is a JSON file that you host on your server at the well-known path: /.well-known/ucp. It's crucial for integrating with Google" — https://developers.google.com/merchant/ucp/guides/overview/ucp-profile (verified 2026-10-18)
- The same page: the profile declares capabilities, specifies versions, provides endpoints ("Tells Google where to send API requests"), configures payment handling and shares public keys. It "must be publicly accessible and not require any authentication."
- Google's example puts `version`, `services` and `capabilities` inside a `ucp` object, with each service listing bindings that carry an `endpoint`. "The ucp object contains protocol metadata: version, services, and capabilities" — https://developers.google.com/merchant/ucp/implementation/2026-04-08/publish-profile (verified 2026-10-18)
- The UCP specification marks a binding's `endpoint` as Optional, and its example `embedded` binding has none. When an endpoint is present it "MUST be a valid URL with scheme (https)". It says `ucp.capabilities` "is optional and MAY be omitted", and that signing keys "MUST appear in the top-level `keys[]` array" — https://ucp.dev/specification/overview/ (verified 2026-10-18)
- The 2026-01-11 specification nests each transport under the service (`rest`, `mcp`, `a2a`, `embedded`), lists capabilities as an array, and names the key array `signing_keys` — https://ucp.dev/2026-01-11/specification/overview/ (verified 2026-10-18)

**Counter-evidence:** The consumer is one vendor's checkout integration, and it reads the profile of merchants enrolled in it. No other AI vendor documents reading `/.well-known/ucp`.

## Scoring

**Grade: B** — a published standard with a named consumer, but not documented consumer behaviour. Google names the path and says the profile "will enable" it to negotiate capabilities. It does not document fetching the file, and the integration is a Merchant Center pilot. The audit scores only stores that publish a profile, so a site outside UCP loses nothing.

- A profile that cannot be read, or one that names no service, fails at high priority.
- A missing version or a declared endpoint that is not absolute https warns.

## Example failure

```json
{
  "ucp": {
    "version": "2026-08-25",
    "services": {}
  }
}
```

The profile declares no services, so it names nowhere to send a request.

## Limits

- Signing keys (`keys`, or `signing_keys` in the 2026-01-11 shape) are counted in `details.signingKeys` but not judged. Google says the keys verify webhooks and other signed messages; it does not say a profile without them is rejected.
- This readability audit does not validate capability or payment-handler declarations. The separate [declaration-conformance audit](./ucp-profile-conformance.md) checks their versioned fields. Provider-specific configuration and full nested constraints remain unvalidated.
- A 401 or 403 reads as absent. Google requires public access, but a WAF in front of every unknown path also answers 403, and that is not evidence of a profile.

## Implementation deviations

- This audit replaces the `/.well-known/ucp` half of `agent-interfaces/mcp-discovery`, which read the profile as MCP discovery. Google reads it as a commerce profile, so it moved to `agentic-commerce` with its own grade.
- The reader lives in `_ucp.ts` beside the audit and exports `NO_UCP_PROFILE`, which enrols the audit in `absent-artifact-contract.test.ts`.
- 2026-10-19 review: a service whose value is `null`, a scalar, an empty array or only non-object items no longer counts as a service. A probe with `{"dev.ucp.shopping": null}`, `[]` or `[42]` passed before. Such a profile now fails when no service has a readable binding. A malformed entry beside readable ones warns and names the entry, and `details.services` counts only services with a readable binding.
- 2026-10-18 second review: a profile whose bindings declare no endpoint at all still passes. The UCP specification marks `endpoint` Optional for every transport (rest, mcp, a2a, embedded), so warning would claim a requirement the spec does not make. `details.endpoints` reports how many bindings declare one. The binding reader (`ucpBindings` in `_ucp.ts`) is shared with MCP discovery, which now reads both profile shapes and resolves a relative endpoint against the profile URL. A non-object `ucp` key gets its own failure message.
- 2026-10-18 review: grade A to B, because Google's page says "will enable" and the integration is a pilot. A JSON body with no `ucp` key now reads as absent: a real-site scan found a server that answers every `/.well-known/*` path with one unrelated JSON document, and the audit failed it. An endpoint-less binding and missing capabilities are no longer warned, following the UCP specification. The 2026-01-11 shape and the `keys` array are read.
