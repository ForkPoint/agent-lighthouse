---
audit: agent-tools/ai-catalog-metadata
category: agent-tools
status: kept-rewrite
verdict: redeemable
evidence_grade: B
reviewed: 2026-08-21
---

# ai-catalog-metadata — redeemed — keep with rewrite

> Adversarial redemption research, 2026-08-21. The researcher's task was to **save** this audit by finding grade A/B evidence of a real consumer. Grade found: **B**.

## Claimed mechanism (steelmanned)

Agents weigh manifest metadata when deciding whether to trust and use a site's services, so a catalog missing descriptive/provenance fields gets skipped. Falsifiable form: some real consumer reads named metadata fields out of ai-catalog.json and its behaviour changes when they are absent.

## What we searched

Same research base as ai-catalog-exists. Specifically checked which fields the ARD spec declares required vs optional (§4.1 and entry schema), which fields the Linux Foundation ai-catalog spec defines, and — most importantly — which fields a real consumer actually reads, by fetching Hugging Face hf-discover's navigation.py and asking exactly which manifest keys it parses. Cross-checked field usage against four independent real manifests (ARD conformance example, neon.com, weaviate.io, Shopware's core Twig template) to see whether the audit's field list (version, name, description, capabilities, owner, contact, lastUpdated) occurs anywhere in the wild.

## Best evidence found for the audit

Metadata completeness does measurably determine whether a real consumer surfaces you — but on different keys. Hugging Face's hf-discover builds its search haystack from entry-level `displayName`, `description`, `tags`, `capabilities` and `representativeQueries`, and routes on `type` (matched against AI_CATALOG_MEDIA_TYPES / AI_REGISTRY_MEDIA_TYPES) and `url`. ARD §4.1 makes `specVersion`, `host` and `entries` the required top-level fields; `version`/`updatedAt`/`tags`/`metadata`/`trustManifest` are defined optional enrichment, and identity/accountability is expressed via `host.identifier` (a DID) and the optional `trustManifest`, not via `owner`/`contact`. So an audit that scores manifest metadata quality against the spec's real fields has a documented consumer behind it.

## Counter-evidence

The audit's specific field list is unattested. `owner`, `contact` and `lastUpdated` appear in no version of the ARD spec, in the Linux Foundation ai-catalog spec, or in any of the four real manifests checked (ards conformance example, neon.com, weaviate.io, shopware/shopware Twig template) — the spec summary explicitly notes it 'does not prescribe a fixed services or owner structure', using `trustManifest` for identity/compliance instead. `version`/`name`/`description` at top level are also wrong shape: the spec uses `specVersion` and nests display metadata under `host`. And the audit hard-requires the same nonexistent `services` array as 5.7. Net effect today: a spec-perfect manifest scores zero, and the audit's remediation code sample teaches an invented schema. Also, no crawler is known to downrank on missing metadata — hf-discover simply matches less text, and the hosted HF server does not fetch arbitrary well-known files at all ('Navigation is intentionally not exposed by the hosted server').

## Verdict

**redeemed — keep with rewrite** (grade B)

The underlying mechanism is real and consumer-backed (hf-discover's ranking is driven entirely by manifest metadata richness), which is grade-B evidence, so deletion would throw away a genuinely useful check. But the audit is currently wrong in every field it names. Keep only if rewritten to score ARD's actual schema: require specVersion + host{displayName,identifier} + entries[], and score entry quality on description, tags, capabilities and representativeQueries (the exact keys hf-discover indexes), with updatedAt/trustManifest as optional bonuses. Drop owner/contact/lastUpdated/services entirely.

## Sources

- **[ARD Specification §4.1 manifest fields](https://raw.githubusercontent.com/ards-project/ard-spec/main/spec/ard.md)** — ARD Project (Google/Microsoft/Hugging Face authors) (spec, URL verified 2026-08-21)
  - Required top-level: specVersion, host, entries. Entry fields: identifier (URN), displayName, type, url|data, description, capabilities, representativeQueries; optional version, updatedAt, tags, metadata, trustManifest. No owner/contact/lastUpdated; no services.
- **[hf-discover navigation.py — fields consumed](https://raw.githubusercontent.com/huggingface/hf-discover/main/src/discover/navigation.py)** — Hugging Face (repo, URL verified 2026-08-21)
  - Reads entries[]; _entry_haystack() matches on displayName, description, tags, capabilities, representativeQueries; uses type for media-type routing and url for traversal; identifier for dedup. Does not read specVersion or host.
- **[Neon live manifest field audit](https://neon.com/.well-known/ai-catalog.json)** — Neon (vendor-doc, URL verified 2026-08-21)
  - Confirms absence of owner/contact/lastUpdated in a production manifest; uses specVersion/host/entries.
- **[Shopware core ai-catalog.json.twig field set](https://raw.githubusercontent.com/shopware/shopware/trunk/src/Core/Framework/Resources/views/files/agentic/.well-known/ai-catalog.json.twig)** — Shopware (repo, URL verified 2026-08-21)
  - Platform template emits identifier, displayName, type, url, description, tags, capabilities, representativeQueries — matching the spec, not the audit's field list.
- **[ai-catalog.io specification site](https://ai-catalog.io/)** — Linux Foundation / Agent Card Working Group (spec, URL verified 2026-08-21)
  - Describes the catalog as a JSON container for MCP servers, A2A agents, Claude Code plugins, datasets and model cards with optional Trust Manifest extensions for attestation/provenance — the spec's answer to 'who owns this', in place of owner/contact fields.

## Review history

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **kept-rewrite** (kept, rewrite required per dossier).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.
