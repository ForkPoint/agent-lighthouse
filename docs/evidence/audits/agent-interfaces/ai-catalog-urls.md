---
audit: agent-interfaces/ai-catalog-urls
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/ai-catalog-urls.ts
slug: ai-catalog-urls
evidence_grade: B
disposition: "kept — rewritten to ARD entries[].url liveness 2026-08-22 (Plan 4, Task 10)"
reviewed: 2026-08-22
signals:
  - name: "ARD `entries[].url` dereferenced by real clients"
    grade: B
    domain: agent-tools
sources:
  - hf-discover
  - ard-spec-repo
---

# ai-catalog-urls (`5.9`)

> agent-interfaces · source `ai-catalog-urls.ts` · evidence grade **B** · tier **scored** (weight 0.6) · disposition: **kept — rewritten 2026-08-22 (Plan 4, Task 10)**

## What it checks

Broken service URLs in your AI catalog cause agents to fail when trying to use your services, creating a poor user experience. Verify all URLs are correct, deployed, and returning HTTP 200.

## Evidence

### Signal: ARD `entries[].url` dereferenced by real clients — grade B (agent-tools)

**Mechanism:** A discovery client follows an entry's `url` to reach the artifact it advertises. For catalog- or registry-typed entries, it follows that url into a nested catalog. One dead url therefore does not degrade a listing. It truncates a whole branch of discovery.

**Grade: B** — the dereferencing is done by real, readable code in more than one implementation, which is stronger than a convention. It is not A for two reasons: no vendor documents a penalty for a dead url, and the traversing client is user-driven rather than a hosted crawler.

**Evidence:**

- `hf-discover`'s `navigate()` uses an entry's `url` to traverse into nested catalogs and federated registries, fetching entries whose `type` is a catalog or registry media type — https://github.com/huggingface/hf-discover (verified 2026-08-24)
- Independent implementations check liveness explicitly: `HelgeSverre/ardvark` ships `internal/crawler` and `internal/probe`, and `iFurySt/OpenARD` ships `internal/cli/verify.go`.
- Live manifests point at operational endpoints an agent would call immediately: Neon's ten entries are MCP servers and skills, Weaviate's nine are docs, agent skills, an OpenAPI description and a sitemap, and Shopware's is a Store-API MCP server url.
- ARD §4.2 requires exactly one of `url` or `data` per entry, so an entry that embeds its artifact has no endpoint to dereference and is fully conformant — https://github.com/ards-project/ard-spec (verified 2026-08-24)

**Counter-evidence:** No vendor document states that a crawler penalises or downranks a site for a dead catalog url. The consequence is mechanical rather than a published ranking signal: traversal stops, and the tool call fails. The federation-following behaviour also lives in a user-driven client. Hugging Face's hosted server states that "Navigation is intentionally not exposed by the hosted server". ARD itself is a draft (v0.9). The inline-`data` case above is also a live false-positive risk that any liveness check must respect. The pre-2026-08-22 implementation was unreachable on real sites for the opposite reason. It aborted unless the manifest exposed a `services` array, which no spec or deployment uses.

## Implementation deviations

- Reachable means 2xx, 3xx, or 401, 403, 405 or 429. Catalog entries often point at auth-gated or POST-only endpoints.
- 429 counts as reachable. Counting it as broken would let the audit's own probing cause the failure it reports.
- Entries that embed `data` are skipped. ARD §4.2 requires exactly one of `url` or `data`.
- No manifest, a non-ARD manifest, or a manifest with only inline entries is `na`.
- Relative urls resolve against `ctx.baseUrl`.
- Every url is gated by `isSafeUrl()`. A refused url counts as broken and is labelled "refused".
- Probes run through a pool of 5. Every linked entry is probed; the total is not capped.
- The message names at most three broken entries, then "and N more".
- The fetched body is not checked against `entry.type`. The dossier scopes liveness only.
