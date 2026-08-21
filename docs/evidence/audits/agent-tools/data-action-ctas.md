---
audit: agent-tools/data-action-ctas
audit_id: "5.17"
category: agent-tools
source_file: packages/core/src/audits/agent-tools/data-action-ctas.ts
slug: data-action-ctas
review_verdict: delete
severity: high
evidence_grade: D
disposition: "sunset (approved 2026-08-21)"
reviewed: 2026-08-21
---

# data-action-ctas (`5.17`)

> agent-tools · source `data-action-ctas.ts` · review verdict **delete** · evidence grade **D** · disposition: **sunset (approved 2026-08-21)**

## What it checks

data-action attributes help AI browser agents (like ChatGPT Browse and Google Mariner) identify clickable CTAs and understand what each button does. Without these hints, agents must guess which elements are interactive based on text alone.

## Code review findings (2026-08-20, 11-agent pass)

Invented convention that also collides with a widely deployed unrelated one. No AI agent reads `data-action`; meanwhile Stimulus/Hotwire (every modern Rails app) uses `data-action` as its own event-binding attribute, so those sites PASS for reasons unrelated to agents. The audit is wrong in both directions and its impact copy names specific products as consumers, which is fabricated.

**Required fix:** Delete. The real version of this signal — can an agent identify and name the interactive controls — is accessible-name coverage on buttons/links, which belongs in the accessibility category, not a bespoke attribute check here.

**False-positive risks:**
- FALSE PASS: `page.$('[data-action]')` matches Stimulus bindings (`data-action="click->modal#open"`), Turbo, Alpine-adjacent patterns, and countless bespoke analytics hooks. A Rails/Hotwire site scores a clean pass while exposing nothing whatsoever to an agent. The audit cannot tell an agent affordance from a JS event binding because no such distinction exists in the attribute.
- FALSE FAIL: every site not using this made-up convention fails, with impact text asserting that 'ChatGPT Browse and Google Mariner' need these attributes to identify CTAs. Neither product documents or consumes `data-action`; agentic browsers use the accessibility tree, ARIA roles, and visible text. This is fabricated attribution presented as product guidance.
- Counts elements globally (`totalDataAction`) with no restriction to buttons/links, so `data-action` on a wrapper div inflates the count.
- Pass requires `data-action` AND `data-action-type` anywhere on any page — not on the same element. One div with `data-action` on page A and an unrelated element with `data-action-type` on page B yields a full PASS.

**Test gaps:**
- No Stimulus/Hotwire fixture (`data-action="click->controller#method"`) — the false-pass case is entirely untested
- No test that data-action and data-action-type must co-occur on the same element
- No test that non-interactive elements are excluded

**Overlaps with:** `5.21`, `5.27`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/sunset/agent-tools/data-action-ctas.md](../../sunset/agent-tools/data-action-ctas.md). Outcome: **dead**, grade D.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
