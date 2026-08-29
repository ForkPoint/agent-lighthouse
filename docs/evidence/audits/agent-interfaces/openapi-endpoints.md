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

## Code review findings (2026-08-20, 11-agent pass)

Measures whether the spec found by 5.1 has at least one operation — a thin derivative of 5.1 that mostly re-reports the same fact, and does so through a private copy of getOpenApiSpec() that (unlike 5.1) cannot read YAML, guaranteeing contradictory results on YAML-only sites.

**Required fix:** Move to the shared `_openapi.ts` loader so YAML and non-root specs resolve identically to 5.1; return `notApplicable()` (not `fail`) when no spec exists so the absence is charged exactly once, by 5.1; resolve `$ref` path items and count OpenAPI 3.1 `webhooks`. Consider folding the operation count into 5.1's result as a detail rather than keeping a separate scored audit.

**False-positive risks:**
- Local `getOpenApiSpec()` (lines 22-31) reads only `/openapi.json`. A site with a valid `/openapi.yaml` passes 5.1 and fails here with 'No parseable OpenAPI JSON spec found' — two audits, one input, opposite verdicts.
- `getOperations()` does not resolve `$ref` path items (`"/pets": {"$ref": "#/components/pathItems/Pets"}`, legal in OpenAPI 3.1) or webhooks; such specs report '0 operations'.
- Hard `fail` at `high` priority when no spec exists at all — duplicating 5.1's zero and double-penalizing the same absence.
- Passing is trivially easy and near-meaningless: any spec that exists at all almost always has ≥1 operation, so the audit adds no discriminating information beyond 5.1.

**Test gaps:**
- No YAML-spec fixture demonstrating the divergence from 5.1
- No `$ref` path-item fixture
- No OpenAPI 3.1 `webhooks` fixture
- No fixture with a spec containing only `components` (a valid shared-schema-only spec)

**Overlaps with:** `5.1`, `5.3`, `5.6`, `5.26`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
- 2026-08-21 — evidence graded (see below).

## Evidence (2026-08-21)

**Mechanism claim:** A tool-calling runtime creates one callable function per OpenAPI path operation, so a document whose `paths` object contains no operations exposes zero actions to the agent that ingests it.

**Grade: B** — the operation-to-function conversion is documented consumer behavior at two named agents, but the path is only proven once a developer registers the document, and the audit's own discovery leg is the C-grade claim recorded in `5.1`.

**Evidence:**
- Microsoft 365 Copilot builds one function per operation, then selects among them by path description. "Operation IDs are unique identifiers for an operation in the API and are used by Copilot to create functions that are executed when responding to a user's prompt." The document continues: "it searches through the descriptions of the paths to determine the endpoint to use to satisfy the user's request" — https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/openapi-document-guidance (verified 2026-08-21)
- OpenAI GPT Actions expose the schema's operations as the actions ChatGPT may invoke: "ChatGPT uses those names and descriptions to understand (a) which API action should be called and (b) which parameter should be used" — https://developers.openai.com/api/docs/actions/getting-started (verified 2026-08-21)
- The Path Item / Operation Object is the unit of the described API surface in OpenAPI 3.1 — https://spec.openapis.org/oas/v3.1.0.html (verified 2026-08-21)

**Counter-evidence:** The measured state is close to unobservable in the wild. A published spec with a `paths` object but no operation objects is rare. No adoption or effect data distinguishes passing from failing here, beyond what `5.1` already establishes. OpenAPI 3.1 also lets a document declare its surface through `webhooks` or `$ref`-ed path items, so "zero operations" as this audit counts them does not always mean zero agent-callable actions.

## Implementation deviations

**2026-08-29 — absence is `notApplicable`, not `fail`.** This dossier's own
required fix asked for it in 2026-08-20: *"return `notApplicable()` (not
`fail`) when no spec exists so the absence is charged exactly once, by 5.1"*.
It is now done. A site that publishes no OpenAPI document gets no verdict from
this audit and the audit carries no weight there.

A menu with no items is still a finding: a document that exists and declares
no operations still `fail`s, and that is the check the grade B is for.

**Present and broken is not absent.** `paths` is classified in one place,
`readOpenApiPaths` in `gatherers/openapi.ts`. It separates what it could read
from what was defective, and the verdict follows what survives:

- Nothing readable and something broken — `paths` is not a Paths Object, or
  every entry under it is defective — is `malformed`. It `fail`s, and the
  report names the defect in `found` instead of calling it "0 operations".
- At least one readable operation is graded on the operations it read. The
  defects are named in the message and counted in `found`; they do not change
  the verdict. Released `main` passed such a document on its readable
  operations and so does this audit.
- Nothing broken and nothing declared is `empty`, and `{"/x": {}}` is legal
  OpenAPI that lands there.

A defect counts at either level: a non-object where a Path Item Object belongs
and a non-object where an Operation Object belongs are the same error one level
apart. Specification-extension keys (`x-`) are skipped rather than judged —
OpenAPI 3.1 §4.8.8 lets them hold any value — and inside a path item only the
eight method keys are judged, because `summary`, `parameters`, `servers` and
`$ref` are legal members that are not Operation Objects.

**The read moved to `packages/core/src/gatherers/openapi.ts`**, shared with the
six other audits that had a byte-identical copy of it. The precondition lives
beside the read; `gatherers/openapi.ts` records why it is not a runner
precondition and not an `EvidenceKey`.

**A 200 with an unparseable body is treated as an absence**, because it is a
document this audit never read. `agent-interfaces/openapi-exists` reports a
spec advertised but unreadable, once.

**The decline says what was observed.** The shared `notApplicable` line reads
"No readable OpenAPI document at /openapi.json". The read also comes back empty
for a 200 whose body will not parse, and a site that publishes a broken
document has not published none.

## Deferred

The rest of the required fix stands: the shared read is still JSON-only, so the
YAML divergence from `openapi-exists` is unchanged, and `$ref` path items and
OpenAPI 3.1 `webhooks` are still uncounted.
