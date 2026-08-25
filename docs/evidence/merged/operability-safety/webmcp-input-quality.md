---
audit: operability-safety/webmcp-input-quality
audit_id: "5.22"
category: operability-safety
source_file: packages/core/src/audits/operability-safety/webmcp-input-quality.ts
slug: webmcp-input-quality
review_verdict: merge
severity: medium
evidence_grade: B
disposition: "merge (approved 2026-08-21)"
reviewed: 2026-08-21
---

# webmcp-input-quality (`5.22`)

> operability-safety · source `webmcp-input-quality.ts` · review verdict **merge** · evidence grade **unrated** · disposition: **merge (approved 2026-08-21)**

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

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.

## Graded evidence (2026-08-21)

**Mechanism claim:** In a declarative WebMCP form, each form control's `name` attribute becomes the corresponding property name in the tool's synthesized JSON input schema, so a control with no `name` produces no callable parameter for the agent.

**Grade: B** — this is exactly what the WebMCP declarative API explainer specifies, and the proposal is in browser origin trials (Chrome 149, Edge 150), so it is a draft standard with real implementation adoption; site-side adoption is still nil and the audit's label/placeholder rule is not part of the spec.

**Evidence:**
- The declarative explainer states: "The `name` attribute on form control elements supplies the name of each 'property' in the input schema generated for a declarative tool", and shows a `<form toolname=… tooldescription=…>` compiling to a `document.modelContext.registerTool()` inputSchema — https://raw.githubusercontent.com/webmachinelearning/webmcp/main/declarative-api-explainer.md (verified 2026-08-21)
- `toolname` / `tooldescription` / `toolautosubmit` / `toolparamdescription` are the real proposed attribute names, so the audit's `form[toolname]` selector matches the actual proposal rather than an invention — same source (verified 2026-08-21)
- Implementation status: Chrome "An Origin Trial is live in Chrome 149", Edge "live in Edge 150", Brave "Experimental support is added to Leo AI chat" — https://raw.githubusercontent.com/webmachinelearning/webmcp/main/implementation-status.md (verified 2026-08-21)
- WebMCP is incubating in the W3C Web Machine Learning Community Group with a Bikeshed spec draft — https://github.com/webmachinelearning/webmcp (verified 2026-08-21)

**Counter-evidence:** The spec does not derive parameter descriptions from `<label>` and never from `placeholder` — it introduces `toolparamdescription` precisely because "there's no pre-existing description attribute we can use" (declarative explainer, verified 2026-08-21), and the accessible name computation likewise excludes `placeholder` (https://www.w3.org/TR/accname-1.2/, W3C Working Draft, verified 2026-08-21). So the label/placeholder half of the score has no consumer. The input-schema synthesis algorithm is still marked TBD in the explainer, and the vendor link this audit cites as `docsUrl`, https://webmcp.link/, returns HTTP 451 (checked 2026-08-21). Site-side adoption is effectively zero, so on real scans the audit returns `notApplicable`.

**Merged into:** `operability-safety/form-actionability` (Plan 4, 2026-08-22) — [merged dossier](../../audits/operability-safety/form-actionability.md)
