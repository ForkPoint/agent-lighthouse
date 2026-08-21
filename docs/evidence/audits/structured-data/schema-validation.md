---
audit: structured-data/schema-validation
audit_id: "3.2"
category: structured-data
source_file: packages/core/src/audits/structured-data/schema-validation.ts
slug: schema-validation
review_verdict: fix
severity: high
evidence_grade: unrated
disposition: "keep — fix required"
reviewed: 2026-08-21
---

# schema-validation (`3.2`)

> structured-data · source `schema-validation.ts` · review verdict **fix** · evidence grade **unrated** · disposition: **keep — fix required**

## What it checks

AI agents parse @context and @type to identify entity types in your structured data. Blocks missing these properties are silently ignored by every schema consumer, including Google, ChatGPT plugins, and RAG pipelines. Add "@context": "https://schema.org" and a valid @type to each block.

## Code review findings (2026-08-20, 11-agent pass)

Validating that schema blocks carry @context and @type is legitimate, but the audit validates EVERY node returned by flattenJsonLd — including nested property values that are legally allowed to omit @type — and then hard-fails with the confidently wrong claim that those blocks are 'silently ignored by every schema consumer'. It is the most misleading audit in the category because the failure text asserts a consequence that does not occur.

**Required fix:** Validate only top-level entities: the parsed `<script>` roots plus direct `@graph` children, not `flattenJsonLd`'s full descendant list. For nested nodes, check @type only when the node is used in a position schema.org types (and even then warn, never fail). Stop relying on flattenJsonLd's @context mutation — resolve inherited context locally in a non-mutating pass. Soften the guidance so it no longer claims nested typeless values are ignored by consumers.

**False-positive risks:**
- `for (const b of flattenJsonLd(...))` walks every nested node, so ordinary property-value objects become 'schema blocks'. `"author": {"name": "Jane"}`, `"brand": {"name": "Acme"}`, `"aggregateRating": {"ratingValue": 4.8}` and `"address": {"streetAddress": ...}` are all valid JSON-LD (schema.org does not require @type on nested values) and each is reported as an invalid block. A single Product with three typeless sub-objects produces '3 of 8 schema block(s) missing @context or @type' at critical/high priority on completely functional markup.
- Microdata guarantees this failure: `parseMicrodataItem` only sets `@type`/`@context` when `itemtype` is present (parser.ts:186-190), and `<div itemscope itemprop="offers">` without itemtype is idiomatic Microdata. Every Microdata site therefore fails this audit by construction of the extractor, not because of anything on the site.
- The verdict is entangled with `flattenJsonLd`'s mutation (`if (!obj['@context'] && ctx) obj['@context'] = ctx`). Whether a nested node has @context at audit time depends on whether another audit already flattened the same array. Results are order-dependent across the audit-runner's 20-wide batches.
- The node-reference exemption is too narrow: `keys.every((k) => k === '@id' || k === '@context')`. Yoast and Drupal emit references carrying `@id` plus a `name` or `url` hint; those are flagged as untyped blocks.
- Only `'@graph' in obj` is skipped as a container. `@set`, `@list`, `@included`, and `mainEntityOfPage` wrapper objects are not, and are reported as invalid.
- The failure message and guidance assert that these blocks are 'silently ignored by every schema consumer, including Google, ChatGPT plugins, and RAG pipelines'. For nested typeless values that is false — Google's parser and every JSON-LD 1.1 processor read them as property values of the typed parent.

**Test gaps:**
- No test with a nested typeless property value (`author: {name}`, `brand: {name}`, `offers: {price}`) — the dominant real-world false-fail case is entirely unexercised
- No Microdata/RDFa test, though `extractMicrodata` emits typeless objects by design
- No test proving idempotency across two consecutive audit runs on the same page objects (flattenJsonLd mutation)
- No test for `@id` + `name` reference nodes, `@set`/`@list` containers, or a genuinely unparseable script block
- No test for a top-level block that omits @context entirely (children then inherit nothing) — the count-inflation scenario

**Overlaps with:** `3.1`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../POLICY.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
