---
audit: agent-tools/webmcp-declarative-forms
audit_id: "5.21"
category: agent-tools
source_file: packages/core/src/audits/agent-tools/webmcp-declarative-forms.ts
slug: webmcp-declarative-forms
review_verdict: delete
severity: high
evidence_grade: A
disposition: "kept — rewrite required (approved 2026-08-21)"
reviewed: 2026-08-21
---

# webmcp-declarative-forms (`5.21`)

> agent-tools · source `webmcp-declarative-forms.ts` · review verdict **delete** · evidence grade **A** · disposition: **kept — rewrite required (approved 2026-08-21)**

## What it checks

WebMCP's Declarative API lets you expose HTML forms as agent-callable tools by adding toolname and tooldescription attributes. AI agents can then discover and invoke these forms without JavaScript, using standard HTML semantics.

## Code review findings (2026-08-20, 11-agent pass)

Checks for `toolname`/`tooldescription` HTML attributes that do not exist in any specification and are invalid HTML. It hard-fails at high priority every site that has a form, and its partial-credit logic lets a form with only a description and no tool name produce a full pass.

**Required fix:** Delete with the rest of the WebMCP cluster. The legitimate underlying question — 'can an agent understand and submit this form' — is already covered properly by 5.27 form-actionability using real HTML semantics (labels, autocomplete, native controls).

**False-positive risks:**
- Universal false fail: `toolname`/`tooldescription` are not part of the WebMCP proposal, HTML, or any registered microsyntax. Every real site with forms gets 'Found N form(s) but none have WebMCP toolname/tooldescription attributes' at high priority — a top-level recommendation to add invalid, inert markup.
- Logic hole: a form with `tooldescription` but NO `toolname` increments `webmcpForms` (lines 58-62). With one such form, `webmcpForms === totalForms` → PASS, message 'All 1 form(s) have WebMCP attributes' with an empty tools list. The test at line 82 codifies this as expected behavior. A nameless tool is not callable by anything.
- `warn` (not `na`) when a page has no forms at all — a documentation site or blog is penalized for not having forms to annotate, muddying the score with a non-signal.
- Would-be positives are unattainable: a site implementing real WebMCP via JS registers tools at runtime and has no such attributes, so correct implementations also fail.

**Test gaps:**
- No test recognizing that these attributes are non-standard
- The description-only-pass hole is tested as correct behavior rather than flagged
- No test asserting `na` (not `warn`) is right for form-less pages

**Overlaps with:** `5.20`, `5.22`, `5.23`, `5.24`, `5.25`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/agent-tools/webmcp-declarative-forms.md](../../deletions/agent-tools/webmcp-declarative-forms.md). Outcome: **redeemable**, grade A.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
