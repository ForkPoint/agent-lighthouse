---
audit: agent-interfaces/ai-catalog-urls
audit_id: "5.9"
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/ai-catalog-urls.ts
slug: ai-catalog-urls
review_verdict: delete
severity: high
evidence_grade: B
disposition: "kept — rewritten to ARD entries[].url liveness 2026-08-22 (Plan 4, Task 10)"
reviewed: 2026-08-22
---

# ai-catalog-urls (`5.9`)

> agent-interfaces · source `ai-catalog-urls.ts` · evidence grade **B** · tier **scored** (weight 0.6) · disposition: **kept — rewritten 2026-08-22 (Plan 4, Task 10)**

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

## The rewrite (Plan 4, Task 10, 2026-08-22)

The required rework from the [redemption dossier](../../deletions/agent-tools/ai-catalog-urls.md) is executed: *"re-point it at `entries[].url` (skipping entries that use embedded `data`), and treat non-200-but-reachable auth-gated MCP endpoints carefully to avoid false failures."*

**Old pass condition:** every `services[].url` in the manifest answers HTTP **200** to an unauthenticated GET. On a conformant manifest the audit never got that far — it aborted with "ai-catalog.json has no services array" — and where it did run, `200` as the only accepted status reported healthy endpoints as broken.

**New pass condition:** the manifest parses as ARD (shared `_ard.ts` reader), and every entry that carries a `url` resolves to a live endpoint. Entries that embed their artifact in `data` are skipped — ARD §4.2 requires *exactly one* of `url` or `data`, so an inline entry has no endpoint and is fully conformant.

*Reachable* now means 2xx, 3xx, or one of 401 / 403 / 405 / 429. Catalog entries point at MCP servers, agent cards and API descriptions: an OAuth-protected endpoint answers 401 (which `mcp-endpoint` already treats as a healthy server), a POST-only endpoint answers 405 to our GET, and a rate-limited one answers 429. All three are correctly deployed. 404, 410, 5xx and transport failures remain broken.

Closing the false-positive risks listed above:

- **`r.status === 200` as the only acceptable outcome is gone** — see the reachability set above.
- **The unthrottled burst is gone.** Probes run through a pool capped at 5 concurrent requests instead of one `Promise.all` over the whole catalog, so a large manifest no longer turns the audit into a load spike that trips the target's own rate limiting.
- **Relative urls resolve** against `ctx.baseUrl` instead of scoring as status 0.
- **The triple penalty is gone.** No manifest, or a manifest that is not ARD-shaped, is `na` — the absence is already scored once by `ai-catalog-exists`. A manifest whose entries are all inline is `na` too: there is nothing to dereference.
- **The message is bounded.** At most three broken entries are named (by `displayName`, falling back to `identifier` then position), then "and N more" — no unbounded URL interpolation running into `validate()`'s 5000-char truncation.

**Safe fetching.** Every url is `isSafeUrl()`-gated before a request is made, matching the `mcp-endpoint` / `openapi-exists` pattern: these targets come out of a site-controlled file, so probing them is SSRF-adjacent. A refused url (non-HTTP scheme, malformed, loopback or private address) counts as broken and is labelled "refused" in the message. The test suite mocks the fetcher module so no test performs real DNS.

### Grade decision: stays **B**, tier `scored`, weight 0.6

Source: the [redemption dossier's verdict](../../deletions/agent-tools/ai-catalog-urls.md) — "redeemed — keep with rewrite (grade B)" — carried into the [REWORK-TODO entry](../../../../packages/core/src/audits/REWORK-TODO.md). `entries[].url` is dereferenced by real code (hf-discover's `navigate()` follows entry urls into nested catalogs and federated registries; HelgeSverre/ardvark and iFurySt/OpenARD probe and verify them), which makes the consequence of a dead url mechanical and immediate. But no vendor documents penalizing a site for one, and the federation-following consumer is user-driven rather than a hosted crawler — grade B, not A. Per the §4 weight law `weightForGrade('B', 'scored') = 0.6`; `scoreDisplayMode` stays `ternary`; `defaultPriority` stays `medium`.

### Deviations

- **429 is treated as reachable**, which the code-review note did not list. A rate-limited answer proves something is serving the endpoint, and counting it as broken would let the audit's own probing manufacture the failure it reports.
- **Every linked entry is probed; the count is not capped.** The concurrency pool bounds the burst rather than the total, so a large catalog is still fully checked. Real manifests carry ~10 entries (Neon 10, Weaviate 9), so a total cap would trade correctness for a bound nothing currently needs.
- **The fetched body is not validated against `entry.type`.** Checking that an entry declaring `application/mcp-server-card+json` actually returns a server card would be the natural next step, but liveness is what the dossier scopes and what a dead url breaks.

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass; the grade comes from the adversarial redemption research below._

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/agent-tools/ai-catalog-urls.md](../../deletions/agent-tools/ai-catalog-urls.md). Outcome: **redeemable**, grade B.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
- 2026-08-22 — rewritten (Plan 4, Task 10): probes `entries[].url` (inline `data` entries skipped), accepts auth-gated 401/403/405/429 as reachable, `isSafeUrl()`-gated, concurrency capped at 5, absence downgraded from `fail` to `na`. Grade **B**, tier `scored`, weight 0.6 — unchanged. `TODO(redeem)` header removed; entry dropped from REWORK-TODO.md.
