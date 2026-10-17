---
audit: agent-interfaces/openapi-description-quality
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/openapi-description-quality.ts
slug: openapi-description-quality
evidence_grade: A
disposition: "keep — fix required"
reviewed: 2026-08-21
sources:
  - fastmcp-openapi
  - openai-gpt-actions-intro
  - anthropic-tool-use-overview
  - mcp-server-tools
  - openapi-31-spec
---

# openapi-description-quality (`5.26`)

> agent-tools · source `openapi-description-quality.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

## What it checks

When an AI agent converts your OpenAPI spec into callable tools, the description fields become the prompt the LLM uses to decide when and how to call each function. A one-word description like "search" tells the model nothing about what the endpoint does, what the parameter means, or what values are valid — so the agent guesses, calls the wrong tool, or fills parameters with hallucinated values. Every operation and every parameter needs a verbose description (more than 15 characters) that explains purpose, expected input, and behavior.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Evidence (2026-08-21)

**Mechanism claim:** When an OpenAPI document is converted into LLM-callable tools, the `description` text on the operation and its parameters becomes the tool and argument descriptions the model reads. It reads them when deciding which endpoint to call and what to pass. An operation with no human-readable text leaves the model with only the operationId to reason from.

**Grade: A** — every link in the chain is documented by a vendor: named converters map OpenAPI descriptions onto tool descriptions, and both OpenAI and Anthropic state that the model picks the call from those descriptions.

**Evidence:**

- FastMCP's OpenAPI integration "creates MCP components using a variety of metadata from the OpenAPI spec, such as incorporating the OpenAPI description into the MCP component description", and derives the tool name from the `operationId` — https://gofastmcp.com/integrations/openapi (verified 2026-08-21)
- OpenAI GPT Actions consume an OpenAPI schema and "decide which API call is relevant to the user's question and generate the json input necessary for the API call" — https://developers.openai.com/api/docs/actions/introduction (verified 2026-08-21)
- Anthropic states the consuming behavior plainly: "Claude determines when to call a tool based on the user's request and the tool's description" — https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview (verified 2026-08-21)
- MCP's tool shape confirms where that text lands: `description` is the "Human-readable description of functionality", and per-property descriptions live in the `inputSchema` — https://modelcontextprotocol.io/specification/2025-06-18/server/tools (verified 2026-08-21)

**Counter-evidence:** The mechanism is proven for the _described text_, not for the `description` key specifically. OpenAPI 3.1 defines `summary` as "A short summary of what the operation does", alongside `description`, "A verbose explanation of the operation behavior"; many specs carry only the former. The same document confirms that path-level `parameters` are inherited by operations — they "can be overridden at the operation level, but cannot be removed there" — and that parameters may be `$ref`-ed into `components/parameters` — https://spec.openapis.org/oas/v3.1.0.html (verified 2026-08-21). A spec that is perfectly legible to a converter can therefore score 0% here. Nothing in any source supports the specific 15-character threshold, which measures length rather than informativeness.

## Implementation deviations

**2026-08-29 — enrolled in the absent-artifact contract.** This audit already
declined a site that publishes no OpenAPI document, and every dossier in the
family cites it as proof that a `scored` audit is free to decline. It said so
in its own private sentence, though, so
`packages/core/src/tests/absent-artifact-contract.test.ts` — which keys on the
shared `NO_OPENAPI_SPEC` constant — did not hold it. Someone could have flipped
this branch to `fail` with that suite still green. It now reads the shared
constant, so the exemplar is held to the rule it is cited for. The decline
message changed wording; the verdict did not.

**The `paths` traversal moved to `packages/core/src/gatherers/openapi.ts`.**
This file carried a private copy of the walk and of the HTTP-method list, which
is the drift the shared module exists to end. No verdict moved: a document with
no readable operation still yields zero checkable items and still returns
`notApplicable`. This audit deliberately does not fail a malformed `paths` the
way `openapi-endpoints`, `openapi-schemas` and `openapi-operation-ids` now do —
its graded mechanism is the quality of text that is present, and no source
documents a description-quality consumer that is worse off for a broken `paths`
than for an absent one.
