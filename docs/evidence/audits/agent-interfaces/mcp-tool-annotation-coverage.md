---
audit: agent-interfaces/mcp-tool-annotation-coverage
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/mcp-tool-annotation-coverage.ts
slug: mcp-tool-annotation-coverage
evidence_grade: A
tier: informative
disposition: "new in 9.0.0 — coverage half graduated from the behavior-annotation-coverage-and-claim-consistency proposal 2026-10-19"
reviewed: 2026-10-19
graduated: 2026-10-19
consumers:
  - Claude (Anthropic) — read-only tools run without per-call confirmation; destructive tools always prompt
  - VS Code (Microsoft) — asks for confirmation before an MCP tool call unless the tool sets a truthy `readOnlyHint`
  - ChatGPT Directory plugins (OpenAI) — require explicit boolean `readOnlyHint`, `destructiveHint` and `openWorldHint` on every tool
sources:
  - claude-connector-review-criteria
  - claude-connector-submission
  - vscode-mcp-tool-confirmation
  - openai-plugin-guidelines
  - openai-plugins-reference
  - mcp-schema-2026-07-28-tool-annotations
  - S4
---

# MCP tool behaviour hints present

> New in 9.0.0. Evidence grade **A** · informative tier · implementation: `static-fetch`

## What it checks

For each tool the site's declared MCP server lists in `tools/list`, whether its `annotations` object carries the behaviour hints as booleans.

| State                                                                                        | Result          |
| :------------------------------------------------------------------------------------------- | :-------------- |
| every tool carries boolean `readOnlyHint`, `destructiveHint` and `openWorldHint`             | `pass`          |
| every tool carries a boolean `readOnlyHint` or `destructiveHint`, but some lack the full set | `warn`          |
| at least one tool carries neither a boolean `readOnlyHint` nor a boolean `destructiveHint`   | `fail`          |
| no declared MCP endpoint, a sign-in wall on `tools/list`, or no tools listed                 | `notApplicable` |

`idempotentHint` coverage is reported in `details` and never graded. No consumer below requires it.

## Claimed mechanism (falsifiable)

Hosts decide from these hints whether to ask the user before a tool call. Claude runs a tool marked read-only without asking and always asks before a destructive one. VS Code asks before any call to a tool whose `readOnlyHint` is not truthy. Hosts therefore treat a tool with no hints as possibly destructive and ask before every call, including calls to tools that only read. For a tool that writes data, that prompt is the expected behaviour, so the prompt alone does not separate `fail` from `warn`.

The Claude and ChatGPT directory reviews require a hint on servers submitted to them. OpenAI requires all three hints as explicit booleans on every tool of a plugin in the ChatGPT Directory, and its automated review flags annotation issues.

## Evidence

- Anthropic's connector review criteria: "Every tool must include a title and the applicable hint: readOnlyHint: true for read-only tools, and destructiveHint: true for tools that modify or delete data. These determine auto-permissions in Claude. Read-only tools can run without per-call confirmation, and destructive tools always prompt." — https://claude.com/docs/connectors/building/review-criteria (verified 2026-10-19)
- Anthropic's submission page: the portal "flags tools that are missing them" — https://claude.com/docs/connectors/building/submission (verified 2026-10-19)
- VS Code registers each MCP tool with `canRequestPreApproval: !tool.definition.annotations?.readOnlyHint`, and builds a "Run {0}" confirmation for the call whenever `readOnlyHint` is not truthy. A tool with `readOnlyHint: false` and a tool with no hints get the same prompt. Proof pointer: `mcpLanguageModelToolContribution.ts` — https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/mcp/common/mcpLanguageModelToolContribution.ts (verified 2026-10-19)
- OpenAI's plugin guidelines, for plugins in the ChatGPT Directory: "Set `readOnlyHint`, `destructiveHint`, and `openWorldHint` to explicit boolean values (`true` or `false`) in each tool's `annotations` object." "If our automated review flags an annotation issue, you can submit an appeal" — https://developers.openai.com/plugins/plugin-guidelines (verified 2026-10-19)
- OpenAI's reference lists all three hints as "Required". `destructiveHint` exists "so the host knows to elicit explicit approval first" — https://developers.openai.com/plugins/reference (verified 2026-10-19)
- MCP 2026-07-28 `schema.ts`, `ToolAnnotations`: `readOnlyHint` "Default: false", `destructiveHint` "Default: true", `idempotentHint` "Default: false", `openWorldHint` "Default: true" — https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/schema/2026-07-28/schema.ts (verified 2026-10-19)

