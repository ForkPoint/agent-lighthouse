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

### Signal: ARD `entries[].url` dereferenced by real clients — grade B (agent-tools)

**Mechanism:** A discovery client follows an entry's `url` to reach the artifact it advertises, and for catalog- or registry-typed entries it follows that url into a nested catalog — so one dead url does not degrade a listing, it truncates a whole branch of discovery.

**Grade: B** — the dereferencing is done by real, readable code in more than one implementation, which is stronger than a convention; it is not A because no vendor documents a penalty for a dead url, and the traversing client is user-driven rather than a hosted crawler.

**Evidence:**
- `hf-discover`'s `navigate()` uses an entry's `url` to traverse into nested catalogs and federated registries, fetching entries whose `type` is a catalog or registry media type — https://github.com/huggingface/hf-discover (verified 2026-08-24)
- Independent implementations check liveness explicitly: `HelgeSverre/ardvark` ships `internal/crawler` and `internal/probe`, and `iFurySt/OpenARD` ships `internal/cli/verify.go`.
- Live manifests point at operational endpoints an agent would call immediately: Neon's ten entries are MCP servers and skills, Weaviate's nine are docs, agent skills, an OpenAPI description and a sitemap, and Shopware's is a Store-API MCP server url.
- ARD §4.2 requires exactly one of `url` or `data` per entry, so an entry that embeds its artifact has no endpoint to dereference and is fully conformant — https://github.com/ards-project/ard-spec (verified 2026-08-24)

**Counter-evidence:** No vendor document states that a crawler penalises or downranks a site for a dead catalog url. The consequence is mechanical — traversal stops, the tool call fails — rather than a published ranking signal, and the federation-following behaviour lives in a user-driven client: Hugging Face's hosted server states that "Navigation is intentionally not exposed by the hosted server". ARD itself is a draft (v0.9). The inline-`data` case above is also a live false-positive risk that any liveness check must respect, and the pre-2026-08-22 implementation was unreachable on real sites for the opposite reason: it aborted unless the manifest exposed a `services` array, which no spec or deployment uses.

**Sources:** [ARD specification](https://github.com/ards-project/ard-spec) (verified 2026-08-24) · [huggingface/hf-discover](https://github.com/huggingface/hf-discover) (verified 2026-08-24)

## Adversarial redemption research (2026-08-21)

This audit was a delete candidate and went through dedicated adversarial research. Full dossier: [docs/evidence/deletions/agent-tools/ai-catalog-urls.md](../../deletions/agent-tools/ai-catalog-urls.md). Outcome: **redeemable**, grade B.

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — adversarial redemption research; user accepted verdict (disposition above).
- 2026-08-22 — rewritten (Plan 4, Task 10): probes `entries[].url` (inline `data` entries skipped), accepts auth-gated 401/403/405/429 as reachable, `isSafeUrl()`-gated, concurrency capped at 5, absence downgraded from `fail` to `na`. Grade **B**, tier `scored`, weight 0.6 — unchanged. `TODO(redeem)` header removed; entry dropped from REWORK-TODO.md.
