---
audit: meta-tags/ai-catalog-link
category: meta-tags
status: kept-rewrite
verdict: redeemable
evidence_grade: B
reviewed: 2026-08-21
---

# ai-catalog-link — redeemed — keep with rewrite

> Adversarial redemption research, 2026-08-21. The researcher's task was to **save** this audit by finding grade A/B evidence of a real consumer. Grade found: **B**.

## Claimed mechanism (steelmanned)

A <head> link advertising the catalog lets an agent find it without guessing the well-known path (or when the catalog lives elsewhere). Falsifiable form: a spec defines such a link relation and sites/consumers use it.

## What we searched

Angles: (1) asked the ARD spec directly what discovery mechanisms it defines besides the well-known path (§6.1); (2) fetched the Linux Foundation ai-catalog 'consuming catalogs' guide for the consumer-side discovery order; (3) GitHub code search for the literal `rel="ai-catalog"` (141 hits) and `rel=ai-catalog` (4 hits) to gauge adoption and find implementations; (4) curled live sites (neon.com, weaviate.io, specification.website, shopware.com) to check for real HTML <link> tags and HTTP Link headers; (5) re-read hf-discover's client to see whether any known consumer actually parses the link rather than hitting the well-known path.

## Best evidence found for the audit

The link relation is normative and deployed. ARD §6.1 lists four advertisement mechanisms including verbatim: 'Including <link rel="ai-catalog" href="..."> in the <head> of a document.' (also robots.txt `Agentmap:` entries and DNS SVCB/TXT). The Linux Foundation ai-catalog consuming-catalogs guide tells clients to check an HTTP Link header with rel="ai-catalog", then an HTML <link rel="ai-catalog">, then fall back to the well-known URI. Verified live: specification.website serves BOTH `<link rel="ai-catalog" type="application/ai-catalog+json" title="Agentic Resource Discovery catalog" href="/.well-known/ai-catalog.json">` in HTML and the equivalent HTTP Link header; neon.com serves `</.well-known/ai-catalog.json>; rel="ai-catalog"` in its Link header alongside rel="api-catalog", rel="llms-txt", rel="mcp-server-card". 141 GitHub code hits for the exact rel value across spec repos and product code (Autonoma, neondatabase/website, jdevalk, plasmate, antfly, cf-webmcp).

## Counter-evidence

Two real weaknesses. (1) No consumer is documented to read the link tag: the only vendor client found, Hugging Face's hf-discover, ONLY constructs the well-known path — 'This function constructs a URL pointing to /.well-known/ai-catalog.json … with no logic for discovering catalog locations through HTML link elements or HTTP headers.' The link relation is also not in the IANA link-relations/well-known ecosystem alongside agent-card.json and api-catalog. (2) FATAL as implemented: the audit matches `rel="alternate"` + `type="application/json"` + a title containing 'ai catalog'. That matcher fails specification.website and every other conformant publisher (which use `rel="ai-catalog"`, type `application/ai-catalog+json`), while passing any site with an arbitrary JSON alternate link that happens to be titled 'AI Catalog'. It is currently inverted against the real world. It also ignores the HTTP Link header, which is how Neon actually advertises.

## Verdict

**redeemed — keep with rewrite** (grade B)

Grade B: the mechanism is written into two draft specs (ARD §6.1 and the LF Agent Card WG consuming guide) and is genuinely deployed in production with the exact rel token, verified by live fetch of neon.com and specification.website. That clears the bar for keeping the check. But it must be rewritten before it is worth anything: match `rel="ai-catalog"` (any type, ideally application/ai-catalog+json) in <head> AND accept an HTTP `Link: </...>; rel="ai-catalog"` header, and downgrade it to a nice-to-have relative to the well-known file, since the one known consumer resolves only the well-known path.

## Sources

- **[ARD Specification §6.1 — discovery mechanisms](https://raw.githubusercontent.com/ards-project/ard-spec/main/spec/ard.md)** — ARD Project (Google/Microsoft/Hugging Face authors) (spec, URL verified 2026-08-21)
  - Four advertisement mechanisms: well-known URI; robots.txt 'Agentmap:' entry; '<link rel="ai-catalog" href="..."> in the <head> of a document'; DNS SVCB with TXT fallback (DNS-AID draft).
- **[Consuming catalogs guide](https://raw.githubusercontent.com/Agent-Card/ai-catalog/main/docs/guides/consuming-catalogs.md)** — Linux Foundation / Agent Card Working Group (spec, URL verified 2026-08-21)
  - Prescribes consumer discovery order: HTTP Link header rel="ai-catalog", then HTML <link rel="ai-catalog" href=...>, then fall back to GET /.well-known/ai-catalog.json. Names no deployed consumers.
- **[specification.website live HTML/Link header](https://specification.website/)** — Joost de Valk (specification.website) (article, URL verified 2026-08-21)
  - Serves <link rel="ai-catalog" type="application/ai-catalog+json" title="Agentic Resource Discovery catalog" href="/.well-known/ai-catalog.json"> plus the matching HTTP Link header — proof the rel token, not rel=alternate, is what conformant sites emit.
- **[neon.com HTTP Link header](https://neon.com/)** — Neon (vendor-doc, URL verified 2026-08-21)
  - Link header includes </.well-known/ai-catalog.json>; rel="ai-catalog" alongside rel="api-catalog", rel="llms-txt", rel="mcp-server-card" — advertisement happens via header, which the audit does not inspect at all.
- **[hf-discover navigation.py — no link-tag parsing](https://raw.githubusercontent.com/huggingface/hf-discover/main/src/discover/navigation.py)** — Hugging Face (repo, URL verified 2026-08-21)
  - Counter-evidence: the only vendor client found resolves only the well-known path and has 'no logic for discovering catalog locations through HTML link elements or HTTP headers'.
- **[Well-Known URIs registry (context for link relation status)](https://www.iana.org/assignments/well-known-uris/well-known-uris.xhtml)** — IANA (spec, URL verified 2026-08-21)
  - agent-card.json and api-catalog are registered; ai-catalog is not — the ai-catalog relation/path remains pre-registration.

## Review history

- 2026-08-21 — user decision: all research verdicts accepted. Disposition by grade: **kept-rewrite** (kept, rewrite required per dossier).

- 2026-08-21 — adversarial redemption research pass (8-agent workflow); URLs fetched at research time.
