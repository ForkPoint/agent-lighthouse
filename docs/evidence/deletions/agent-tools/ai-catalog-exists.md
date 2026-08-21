---
audit: agent-tools/ai-catalog-exists
category: agent-tools
status: kept-rewrite
verdict: redeemable
evidence_grade: A
reviewed: 2026-08-21
---

# ai-catalog-exists — redeemed — keep with rewrite

> Adversarial redemption research, 2026-08-21. The researcher's task was to **save** this audit by finding grade A/B evidence of a real consumer. Grade found: **A**.

## Claimed mechanism (steelmanned)

Publishing a machine-readable capability manifest at /.well-known/ai-catalog.json lets AI agents discover, in one request, what tools/APIs/services a site offers, instead of probing endpoints or crawling. The audit implies a real consumer fetches that exact path and acts on its contents.

## What we searched

WebSearch budget was exhausted for this session, so research was done via direct WebFetch and the GitHub API. Angles tried: (1) IANA well-known URI registry to check for registration of 'ai-catalog'; (2) GitHub code search for path 'ai-catalog.json' (217 hits) and for the literal string 'well-known/ai-catalog.json' (1,572 hits) to find spec text, publishers and clients; (3) fetched the Agentic Resource Discovery (ARD) spec at ards-project/ard-spec and the Linux Foundation Agent Card WG 'ai-catalog' spec/site (ai-catalog.io); (4) fetched the Hugging Face launch blog and Hugging Face's own hf-discover client source to find a named consumer; (5) verified live deployments by fetching neon.com, weaviate.io and specification.website manifests and headers; (6) checked vendor orgs (cloudflare, google, openai, anthropics, microsoft/NLWeb) via code search for the string. The prior 'invented, appears in no spec' conclusion is factually wrong.

## Best evidence found for the audit

The path is normative in a real, industry-backed draft spec and is read by a named vendor client. ARD spec v0.9 (May 28 2026), authored by Junjie Bu (Google), R.V. Guha (Microsoft) and Shaun Smith (Hugging Face), §6.1: 'Hosting the manifest at https://{domain}/.well-known/ai-catalog.json.' Acknowledgments list AWS, Cisco, Databricks, GitHub, GoDaddy, Google, Microsoft, Nvidia, Salesforce, Snowflake. Hugging Face announced it publicly on 2026-06-17. The consumer that reads the signal: Hugging Face's own hf-discover (ARD client/server, github.com/huggingface/hf-discover) — src/discover/navigation.py contains `well_known_catalog_url()` returning `f"{scheme}://{netloc}/.well-known/ai-catalog.json"`, seeds `catalog_queue` with it, and reads `catalog.get("entries", [])`, following nested catalogs and registries. Live publishers verified by fetch: neon.com, weaviate.io, specification.website; Shopware ships a first-party template (src/Core/Framework/Resources/views/files/agentic/.well-known/ai-catalog.json.twig) so every Shopware store can emit one. ards-project/ard-spec has 435 stars; ards-project/ard-connectors ships client connectors 'from Claude, ChatGPT, Copilot, and Gemini'.

## Counter-evidence

Real but narrower than the audit claims, and the audit's pass condition is wrong. (1) '/.well-known/ai-catalog.json' is NOT in the IANA well-known URI registry — that registry does list 'agent-card.json' (A2A, Linux Foundation, 2025-08-01) and 'api-catalog' (RFC 9727, IETF, 2024-12-23), so the omission is a real gap, not an oversight of the registry. The media type application/ai-catalog+json is likewise unregistered (spec §3.3 calls the sibling types 'de-facto community standards tracking towards formal registration'). (2) The Linux Foundation ai-catalog repo states it is 'a temporary working repo' and that 'A2A and MCP steering committees will vote on adoption' — i.e. pre-adoption. (3) The Hugging Face launch post lists 'Hub-side support for static ai-catalog.json manifests' as a NEXT STEP, and hf-discover's README says 'Navigation is intentionally not exposed by the hosted server' — so the well-known file is fetched by user-driven clients, not yet by a hosted crawler. (4) FATAL as implemented: the audit passes only if the JSON has a top-level `services` array. No spec or real deployment uses `services`. The spec's required top-level fields are `specVersion`, `host`, `entries` (§4.1), and every live manifest checked (neon.com, weaviate.io, ards conformance example, Shopware template) uses `entries`. A perfectly conformant site fails this audit today.

## Verdict

**redeemed — keep with rewrite** (grade A)

