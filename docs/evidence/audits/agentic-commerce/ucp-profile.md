---
audit: agentic-commerce/ucp-profile
category: agentic-commerce
source_file: packages/core/src/audits/agentic-commerce/ucp-profile.ts
slug: ucp-profile
evidence_grade: A
disposition: "new 2026-10-18 — split out of agent-interfaces/mcp-discovery"
reviewed: 2026-10-18
public_extra:
  - Limits
recommended_tier: scored
consumers:
  - Google Merchant UCP integration
sources:
  - google-merchant-ucp-profile
  - google-merchant-ucp-publish-profile
---

# ucp-profile

> agentic-commerce · source `ucp-profile.ts` · evidence grade **A** · tier **scored** (weight 1.0)

## What it checks

Whether the Universal Commerce Protocol business profile at `/.well-known/ucp` can be read in the shape Google documents.

| State                                                         | Verdict       |
| :------------------------------------------------------------ | :------------ |
| No 200, an HTML page answering for the path, or an empty body | notApplicable |
| 401 or 403                                                    | notApplicable |
| Body is not a JSON object                                     | fail          |
| No top-level `ucp` object                                     | fail          |
| `ucp.services` missing or empty                               | fail          |
| `ucp.version` missing                                         | warn          |
| `ucp.capabilities` missing or empty                           | warn          |
| A service binding has no absolute https `endpoint`            | warn          |
| All of the above present                                      | pass          |

## Claimed mechanism (falsifiable)

Google fetches the profile at `/.well-known/ucp` to negotiate which UCP version and checkout capabilities the store supports, and where to send requests. A profile Google cannot parse, or one with no services, gives Google no endpoint to call.

## Evidence

- "Your UCP profile (known as business profile in UCP) will enable Google to efficiently negotiate capabilities with your server. This profile is a JSON file that you host on your server at the well-known path: /.well-known/ucp. It's crucial for integrating with Google" — https://developers.google.com/merchant/ucp/guides/overview/ucp-profile (verified 2026-10-18)
- The same page: the profile declares capabilities, specifies versions, provides endpoints ("Tells Google where to send API requests"), configures payment handling and shares public keys. It "must be publicly accessible and not require any authentication."
- Google's example puts `version`, `services` and `capabilities` inside a `ucp` object, with each service listing bindings that carry an `endpoint`. "The ucp object contains protocol metadata: version, services, and capabilities" — https://developers.google.com/merchant/ucp/implementation/2026-04-08/publish-profile (verified 2026-10-18)

**Counter-evidence:** The consumer is one vendor's checkout integration, and it reads the profile of merchants enrolled in it. No other AI vendor documents reading `/.well-known/ucp`.

## Scoring

**Grade: A** — documented consumer behaviour. Google names the path and says it reads the profile to negotiate capabilities. The audit scores only stores that publish a profile, so a site outside UCP loses nothing.

- A profile Google cannot read, or one that names no service, fails at high priority.
- A missing version, missing capabilities or a non-https endpoint warns.

## Example failure

```json
{
  "services": {
    "dev.ucp.shopping": [{ "endpoint": "https://shop.example/ucp" }]
  }
}
```

The services sit at the top level, not inside a `ucp` object, so the profile does not match Google's format.

## Limits

- `signing_keys` is counted in `details.signingKeys` but not judged. Google says the keys verify webhooks and other signed messages; it does not say a profile without them is rejected.
- Capability entries and payment handlers are not validated against the UCP schemas.
- A 401 or 403 reads as absent. Google requires public access, but a WAF in front of every unknown path also answers 403, and that is not evidence of a profile.

## Implementation deviations

- This audit replaces the `/.well-known/ucp` half of `agent-interfaces/mcp-discovery`, which read the profile as MCP discovery. Google reads it as a commerce profile, so it moved to `agentic-commerce` with its own grade.
- The reader lives in `_ucp.ts` beside the audit and exports `NO_UCP_PROFILE`, which enrols the audit in `absent-artifact-contract.test.ts`.
