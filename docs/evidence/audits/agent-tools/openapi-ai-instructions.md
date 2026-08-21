---
audit: agent-tools/openapi-ai-instructions
audit_id: "5.4"
category: agent-tools
source_file: packages/core/src/audits/agent-tools/openapi-ai-instructions.ts
slug: openapi-ai-instructions
review_verdict: delete
severity: high
evidence_grade: D
disposition: "sunset (approved 2026-08-21)"
reviewed: 2026-08-21
---

# openapi-ai-instructions (`5.4`)

> agent-tools · source `openapi-ai-instructions.ts` · review verdict **delete** · evidence grade **D** · disposition: **sunset (approved 2026-08-21)**

## What it checks

The x-ai-instructions field lets you give natural-language guidance to AI agents about how to use your API. This is your chance to explain business logic, rate limits, authentication flow, and common use cases in plain English.

## Code review findings (2026-08-20, 11-agent pass)

Pure cargo cult. `x-ai-instructions` is an invented vendor extension with zero consumers — no LLM tool-calling stack, SDK, or agent reads it. The audit marks a well-documented, fully compliant OpenAPI spec as FAILING at medium priority for omitting a field nobody parses, and its remediation tells owners to write agent guidance into a key that will be silently dropped instead of into `info.description`, which agents genuinely do read.

**Required fix:** Delete. If the intent (agent-readable API guidance) is worth keeping, fold it into 5.26 openapi-description-quality as a check on `info.description` length/quality, which is a real field real converters pass to the model.

**False-positive risks:**
- Every legitimate, high-quality OpenAPI spec on the internet fails this audit — the false-positive rate is effectively 100% of specs.
- Same JSON-only loader bug: YAML specs report 'No spec' while 5.1 passes.
- Advice is actively harmful: a site that moves its agent guidance from `info.description` (read by every OpenAPI→tool converter) into `info.x-ai-instructions` (read by nothing) makes itself measurably worse for agents while raising its Lighthouse score.
- `typeof info['x-ai-instructions'] === 'string' && info['x-ai-instructions']` accepts a single character, so `"x"` passes — the check cannot distinguish real guidance from a token added to game the audit.

**Test gaps:**
- No test that a spec with rich `info.description` but no x-ai-instructions is treated as adequate (it currently fails)
- No minimum-length or content-quality test — a one-character value passes
- No YAML fixture

**Overlaps with:** `5.26`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/sunset/agent-tools/openapi-ai-instructions.md](../../sunset/agent-tools/openapi-ai-instructions.md). Outcome: **dead**, grade D.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
