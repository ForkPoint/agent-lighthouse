---
check: behavior-annotation-coverage-and-claim-consistency
title: "Behavior Annotation Coverage and Claim Consistency"
domain: mcp-server-quality
status: proposed
evidence_grade: C
uniqueness: unique
difficulty: llm-assisted
scoring_tier: informative (weight 0)
reviewed: 2026-08-20
---

# Behavior Annotation Coverage and Claim Consistency

> Proposed check. Evidence grade **C** · unique · implementation: `llm-assisted`

## What it checks

Roadmap check. Measures what fraction of tools carry the behavior-hint annotations hosts use to decide whether to auto-approve a call, then uses an LLM judge to flag annotations that contradict the tool's own name and description (a tool named delete_* or refund_* asserting readOnlyHint: true).

## Claimed mechanism (falsifiable)

Hosts that offer auto-approval, allowlisting, or 'safe tools only' modes gate on the annotation block; a tool with no annotations must be treated conservatively and therefore prompts the user on every invocation, which is precisely the friction that makes multi-step agent workflows unusable. The consistency half rests on the spec's own repeated warning that 'clients MUST consider tool annotations to be untrusted unless they come from trusted servers' — an annotation that contradicts the tool's stated behavior is exactly the signal that warning anticipates, and a first-party audit is the right place to catch an accidental one. Graded C deliberately: we verified that the 2026-07-28 tools page describes `annotations` as 'optional properties describing tool behavior' and carries the untrusted-annotations warning, but we could NOT retrieve the ToolAnnotations type definition or its per-field default values from the 2026-07-28 schema reference. Any check that scores against specific defaults (readOnlyHint, destructiveHint, idempotentHint, openWorldHint) must first confirm those field names and defaults against schema/2026-07-28/schema.ts. Until that is done this is unscoreable.

## Evidence

- **[MCP Specification 2026-07-28 — Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - tools/list result set MUST NOT vary per-connection or as a side effect of other requests (MAY vary by authorization). Servers SHOULD return tools in deterministic order — rationale given verbatim: enables client caching and 'improves LLM prompt cache hit rates'. inputSchema MUST be a valid JSON Schema object (not null); defaults to JSON Schema 2020-12. Tool names SHOULD be 1-128 chars, case-sensitive, only [A-Za-z0-9_.-], unique within a server. Full x-mcp-header constraint list including static-reachability rule (chain of only `properties` keys; never through items/oneOf/anyOf/allOf/not/if/then/else/$ref). Clients MUST exclude violating tools from tools/list. If outputSchema present, servers MUST conform. Clients MUST treat annotations as untrusted.
- **[MCP Specification (latest) — index](https://modelcontextprotocol.io/specification/latest)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - Confirms the current authoritative revision is 2026-07-28 (schema/2026-07-28/schema.ts). Lists optional extensions negotiated in capabilities: Tasks (io.modelcontextprotocol/tasks), MCP Apps (io.modelcontextprotocol/ui), Skills over MCP. Restates that annotations describing tool behavior 'should be considered untrusted, unless obtained from a trusted server'.

## Competitor coverage

Unique in the audit space. Some MCP security research tools scan for prompt-injection payloads inside tool descriptions, which is a different question (malicious content) from this one (accidental annotation drift). Lighthouse, Profound, Otterly, Semrush and Ahrefs cover none of it. Flagged as roadmap on two grounds: it needs an LLM judge, and its scoring basis is unverified pending the schema.ts confirmation described above.

## Implementation sketch

Phase 1 (deterministic, ships first): from tools/list, compute annotationCoverage = tools with a non-empty `annotations` object / total tools, and report the distribution of which annotation keys actually appear across the tool set. Report as an unscored informational metric with the caveat that the authoritative field list must be confirmed against the 2026-07-28 schema.ts before any threshold is attached.
Phase 2 (LLM judge, gated on Phase 1 confirming the field names): for each tool, pass {name, title, description, inputSchema property names, annotations} to a judge with a strict rubric and require it to return a verdict plus the specific token it relied on. Flag only high-confidence contradictions: a tool whose name or description contains a mutating verb (delete, remove, cancel, refund, purchase, send, publish, revoke, transfer, charge) while annotations assert a read-only or non-destructive posture; or a tool that reaches an external network service while asserting a closed-world posture. Require two independent judge passes to agree before reporting, and always render the finding as 'review this claim' with the evidence quoted, never as an automatic failure — the scanner cannot execute the tool and so cannot prove the annotation false.
Prerequisite before promoting to scoreable: fetch https://modelcontextprotocol.io/specification/2026-07-28/schema and locate the ToolAnnotations definition to confirm the exact field names and documented defaults in the current revision. If the defaults are unchanged from 2025-03-26 (readOnlyHint false, destructiveHint true, idempotentHint false, openWorldHint true), the coverage metric can be scored at grade B, since an absent annotation block then means the host's conservative default treats every tool as destructive.

## Example failure

A payments server exposes `void_transaction` with the description 'Voids a pending transaction and returns the authorization hold to the cardholder' but annotates it as read-only and non-destructive — most likely because the annotation block was copy-pasted from the neighboring `get_transaction` tool. A host running in auto-approve-read-only mode invokes it without prompting the user, and money moves with no human in the loop. The judge flags the contradiction on the verb 'Voids' plus 'returns the authorization hold'.

## Scoring

Tier per evidence policy: **informative (weight 0)** — grade C does not meet the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
