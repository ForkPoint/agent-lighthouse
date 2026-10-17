---
audit: agent-interfaces/openapi-servers
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/openapi-servers.ts
slug: openapi-servers
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - openai-gpt-actions-openapi
  - ms-copilot-api-plugins
  - openapi-31-spec
---

# openapi-servers (`5.5`)

> agent-tools · source `openapi-servers.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

## What it checks

Without a servers array, AI agents do not know the base URL for your API. They cannot construct valid request URLs, rendering the entire spec unusable. Add at least your production server URL.

## Example failure

A site publishes `/openapi.json` describing three endpoints and omits the
`servers` array, or lists one whose only entry has a `description` and no
`url`. An agent has the operations but no base URL to join them to, so it
cannot address a single request.

A site that publishes no OpenAPI document at all is **not** a failure here.
This audit judges a document's contents; with no document, it returns
"not applicable" and takes no weight off the score.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** An agent runtime builds each request URL by joining a `servers[].url` entry with the operation path, so a spec whose servers entries yield no resolvable base URL produces requests the agent cannot address.

**Grade: B** — that agents resolve requests against the declared server URL is documented at named consumers. But the specification supplies a legal default, `/`, when the array is absent. The liveness probe this audit performs has no documented consumer at all.

**Evidence:**

- OpenAI GPT Actions schemas declare the API location in the servers array (`servers: - url: https://api.weather.gov`), which is where the built action sends its calls — https://developers.openai.com/api/docs/actions/getting-started (verified 2026-08-21)
- Microsoft 365 Copilot treats the servers section as the domains an API plugin declares. "The Copilot runtime … doesn't evaluate it against any domains the plugin declares (such as the `servers` section of an API plugin's OpenAPI description)" — https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/overview-api-plugins (verified 2026-08-21)
- OpenAPI 3.1 Server Object defines `url` as the base URL for the API, supports relative URLs and `{variable}` templating with `variables` defaults — https://spec.openapis.org/oas/v3.1.0.html (verified 2026-08-21)

**Counter-evidence:** Strong, on the half of the signal the code actually weights. OpenAPI 3.1 states: "If the `servers` property is not provided, or is an empty array, the default value would be a Server Object with a `url` value of `/`." An absent servers array is therefore legal, and resolvable against the document's own location. It is not the fatal condition the audit's copy claims. No vendor documentation treats a bare `GET` on the base URL as a validity test. `401`, `403`, `404` and `405` are ordinary healthy responses at an API root. Templated server URLs such as `https://{region}.api.example.com`, and relative ones such as `/api`, are legal forms that cannot be fetched literally. The reachability leg of this signal is therefore unsupported; only the structural leg (a parseable base URL is declared or derivable) carries the B.

## Implementation deviations

- No OpenAPI document, or a 200 whose body does not parse, is `notApplicable`. `openapi-exists` reports an unreadable spec.
- A document with no `servers` array still fails, though OpenAPI 3.1 defaults it to `/`. See Deferred.
- Only the first server with a `url` is probed, with a GET on the base URL. 2xx and 3xx pass; any other status or no answer warns.

## Deferred

- The shared read is JSON-only, so a YAML-only spec is invisible here.
- The dossier's required fix: treat a missing `servers` array as `/`, probe a concrete path rather than the base URL, accept 401, 403 and 405, and skip templated and relative URLs.
