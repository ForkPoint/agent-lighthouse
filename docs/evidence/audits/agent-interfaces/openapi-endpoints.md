---
audit: agent-interfaces/openapi-endpoints
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/openapi-endpoints.ts
slug: openapi-endpoints
evidence_grade: B
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - ms-copilot-openapi-guidance
  - openai-gpt-actions-openapi
  - openapi-31-spec
---

# openapi-endpoints (`5.2`)

> agent-tools · source `openapi-endpoints.ts` · review verdict **fix** · evidence grade **B** · disposition: **keep — fix required**

## What it checks

An OpenAPI spec without endpoints is like a menu with no items. AI agents need at least one path with an operation to know what actions they can perform on your site. Add your most important endpoints first.

## Example failure

A site publishes `/openapi.json` carrying `info`, `components` and an empty
`paths` object. An agent reads a valid document and finds zero actions it can
take.

A site that publishes no OpenAPI document at all is **not** a failure here.
This audit judges a document's contents; with no document, it returns
"not applicable" and takes no weight off the score.

A document whose `paths` is present and yields nothing readable fails too, and
the report names the defect. `"paths": ["get","post"]` puts a string where a
path item belongs; `{"/x": {"get": "yes"}}` puts one where an operation
belongs. Absent means absent; present-and-broken is a finding.

One broken entry does not erase the operations beside it. A document with
twenty working operations and one `null` path item passes on its twenty, and
the skipped entry is named in the report. A path item that is legal and
declares nothing — `{"/x": {}}` — is an empty document, not a broken one.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** A tool-calling runtime creates one callable function per OpenAPI path operation, so a document whose `paths` object contains no operations exposes zero actions to the agent that ingests it.

**Grade: B** — the operation-to-function conversion is documented consumer behavior at two named agents, but the path is only proven once a developer registers the document, and the audit's own discovery leg is the C-grade claim recorded in `5.1`.

**Evidence:**

- Microsoft 365 Copilot builds one function per operation, then selects among them by path description. "Operation IDs are unique identifiers for an operation in the API and are used by Copilot to create functions that are executed when responding to a user's prompt." The document continues: "it searches through the descriptions of the paths to determine the endpoint to use to satisfy the user's request" — https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/openapi-document-guidance (verified 2026-08-21)
- OpenAI GPT Actions expose the schema's operations as the actions ChatGPT may invoke: "ChatGPT uses those names and descriptions to understand (a) which API action should be called and (b) which parameter should be used" — https://developers.openai.com/api/docs/actions/getting-started (verified 2026-08-21)
- The Path Item / Operation Object is the unit of the described API surface in OpenAPI 3.1 — https://spec.openapis.org/oas/v3.1.0.html (verified 2026-08-21)

**Counter-evidence:** The measured state is close to unobservable in the wild. A published spec with a `paths` object but no operation objects is rare. No adoption or effect data distinguishes passing from failing here, beyond what `5.1` already establishes. OpenAPI 3.1 also lets a document declare its surface through `webhooks` or `$ref`-ed path items, so "zero operations" as this audit counts them does not always mean zero agent-callable actions.

## Implementation deviations

- No OpenAPI document is `notApplicable`. `openapi-exists` charges the absence once.
- A 200 whose body does not parse is also treated as absent. `openapi-exists` reports the unreadable spec.
- A document that declares no operations fails. That is the check grade B is for.
- `paths` is classified by `readOpenApiPaths` in `gatherers/openapi.ts`:
  - nothing readable and something broken is `malformed` and fails, naming the defect;
  - at least one readable operation is graded on what was read, with defects named but not changing the verdict;
  - nothing broken and nothing declared is `empty`. `{"/x": {}}` lands there.
- A non-object path item and a non-object operation are both defects. `x-` keys are skipped. Inside a path item only the eight method keys are judged.

## Deferred

- The shared read is JSON-only, so a YAML-only spec is invisible here.
- `$ref` path items and OpenAPI 3.1 `webhooks` are not counted.
