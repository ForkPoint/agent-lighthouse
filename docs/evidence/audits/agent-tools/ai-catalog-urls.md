---
audit: agent-tools/ai-catalog-urls
audit_id: "5.9"
category: agent-tools
source_file: packages/core/src/audits/agent-tools/ai-catalog-urls.ts
slug: ai-catalog-urls
review_verdict: delete
severity: high
evidence_grade: B
disposition: "kept — rewrite required (approved 2026-08-21)"
reviewed: 2026-08-21
---

# ai-catalog-urls (`5.9`)

> agent-tools · source `ai-catalog-urls.ts` · review verdict **delete** · evidence grade **B** · disposition: **kept — rewrite required (approved 2026-08-21)**

## What it checks

Broken service URLs in your AI catalog cause agents to fail when trying to use your services, creating a poor user experience. Verify all URLs are correct, deployed, and returning HTTP 200.

## Code review findings (2026-08-20, 11-agent pass)

Third zero for the same nonexistent file, and the liveness probing it adds would generate false failures even if the file existed — it demands HTTP 200 from GETs against API endpoints that normally answer 401, 404, or 405.

**Required fix:** Delete along with 5.7 and 5.8. (If URL-liveness checking is preserved anywhere — e.g. in 5.5 — accept 2xx/3xx/401/403/405 as 'reachable', resolve relative URLs against ctx.baseUrl, and cap concurrency.)

**False-positive risks:**
- `r.status === 200` is the only accepted outcome. A correctly deployed POST-only contact endpoint returns 405 to the audit's GET; an authenticated endpoint returns 401. Both are reported as 'unreachable', producing warn/fail for a healthy catalog.
- Fires N unthrottled parallel `ctx.fetch` calls via `Promise.all(urls.map(...))` against the target's own API with no cap — a large catalog turns the audit into a small burst load, which can itself trigger 429/WAF blocking and then be reported as the site's fault.
- Relative service URLs (`"url": "/api/search"`) are unfetchable and score as status 0 → 'None reachable'.
- Hard `fail` when ai-catalog.json is absent — the third penalty for one nonexistent file.
- Failure message interpolates every failed URL into `message` unbounded; a large catalog produces a message truncated by `validate()` at 5000 chars mid-URL.

**Test gaps:**
- No 401/405 fixture (the realistic responses for API endpoints)
- No relative-URL fixture
- No concurrency/rate-limit fixture
- No large-catalog message-truncation test

**Overlaps with:** `5.7`, `5.8`, `5.5`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/agent-tools/ai-catalog-urls.md](../../deletions/agent-tools/ai-catalog-urls.md). Outcome: **redeemable**, grade B.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
