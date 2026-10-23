---
check: behavior-annotation-coverage-and-claim-consistency
title: "MCP Annotation Claim Consistency"
domain: mcp-server-quality
status: proposed
evidence_grade: A
uniqueness: unique
difficulty: llm-assisted
scoring_tier: informative (weight 0)
reviewed: 2026-10-19
consumers:
  - Claude (Anthropic) — read-only tools run without per-call confirmation; destructive tools always prompt
  - VS Code (Microsoft) — asks for confirmation before every MCP tool call unless the tool sets `readOnlyHint`
  - ChatGPT Directory plugins (OpenAI) — require explicit boolean `readOnlyHint`, `destructiveHint` and `openWorldHint` on every tool; automated review flags annotation issues
---

# MCP Annotation Claim Consistency

> Proposed check. Evidence grade **A** · unique · implementation: `llm-assisted`

## What it checks

For tools returned by `tools/list`, whether a behaviour hint conflicts with
the tool's declared name and description. A candidate finding asks an owner to
review that claim. It does not prove what the tool does.

Annotation coverage already ships in
[`agent-interfaces/mcp-tool-annotation-coverage`](../../audits/agent-interfaces/mcp-tool-annotation-coverage.md).
It is not part of the remaining work.

## Prerequisites

The scanner has no model judge. Before implementation, define its input limits,
output schema, abstention rules and evaluation against human-labelled cases.
Treat tool metadata as untrusted input.

## Claimed mechanism (falsifiable)

Hosts use annotations when deciding whether a tool call needs confirmation.
The effect depends on server trust, sandboxing and the host's approval policy.
An incorrect read-only hint can affect that decision where the host relies on
it. A name or description alone cannot prove a tool's actual side effects.

## Evidence

- Anthropic's connector review criteria: "Every tool must include a title and the applicable hint: readOnlyHint: true for read-only tools, and destructiveHint: true for tools that modify or delete data. These determine auto-permissions in Claude. Read-only tools can run without per-call confirmation, and destructive tools always prompt." — https://claude.com/docs/connectors/building/review-criteria (verified 2026-10-19)
- Anthropic's submission page: the portal "flags tools that are missing them", and "review criteria explain how reviewers read tool names and descriptions" — https://claude.com/docs/connectors/building/submission (verified 2026-10-19)
- VS Code registers each MCP tool with `canRequestPreApproval: !tool.definition.annotations?.readOnlyHint`. When `readOnlyHint` is not set, it builds a "Run {0}" confirmation for the call. Proof pointer: `mcpLanguageModelToolContribution.ts` — https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/mcp/common/mcpLanguageModelToolContribution.ts (verified 2026-10-19)
- OpenAI's plugin guidelines: "Set `readOnlyHint`, `destructiveHint`, and `openWorldHint` to explicit boolean values (`true` or `false`) in each tool's `annotations` object." "If our automated review flags an annotation issue, you can submit an appeal". The guidelines also define which verbs make a tool destructive, such as "deletion, overwriting, cancellation, access revocation" — https://developers.openai.com/plugins/plugin-guidelines (verified 2026-10-19; the old Apps SDK submission-guidelines URL redirects here)
- OpenAI's reference lists all three hints as "Required". `destructiveHint` exists "so the host knows to elicit explicit approval first" — https://developers.openai.com/plugins/reference (verified 2026-10-19; redirected from the Apps SDK reference)
- MCP 2026-07-28 `schema.ts`, `ToolAnnotations`: `readOnlyHint` "Default: false", `destructiveHint` "Default: true", `idempotentHint` "Default: false", `openWorldHint` "Default: true". The type is documented as hints only: "Clients should never make tool use decisions based on `ToolAnnotations` received from untrusted servers." — https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/schema/2026-07-28/schema.ts (verified 2026-10-19)
- MCP 2026-07-28 tools page: "clients **MUST** consider tool annotations to be untrusted unless they come from trusted servers." — https://modelcontextprotocol.io/specification/2026-07-28/server/tools (verified 2026-10-19)

## What is inference

- That a model judge can detect contradictions with useful precision. No source measures this. Anthropic and OpenAI both review annotations against names and descriptions, but neither documents its method.
- That a given contradiction is a defect. The scanner cannot run the tool, so it cannot prove a hint false. A finding can only say "review this claim".

## Counter-evidence and limits

- The spec tells clients not to trust annotations from untrusted servers. A host that follows this ignores the hints for such servers, and coverage then changes nothing for it. Claude and VS Code, per the sources above, do act on them.
- VS Code builds its confirmation message only for servers that are not sandboxed. For sandboxed servers the hints do not drive that message. What the host then shows is not traced here.

## Competitor coverage

Anthropic's and OpenAI's directory reviews check annotations, but only for servers submitted to them. Some MCP security scanners look for prompt injection in descriptions, which is a different question. No site-audit tool checks annotation consistency.

## Implementation sketch

Only claim consistency remains:

1. Read the shared `tools/list` results. Do not duplicate coverage counts.
2. Pass bounded `{name, title, description, inputSchema property names, annotations}`
   to the judge as untrusted data. A verb match may select a review candidate;
   it must not establish a mutation or a defect on its own.
3. Require a structured result and the exact supporting text. Allow abstention
   when the description does not establish the claim. Report only
   "review this claim", never an automatic failure.
4. Test hostile descriptions and compare findings with human-labelled cases.
   Define the required precision before release. Agreement between two model
   passes does not establish correctness.

## Example finding

A tool named `void_transaction` describes canceling a pending transaction but
sets `readOnlyHint: true`. Report the description and hint for owner review.
Do not claim that the tool mutates state or bypasses confirmation without
runtime evidence and the host's approval conditions.

## Scoring

Tier: **informative (weight 0)** until the judge's precision is measured. The mechanism is grade A. The method is unproven. A false "contradiction" finding would send owners to change correct hints.

## Implementation deviations

- Coverage graduated to its own informative audit on 2026-10-19. The verb rule
  did not ship; it remains a possible candidate selector for claim review.
- Re-grading `agent-interfaces/mcp-endpoint` was considered and declined. Its
  other verdicts still rest on grade C evidence, as its shipped dossier records.

## Deferred

- Add model support and evaluate the judge on labelled cases before release.
- Set any scoring proposal only after measurement of judge precision and review
  of the population the consumer evidence covers.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
- 2026-10-19 — evidence review. Grade C raised to A. The stated prerequisite is met: `schema.ts` for 2026-07-28 confirms the four hints and their defaults are unchanged. Added three consumers with primary sources: Anthropic's connector review criteria, VS Code's MCP tool contribution source, and OpenAI's plugin guidelines and reference. Recorded that `agent-interfaces/mcp-endpoint` already ships the readOnlyHint coverage half. The blocker is the model judge, not the evidence.
- 2026-10-19 — Phase 1 coverage graduated as `agent-interfaces/mcp-tool-annotation-coverage` (grade A, informative since the same day). The phase-1 verb rule was not shipped; it judges a claim and stays with the phase-2 judge. This proposal now covers the consistency judgement only.

- 2026-10-23 — removed shipped coverage from the implementation plan; narrowed approval claims and added judge validation requirements.
