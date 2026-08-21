---
audit: agent-tools/ai-catalog-urls
category: agent-tools
status: kept-rewrite
verdict: redeemable
evidence_grade: B
reviewed: 2026-08-21
---

# ai-catalog-urls — redeemed — keep with rewrite

> Adversarial redemption research, 2026-08-21. The researcher's task was to **save** this audit by finding grade A/B evidence of a real consumer. Grade found: **B**.

## Claimed mechanism (steelmanned)

Each entry in the catalog points an agent at a live endpoint; if those URLs 404 or are stale, an agent that trusted the catalog fails mid-task. Falsifiable form: a real consumer dereferences the URLs listed in the manifest, so their liveness has operational consequence.

## What we searched

Same base research. Focused on whether manifest URLs are actually dereferenced rather than merely listed: read hf-discover's navigation.py traversal logic (does it follow entry.url?), read the ARD spec's entry schema for url vs data, inspected real manifests to see what the URLs point at (MCP endpoints, agent cards, skills, OpenAPI, docs), and searched GitHub for independent ARD crawlers/validators that resolve catalog URLs (HelgeSverre/ardvark crawler+probe, iFurySt/OpenARD verify command, Agent-Field/agentfield routes_ard.go, agentic-community/mcp-gateway-registry, tkircsi/agent-finder-dir-ai-catalog).

## Best evidence found for the audit

URLs in the manifest are dereferenced by real code. hf-discover's navigate() uses entry `url` to traverse into nested catalogs and federated registries (entries whose `type` is in AI_CATALOG_MEDIA_TYPES / AI_REGISTRY_MEDIA_TYPES are fetched), so a dead url silently truncates an entire branch of discovery. Independent implementations do explicit liveness checking: HelgeSverre/ardvark ships internal/crawler + internal/probe that crawl and probe catalogs, and iFurySt/OpenARD ships an internal/cli/verify.go. Live manifests point at real operational endpoints — Neon's 10 entries are MCP servers and skills; Weaviate's 9 entries are docs, agent skills, an OpenAPI spec and a sitemap; Shopware's entry is a Store-API MCP server URL — all things an agent would immediately call.

## Counter-evidence

No vendor document states that a crawler penalizes or downranks a site for dead catalog URLs; the consequence is mechanical (traversal stops, tool call fails), not a published ranking signal. The federation-following behaviour lives in a user-driven client — Hugging Face's hosted server deliberately does not fetch arbitrary URLs ('Navigation is intentionally not exposed by the hosted server'). And the audit is currently unreachable on real sites: it aborts unless the manifest exposes a `services` array, which no spec or deployment uses (ARD §4.1 defines `entries`), so on a conformant Neon/Weaviate/Shopware manifest it reports 'No ai-catalog.json services' rather than checking anything. Note also that entries may legitimately carry embedded `data` instead of `url`, which a naive URL check must not flag.

## Verdict

**redeemed — keep with rewrite** (grade B)

Grade B: the checked property (liveness of manifest-listed endpoints) is a real field in a real draft spec that a named Hugging Face client dereferences and that independent crawlers/validators probe. This is the most mechanically defensible of the four — a broken url genuinely breaks agent traversal. Keep it, but re-point it at `entries[].url` (skipping entries that use embedded `data`), and treat non-200-but-reachable auth-gated MCP endpoints carefully to avoid false failures.

## Sources

- **[hf-discover navigation.py — URL traversal](https://raw.githubusercontent.com/huggingface/hf-discover/main/src/discover/navigation.py)** — Hugging Face (repo, URL verified 2026-08-21)
  - entry.url is used to traverse nested catalogs and registries based on entry.type media type; dead URLs cut off federated discovery.
- **[ARD Specification — entry schema (url vs data)](https://raw.githubusercontent.com/ards-project/ard-spec/main/spec/ard.md)** — ARD Project (spec, URL verified 2026-08-21)
  - Each entry carries either a `url` remote reference or embedded `data`; `type` is an IANA media type identifying the artifact. Confirms url is the field to validate, and that entries without url are legal.
- **[Neon live manifest entries](https://neon.com/.well-known/ai-catalog.json)** — Neon (vendor-doc, URL verified 2026-08-21)
  - 10 entries pointing at MCP servers and skills — operational endpoints an agent will call directly, making liveness consequential.
- **[Weaviate live manifest entries](https://weaviate.io/.well-known/ai-catalog.json)** — Weaviate (vendor-doc, URL verified 2026-08-21)
  - 9 entries: docs guides, agent skills, REST/OpenAPI spec, sitemap — each a dereferenceable URL.
- **[ardvark — ARD crawler/probe (GitHub code search hits)](https://github.com/HelgeSverre/ardvark)** — HelgeSverre (repo, URL verified 2026-08-21)
  - Code search shows internal/crawler, internal/probe, internal/fetch and internal/mcpserver all referencing ai-catalog.json — an independent crawler that fetches and probes catalogs and their URLs. (Identified via GitHub code search; repo page not individually fetched.)

## Review history

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **kept-rewrite** (kept, rewrite required per dossier).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.
