---
audit: structured-data/action-schema
audit_id: "3.16"
category: structured-data
source_file: packages/core/src/audits/structured-data/action-schema.ts
slug: action-schema
review_verdict: delete
severity: high
evidence_grade: D
disposition: "sunset (approved 2026-08-21)"
reviewed: 2026-08-21
---

# action-schema (`3.16`)

> structured-data · source `action-schema.ts` · review verdict **delete** · evidence grade **D** · disposition: **sunset (approved 2026-08-21)**

## What it checks

AI agents use ConfirmAction/ReserveAction schema to complete transactions on behalf of users in agentic workflows. Without this schema on your confirmation pages, agents cannot programmatically verify that a booking or purchase was successful.

## Code review findings (2026-08-20, 11-agent pass)

Gated on the crawler having fetched a thank-you/confirmation page — post-checkout, noindex, unlinked pages a crawler essentially never reaches — so on virtually every scan it returns the 'no confirmation pages' branch, which is warn (0.5) rather than na. Net effect: a fixed unearned half-point deduction carrying zero information, for a schema.org action type no 2026 agent consumes. When it does fire, the URL regex matches marketing pages.

**Required fix:** Delete. The audit is unreachable in practice, its default branch is an unearned deduction, its URL regex misfires on marketing pages, and the standard it checks has no consumer. If post-purchase agent verification is worth auditing at all, it belongs in agent-tools as a check for a machine-readable order/receipt API, not as JSON-LD on a page a crawler cannot reach.

**False-positive risks:**
- `isConfirmationUrl` requires a scanned page URL matching `/thank-you|/confirmation|/success|/order-complete/`. Those pages sit behind checkout, are `noindex`, are not in sitemaps, and are not linked from any crawlable page — so the crawler will essentially never sample one. The audit therefore returns the same `warn` (0.5) on nearly every site, for nearly every scan, regardless of the site's actual quality. An audit whose output is constant carries no information but still costs the customer score.
- `/\/(thank-?you|confirmation|success|order-complete)\b/i` matches `/success-stories/`, `/customer-success/`, `/our-success`, `/client-success-stories` — extremely common B2B marketing URLs. When the crawler samples one, the audit hard-`fails` it for lacking ConfirmAction schema on a case-study page. Concrete false fail.
- Non-English confirmation paths (`/danke`, `/merci`, `/gracias`, `/bedankt`, `/spasibo`) never match, so even the rare site whose confirmation page IS reachable is skipped if it is not English.
- The precondition-absent branch uses `this.warn(...)` where the base class documents `notApplicable` for exactly this case.
- Overlaps 3.10: both check `potentialAction` with adjacent-but-disjoint type lists, so identical markup can pass one and fail the other.

**Test gaps:**
- No test for `/success-stories/` or `/customer-success/` being wrongly treated as a confirmation page
- No test for non-English confirmation paths
- No test acknowledging that confirmation pages are unreachable by a crawler (the always-warn reality)
- No test asserting the no-confirmation-pages branch should be `na` rather than `warn`

**Overlaps with:** `3.10`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/structured-data/action-schema.md](../../deletions/structured-data/action-schema.md). Outcome: **dead**, grade D.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
