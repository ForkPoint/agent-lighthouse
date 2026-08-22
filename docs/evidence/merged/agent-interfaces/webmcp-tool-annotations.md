---
audit: agent-interfaces/webmcp-tool-annotations
audit_id: "5.24"
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/webmcp-tool-annotations.ts
slug: webmcp-tool-annotations
review_verdict: merge
severity: low
evidence_grade: D
disposition: "merge (approved 2026-08-21)"
reviewed: 2026-08-21
---

# webmcp-tool-annotations (`5.24`)

> agent-tools · source `webmcp-tool-annotations.ts` · review verdict **merge** · evidence grade **unrated** · disposition: **merge (approved 2026-08-21)**

## What it checks

WebMCP tools should include the readOnlyHint annotation (defined in the WebMCP spec) and ideally MCP-compatible annotations like destructiveHint and idempotentHint, so AI agents can make informed decisions about when to invoke tools and whether to ask for user confirmation.

## Code review findings (2026-08-20, 11-agent pass)

Inert on real input for the same reason as 5.22/5.23, and the declarative half invents `data-read-only-hint` style attributes that pair with an already-invented form convention. The underlying idea (destructive-action hints so agents ask for confirmation) is genuinely good but must be read from a live MCP tools/list response, not a static file.

**Required fix:** Merge into the MCP endpoint work (5.13): after a successful initialize, call `tools/list` and evaluate the real `annotations` block on each returned tool, requiring boolean values and requiring at least `readOnlyHint` on every tool. Delete this file and the invented data-* attribute guidance.

**False-positive risks:**
- Always `notApplicable` on real scans — neither `/.well-known/webmcp` nor `form[toolname]` exists in the wild.
- `data-${a.replace(/([A-Z])/g,'-$1').toLowerCase()}` synthesizes `data-read-only-hint`, `data-destructive-hint`, etc. — attribute names invented here and paired with the invented `toolname` convention, so the guidance is doubly fictional. Note `guidance.code` shows `data-readonly`/`data-destructive` while the code looks for `data-read-only-hint`/`data-destructive-hint`: the documented remediation does not satisfy the implementation.
- Presence-only check: `SAFETY_ANNOTATIONS.filter(a => a in annotations)` counts `{"readOnlyHint": null}` or a `data-read-only-hint` with no value as annotated. A tool can claim safety metadata with meaningless values and pass.
- A single annotation out of four counts the tool as fully annotated, so `readOnlyHint: false` alone yields a pass — the destructive-action confirmation signal the audit exists for is never actually required.

**Test gaps:**
- No test exposing that `guidance.code` documents different attribute names than the code checks
- No test that null/empty annotation values are wrongly accepted
- No test acknowledging the audit is unreachable on real sites
- No live tools/list fixture

**Overlaps with:** `5.20`, `5.21`, `5.23`, `5.25`, `5.13`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Graded evidence (2026-08-21)

**Mechanism claim:** An agent reads a per-tool `readOnlyHint`/`destructiveHint` annotation published by the site and uses it to decide whether to ask the user for confirmation before invoking the tool.

**Grade: D** — the annotation *concept* is real in both MCP and WebMCP, but neither of the two places this audit reads it from exists in any specification: there is no `/.well-known/webmcp` manifest, and the declarative WebMCP proposal defines no `data-read-only-hint`-style attributes. The measured signal has no consumer.

**Evidence:**
- WebMCP's IDL defines `ToolAnnotations` with exactly two members — `boolean readOnlyHint = false;` and `boolean untrustedContentHint = false;` — carried on `ModelContextTool` passed to `document.modelContext.registerTool()`, i.e. a JavaScript API surface, not a static file — https://raw.githubusercontent.com/webmachinelearning/webmcp/main/index.bs (verified 2026-08-21)
- MCP defines `annotations` as "optional properties describing tool behavior" returned from `tools/list`, and warns that clients "MUST consider tool annotations to be untrusted unless they come from trusted servers" — https://modelcontextprotocol.io/specification/2025-06-18/server/tools (verified 2026-08-21)
- The declarative WebMCP explainer proposes only `toolname`, `tooldescription`, `toolautosubmit` and `toolparamdescription`; it proposes no annotation attributes and no manifest file — https://raw.githubusercontent.com/webmachinelearning/webmcp/main/declarative-api-explainer.md (verified 2026-08-21)
- No `/.well-known/webmcp` path appears anywhere in the proposal repository — https://github.com/webmachinelearning/webmcp (verified 2026-08-21)

**Counter-evidence:** There is an active draft-spec trajectory, which is what separates this from a purely invented signal: `readOnlyHint` is normative in the WebMCP draft and in MCP, and WebMCP is in origin trial in Chrome 149 and Edge 150 (https://raw.githubusercontent.com/webmachinelearning/webmcp/main/implementation-status.md, verified 2026-08-21). Note also that `destructiveHint`, `idempotentHint` and `openWorldHint` — three of the four annotations this audit scores — are MCP-only and absent from WebMCP's `ToolAnnotations` dictionary. A readable version of this signal exists only over a live MCP `tools/list` response, not over a static crawl.

**Merged into:** `agent-interfaces/mcp-endpoint` (Plan 4, 2026-08-22) — [merged dossier](../../audits/agent-interfaces/mcp-endpoint.md)
