---
audit: agent-tools/webmcp-tool-naming
audit_id: "5.23"
category: agent-tools
source_file: packages/core/src/audits/agent-tools/webmcp-tool-naming.ts
slug: webmcp-tool-naming
review_verdict: merge
severity: low
evidence_grade: unrated
disposition: "merge (approved 2026-08-21)"
reviewed: 2026-08-21
---

# webmcp-tool-naming (`5.23`)

> agent-tools · source `webmcp-tool-naming.ts` · review verdict **merge** · evidence grade **unrated** · disposition: **merge (approved 2026-08-21)**

## What it checks

WebMCP tools should follow verb-based camelCase naming (e.g., searchProducts, addToCart) and have descriptions of at least 20 characters. This helps AI agents understand the tool's purpose and invoke the correct one.

## Code review findings (2026-08-20, 11-agent pass)

Inert in practice (both sources — the fictional manifest and `form[toolname]` — are absent on real sites, so it always returns `na`), and the naming rule it would apply is an English-verb allowlist that rejects legitimate MCP naming styles.

**Required fix:** Merge the naming principle into 5.3 openapi-operation-ids (which governs names that a real tool-calling stack actually consumes) and into a future MCP tools/list check; drop the English-verb allowlist in favor of a structural rule (legal function-name charset, ≤64 chars, contains a verb-like leading token OR a namespaced separator). Delete this file.

**False-positive risks:**
- Always `notApplicable` on real input; contributes nothing but runtime.
- `VERB_PATTERN` is a hardcoded ~100-word English verb allowlist anchored with `^...([A-Z]|$)`. It rejects snake_case (`search_products`), kebab-case (`search-products`), and dotted namespacing (`products.search`) — all common and valid MCP tool-naming styles — and any non-English or domain-specific verb (`quote`, `provision`, `annotate`, `ingest`, `diff`). Every one of those would be reported as a 'non-verb name'.
- `MIN_DESCRIPTION_LENGTH = 20` on raw `.length` is arbitrary and rewards padding: 'Search products now!!' (21 chars) passes while 'Search the catalog' (18) fails.
- `badNames.join(', ')` interpolates every offending name into `message` unbounded; a large manifest yields a message truncated by `validate()` mid-token.
- An empty tool name (`name: ''`) is counted as a tool and reported as a 'non-verb name' rather than as a structurally invalid tool — the tests at lines 153 and 166 lock this in.

**Test gaps:**
- No snake_case / kebab-case / dotted-namespace name fixtures
- No non-English or domain-verb fixture
- No test acknowledging the audit is unreachable on real sites
- No message-truncation test for large manifests

**Overlaps with:** `5.20`, `5.21`, `5.24`, `5.25`, `5.3`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
