---
audit: agent-interfaces/ai-catalog-metadata
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/ai-catalog-metadata.ts
slug: ai-catalog-metadata
evidence_grade: B
disposition: "kept — rewritten to ARD §4.2 metadata 2026-08-22 (Plan 4, Task 10)"
reviewed: 2026-08-22
signals:
  - name: ARD entry metadata read by a discovery client
    grade: B
    domain: agent-tools
sources:
  - hf-discover
  - ard-spec-repo
  - google-ard-announcement
  - ard-spec-v091
---

# ai-catalog-metadata (`5.8`)

> agent-interfaces · source `ai-catalog-metadata.ts` · evidence grade **B** · tier **scored** (weight 0.6) · disposition: **kept — rewritten 2026-08-22 (Plan 4, Task 10)**

## What it checks

Complete metadata helps AI agents understand who owns the service, when it was last updated, and what it can do. Missing fields reduce agent confidence in your services and may cause them to skip your site in favor of better-documented alternatives.

## Evidence

### Signal: ARD entry metadata read by a discovery client — grade B (agent-tools)

**Mechanism:** A discovery client picks which catalog entry answers a query by matching text drawn from named entry fields. An entry that omits those fields is therefore present in the manifest and invisible to the query. The manifest lists it, and no search surfaces it.

**Grade: B** — the consuming code is first-party, public and readable, and the fields it matches on are exactly the ones this audit scores. It is not grade A because ARD is a draft (v0.9) rather than a ratified standard, and because the behaviour is documented in a client's source rather than in a vendor statement about a hosted crawler.

**Evidence:**

- Hugging Face ships `hf-discover`, an ARD-compliant client whose navigate mode performs "automatic `.well-known/ai-catalog.json` discovery from a website" and follows federated registries — https://github.com/huggingface/hf-discover (verified 2026-08-24)
- Its navigation code builds the text it matches a query against from five entry fields: `displayName`, `description`, `tags`, `capabilities` and `representativeQueries`. `displayName` is already mandatory under ARD §4.2, so the four this audit scores are exactly the optional keys that decide whether a query surfaces an entry at all.
- ARD v0.91 requires only `entries` at the top level. `specVersion` and `host` come from the predecessor AI Catalog format and are optional; `version`, `updatedAt`, `tags`, `metadata` and `trustManifest` are optional enrichment. When present, `host.identifier` (a DID) and `trustManifest` express identity — https://github.com/ards-project/ard-spec/blob/main/spec/ard.md (verified 2026-10-18)
- ARD is a Linux Foundation working-group specification with Google, Microsoft and Hugging Face among its contributors, published 2026-06-17 under Apache 2.0 — https://developers.googleblog.com/announcing-the-agentic-resource-discovery-specification/ (verified 2026-08-24)

**Counter-evidence:** No crawler is documented to downrank a site for thin catalog metadata. The consequence is mechanical — the client matches less text — rather than a published ranking signal. The hosted Hugging Face server does not fetch arbitrary well-known files at all: "Navigation is intentionally not exposed by the hosted server". The consuming path is therefore a user-driven CLI, not a background crawler. The specification is also a draft and says so. Historically this audit scored an invented field list: `owner`, `contact`, `lastUpdated` and `services`. None of those appears in any revision of the spec, or in any of the four live manifests checked — the ARD conformance example, neon.com, weaviate.io and the Shopware core template. A spec-perfect manifest therefore scored zero until the 2026-08-22 rewrite.

## Implementation deviations

- The manifest comes from the shared `_ard.ts` reader: `/.well-known/ard.json` or `/.well-known/ai-catalog.json`, with only `entries` required (ARD v0.91 — https://github.com/ards-project/ard-spec/blob/main/spec/ard.md, verified 2026-10-18). A manifest with no `host` object is graded on its entries alone; the `host.displayName` warning fires only when a `host` object is present but unnamed. Before 2026-10-18 a manifest without `host` or `specVersion` was rejected upstream and this audit returned `notApplicable`.

- No manifest, or a manifest with no entries, is `na`. `ai-catalog-exists` already scores the absence.
- Blank strings and empty arrays do not count as metadata.
- `updatedAt` is read per entry. `trustManifest` is read on the host or on any entry. A root-level copy of either is ignored. Both are bonuses and never gate the result.
- `host.identifier` is reported, not required. ARD §4.3 makes only `displayName` mandatory.
- An entry counts as indexable only with a `description` plus one of `tags`, `capabilities` or `representativeQueries`. A description alone is under-described. This is a judgement about hf-discover's match text, not a spec rule.
- The `warn` message names at most five under-described entries, plus a count.