Grade A evidence: a named vendor tool (Hugging Face hf-discover) documents and implements fetching exactly https://{domain}/.well-known/ai-catalog.json, the path is normative in the ARD draft spec co-authored by Google/Microsoft/Hugging Face, and there is verifiable production adoption (Neon, Weaviate, Shopware core, specification.website). Keep the audit, but it MUST be rewritten: pass condition should be specVersion + host + entries[] per ARD §4.1, not a `services` array; and guidance/code samples must be replaced with the real schema, otherwise the audit penalizes spec-conformant sites.

## Sources

- **[Well-Known URIs registry](https://www.iana.org/assignments/well-known-uris/well-known-uris.xhtml)** — IANA (spec, URL verified 2026-08-21)
  - 'ai-catalog' / 'ai-catalog.json' is NOT registered. 'agent-card.json' (a2a-protocol.org, Linux Foundation, 2025-08-01) and 'api-catalog' (RFC 9727, IETF, 2024-12-23) are registered.
- **[Agentic Resource Discovery (ARD) Specification v0.9 (Draft)](https://raw.githubusercontent.com/ards-project/ard-spec/main/spec/ard.md)** — ARD Project (Junjie Bu, Google; R.V. Guha, Microsoft; Shaun Smith, Hugging Face) (spec, URL verified 2026-08-21)
  - §6.1 names /.well-known/ai-catalog.json as the well-known discovery location; §4.1 requires specVersion, host, entries. Draft dated 2026-05-28; acknowledgments include AWS, Cisco, Databricks, GitHub, GoDaddy, Google, Microsoft, Nvidia, Salesforce, Snowflake.
- **[Agentic Resource Discovery launch](https://huggingface.co/blog/agentic-resource-discovery-launch)** — Hugging Face (announcement, URL verified 2026-08-21)
  - Published 2026-06-17. Describes ai-catalog.json as the static manifest format hosted at a well-known URL; contributors from Microsoft, Google, GoDaddy, Hugging Face. Hub-side support for static manifests listed as a next step.
- **[hf-discover navigation.py (ARD client)](https://raw.githubusercontent.com/huggingface/hf-discover/main/src/discover/navigation.py)** — Hugging Face (repo, URL verified 2026-08-21)
  - well_known_catalog_url() builds {scheme}://{netloc}/.well-known/ai-catalog.json; navigate() seeds a catalog queue with it and reads entries[], following nested catalogs/registries. Only the well-known path is used — no HTML link or Link-header parsing.
- **[ARD conformance example basic/ai-catalog.json](https://raw.githubusercontent.com/ards-project/ard-spec/main/conformance/examples/basic/ai-catalog.json)** — ARD Project (spec, URL verified 2026-08-21)
  - Top-level keys are specVersion, host, entries. Entries carry identifier, displayName, type (media type), url, description, representativeQueries, capabilities. No `services`, `owner`, `contact`, or `lastUpdated`.
- **[Neon /.well-known/ai-catalog.json (live)](https://neon.com/.well-known/ai-catalog.json)** — Neon (vendor-doc, URL verified 2026-08-21)
  - Live production manifest using specVersion/host/entries with 10 MCP server and skill entries. No owner/contact/lastUpdated fields.
- **[Weaviate /.well-known/ai-catalog.json (live)](https://weaviate.io/.well-known/ai-catalog.json)** — Weaviate (vendor-doc, URL verified 2026-08-21)
  - Live manifest, specVersion 1.0, host object with displayName/docs/logo, 9 entries (docs, agent skills, OpenAPI, sitemap) with representativeQueries and tags.
- **[Shopware core ai-catalog.json.twig](https://raw.githubusercontent.com/shopware/shopware/trunk/src/Core/Framework/Resources/views/files/agentic/.well-known/ai-catalog.json.twig)** — Shopware (repo, URL verified 2026-08-21)
  - Shopware core ships a first-party template emitting specVersion/host/entries with an MCP server-card entry per sales channel — platform-level adoption, not a one-off site.
- **[AI Catalog — Common AI Catalog and Registry Standard](https://ai-catalog.io/)** — Linux Foundation / Agent Card Working Group (spec, URL verified 2026-08-21)
  - Defines the AI Catalog JSON container published at /.well-known/ai-catalog.json; maintained by the Agent Card WG under the Linux Foundation. Names no concrete consumers or adopters.
- **[Agent-Card/ai-catalog README](https://raw.githubusercontent.com/Agent-Card/ai-catalog/main/README.md)** — Linux Foundation (Agent Card WG) (repo, URL verified 2026-08-21)
  - Calls itself a temporary Linux Foundation working repo; states A2A and MCP steering committees will vote on adoption — i.e. pre-ratification. 210 stars, actively pushed 2026-08-20.

## Review history

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **kept-rewrite** (kept, rewrite required per dossier).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.
