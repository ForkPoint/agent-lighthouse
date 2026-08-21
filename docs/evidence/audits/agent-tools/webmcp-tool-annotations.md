---
audit: agent-tools/webmcp-tool-annotations
audit_id: "5.24"
category: agent-tools
source_file: packages/core/src/audits/agent-tools/webmcp-tool-annotations.ts
slug: webmcp-tool-annotations
review_verdict: merge
severity: low
evidence_grade: unrated
disposition: "proposed: merge (pending triage)"
reviewed: 2026-08-21
---

# webmcp-tool-annotations (`5.24`)

> agent-tools · source `webmcp-tool-annotations.ts` · review verdict **merge** · evidence grade **unrated** · disposition: **proposed: merge (pending triage)**

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
