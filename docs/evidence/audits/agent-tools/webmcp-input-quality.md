---
audit: agent-tools/webmcp-input-quality
audit_id: "5.22"
category: agent-tools
source_file: packages/core/src/audits/agent-tools/webmcp-input-quality.ts
slug: webmcp-input-quality
review_verdict: merge
severity: medium
evidence_grade: unrated
disposition: "merge (approved 2026-08-21)"
reviewed: 2026-08-21
---

# webmcp-input-quality (`5.22`)

> agent-tools · source `webmcp-input-quality.ts` · review verdict **merge** · evidence grade **unrated** · disposition: **merge (approved 2026-08-21)**

## What it checks

For AI agents to correctly invoke WebMCP tools, form inputs must have descriptive name attributes, appropriate type attributes, and associated labels or descriptions. Poor input quality leads to agents guessing parameter values or skipping the tool entirely.

## Code review findings (2026-08-20, 11-agent pass)

Permanently inert: its precondition is `form[toolname]`, an attribute no real site has, so it returns `na` on every real scan — dead weight. Where it does run (synthetic fixtures) it accepts `placeholder` as a label, directly contradicting form-actionability's correct position that agents cannot rely on placeholders.

**Required fix:** Merge into 5.27 form-actionability, which already evaluates native elements, label association, and autocomplete on ALL forms rather than only WebMCP-tagged ones. Carry over nothing but the concept; drop the placeholder-as-label rule, which 5.27 correctly rejects. Delete this file.

**False-positive risks:**
- `page.$('form[toolname]')` never matches on a real site → `notApplicable` 100% of the time. The audit consumes runtime and report space while measuring nothing.
- `(placeholder && placeholder.length > 0)` counts as a valid label (line 75). Placeholders are not accessible names, vanish on input, and are exactly what 5.27's description says agents cannot use. Two audits in the same category give contradictory guidance on the same attribute.
- `label[for=...]` is searched page-wide (`page.$(...)`) here but form-scoped in 5.27 — inconsistent association semantics between two audits checking the same thing.
- `escapedId` over-escapes inside a quoted attribute selector: `id.replace(/(["\\\]:])/g, '\\$1')` escapes `:` and `]`, which need no escaping inside `label[for="..."]`. Ids containing `:` (JSF/PrimeFaces `form:email`, ASP.NET WebForms) produce a selector that matches nothing → false 'no label'.
- The `type` attribute is named in the title and description ('inputs have name, type, and label') but is never actually scored — only skipped-type filtering uses it.

**Test gaps:**
- No test acknowledging the audit is unreachable on real input
- No id-with-colon fixture exposing the over-escaping bug
- No test of the placeholder-vs-label contradiction with 5.27
- No test that `type` is actually evaluated (it isn't)

**Overlaps with:** `5.20`, `5.21`, `5.27`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
