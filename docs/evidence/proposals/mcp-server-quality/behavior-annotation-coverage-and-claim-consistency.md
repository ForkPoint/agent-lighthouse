---
check: behavior-annotation-coverage-and-claim-consistency
title: "Behavior Annotation Coverage and Claim Consistency"
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
  - ChatGPT apps (OpenAI) — require explicit boolean `readOnlyHint`, `destructiveHint` and `openWorldHint` on every tool; automated review flags annotation issues
---

# Behavior Annotation Coverage and Claim Consistency

> Proposed check. Evidence grade **A** · unique · implementation: `llm-assisted`

## What it checks

Two things about the tools an MCP server lists:

1. Coverage: how many tools carry boolean behaviour hints (`readOnlyHint`, `destructiveHint`, `openWorldHint`).
2. Consistency: whether a hint contradicts the tool's own name and description. Example: a tool named `delete_*` that sets `readOnlyHint: true`.

## Claimed mechanism (falsifiable)

Hosts decide whether to ask the user before a tool call from these hints. Claude runs a tool marked read-only without asking, and always asks before a destructive one. VS Code asks before any tool that does not set `readOnlyHint`. So a missing hint costs a prompt on every call. A wrong `readOnlyHint: true` on a mutating tool lets that tool run without a prompt.

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

## Overlap with shipped audits

`agent-interfaces/mcp-endpoint` already reports how many listed tools carry a boolean `readOnlyHint`. It is graded C, informative. The sources above document a consumer for that half. Re-grading it is a separate change to a shipped audit and is not made here.

What this proposal adds is the consistency judgement and coverage of `destructiveHint` and `openWorldHint`.

## Competitor coverage

Anthropic's and OpenAI's directory reviews check annotations, but only for servers submitted to them. Some MCP security scanners look for prompt injection in descriptions, which is a different question. No site-audit tool checks annotation consistency.

## Implementation sketch

Phase 1, deterministic: from `tools/list`, count tools with each boolean hint. Flag a tool whose name starts with a verb OpenAI lists as destructive (delete, remove, cancel, revoke, overwrite) and that sets `readOnlyHint: true`. This needs no model.

Phase 2, model judge: give the judge `{name, title, description, inputSchema property names, annotations}`. Require a verdict and the exact token it relied on. Require two independent passes to agree. Report as "review this claim", never as a failure.

Phase 2 needs a model. The scanner has none. That is the blocker.

## Example failure

A payments server lists `void_transaction`, described as "Voids a pending transaction and returns the authorization hold to the cardholder". It sets `readOnlyHint: true`, likely copied from `get_transaction`. Claude would run it without asking the user. The phase-1 rule does not catch "void"; the judge flags "Voids" and "returns the authorization hold".

## Scoring

Tier: **informative (weight 0)** until the judge's precision is measured. The mechanism is grade A. The method is unproven. A false "contradiction" finding would send owners to change correct hints.

## Deferred

- Measure judge precision on a labelled set of real `tools/list` responses before any weight.
- Re-grade the readOnlyHint half of `agent-interfaces/mcp-endpoint` against the consumers above.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
- 2026-10-19 — evidence review. Grade C raised to A. The stated prerequisite is met: `schema.ts` for 2026-07-28 confirms the four hints and their defaults are unchanged. Added three consumers with primary sources: Anthropic's connector review criteria, VS Code's MCP tool contribution source, and OpenAI's plugin guidelines and reference. Recorded that `agent-interfaces/mcp-endpoint` already ships the readOnlyHint coverage half. The blocker is the model judge, not the evidence.