**Grade: A** — three vendors document consuming these hints. Anthropic and OpenAI state it in their own documentation, and VS Code's source shows the confirmation gate. The grade is the strongest proven consumer path, and that path is documented. What the evidence does not cover is the population: the requirements bind servers submitted to the directories, so the audit ships informative. The `fail` line rests on both directory requirements: a tool with neither a read-only nor a destructive hint misses Anthropic's and OpenAI's. The `warn` line rests on OpenAI alone, which is why it is a warning and not a failure.

## Limits

- The MCP tools page says "clients **MUST** consider tool annotations to be untrusted unless they come from trusted servers" — https://modelcontextprotocol.io/specification/2026-07-28/server/tools (verified 2026-10-19). A host that follows this for an untrusted server ignores the hints, and coverage changes nothing for it. Claude and VS Code, per the sources above, do act on them.
- The audit checks presence, not truth. A mutating tool that claims `readOnlyHint: true` passes. Judging hints against names and descriptions is the other half of the proposal and needs a model.
- VS Code builds its confirmation message only for servers that are not sandboxed. What it shows for sandboxed servers is not traced here.
- The directory requirements apply only to servers submitted to the Claude Connectors Directory or the ChatGPT Directory. The audit cannot know whether a server was submitted. No source documents a cost for a server outside the directories.
- Runtime hosts only ask the user before a call. For a tool that writes data, that prompt is the expected behaviour, not a defect.
- `discoverMcpEndpoint` also follows UCP `transport: "mcp"` bindings. An endpoint found that way is often run by a commerce platform, not by the site, and the site cannot change its tool annotations.

## Example failure

A store's MCP server lists `search_products`, `add_to_cart` and `cancel_order` with no `annotations` at all. Hosts treat all three as possibly destructive and ask before every call, including every product search. If the server is submitted to the Claude or ChatGPT directory, the review requires each tool to declare whether it reads, changes or deletes data.

## How it scores

Tier: **informative (weight 0)**. Weight comes from `weightForGrade`, which returns 0 outside the scored tier. The evidence is grade A, but it covers a narrower population than the audit can select. The hint requirements apply to servers submitted to the Claude Connectors Directory or the ChatGPT Directory, and the audit cannot know whether a server was submitted. Endpoints found through UCP are often run by a commerce platform, not by the site. Runtime hosts only ask before a call, which is the expected behaviour for a tool that writes data. The audit still reports `fail`, `warn` and `pass`; none of them moves the score.

## Implementation deviations

- The tool list comes from the shared `listTools` cache in `gatherers/mcp.ts`, the same pages `mcp-tool-contract-validity` and `mcp-tool-description-coverage` read. The audit adds no fetch. At most four pages are read, and `details.pagesTruncated` reports a cut.
- Only a boolean counts. `null`, strings and numbers are not hints.
- Anthropic's floor is "the applicable hint": `readOnlyHint: true` or `destructiveHint: true`. The audit accepts either hint with any boolean value as that floor, because a tool that sets `readOnlyHint: false` has made an explicit claim a host can act on.
- `agent-interfaces/mcp-endpoint` (grade C, informative, weight 0) still warns when a tool lacks a boolean `readOnlyHint`. The two findings can appear together. Neither carries weight.
- The endpoint comes from `discoverMcpEndpoint`, as for the other tool audits. A malformed declaration is `notApplicable` here; `mcp-endpoint` reports it.

## Deferred

- The claim-consistency judge (does a hint contradict the tool's name and description) stays in [the proposal](../../proposals/mcp-server-quality/behavior-annotation-coverage-and-claim-consistency.md). It needs a model and a measured precision.
- The name-based verb selector in the proposal (a `delete_*` tool claiming `readOnlyHint: true`) was not shipped. It selects a claim for review, not a presence check, and belongs with the judge.
- Removing the readOnlyHint branch from `mcp-endpoint` now that this audit reports it. That is a verdict change to a shipped audit and is left to its own change.
- The `title` Anthropic also requires is not checked here. `mcp-tool-description-coverage` reports title coverage as an advisory ratio.

## Review history

- 2026-10-19 — graduated from the proposal after the 2026-10-19 evidence review raised it to grade A. The review's quotes and verification dates are used unchanged.
- 2026-10-19 — moved from scored to informative (weight 0) after independent review. The directory hint requirements cover only servers submitted to the Claude Connectors Directory or the ChatGPT Directory, which the audit cannot detect. UCP-discovered endpoints are often a commerce platform's server the site cannot change. Runtime hosts only prompt, which is expected for a tool that writes data. The VS Code claim was corrected: it prompts whenever `readOnlyHint` is not truthy, so the prompt does not separate `fail` from `warn`. OpenAI's wording was aligned to plugins in the ChatGPT Directory. Grade A is kept.
