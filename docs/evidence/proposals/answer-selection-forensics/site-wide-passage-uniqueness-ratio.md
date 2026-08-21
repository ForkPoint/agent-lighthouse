---
check: site-wide-passage-uniqueness-ratio
title: "Site-Wide Passage Uniqueness Ratio"
domain: answer-selection-forensics
status: proposed
evidence_grade: B
uniqueness: partial-overlap
difficulty: multi-page
scoring_tier: scored
reviewed: 2026-08-20
---

# Site-Wide Passage Uniqueness Ratio

> Proposed check. Evidence grade **B** · partial overlap · implementation: `multi-page`

## What it checks

Crawls the site, extracts main content per page, and computes two passage-level numbers no page-level tool produces: the fraction of each page's sentences that are unique to it (versus repeated across three or more sibling pages), and MinHash near-duplicate clusters at Jaccard >= 0.9 with the canonical status of every cluster member. Includes a divergence sub-check comparing each page against its llms-full.txt or .md alternate.

## Claimed mechanism (falsifiable)

Google clusters duplicate and near-duplicate URLs and elects a single canonical; the losers have their signals consolidated into the winner and are deprioritized (S9) — and AI Overviews eligibility requires being indexed and snippet-eligible in the first place (S4). Separately, near-duplicate saturation is the documented default state of web corpora (S6). Two mechanisms follow. First, a cluster of self-canonicalizing near-duplicate pages competes against itself: at most one member survives canonical election, so the rest are unciteable no matter how good they are. Second, a page whose sentences are mostly site-wide boilerplate produces chunks whose embeddings encode the template rather than the page, so all those pages collide in vector space and none is a distinctive match for any query. Falsifiable at the cluster level: near-duplicate members that self-canonicalize should show markedly lower citation and impression rates than the elected canonical.

## Evidence

- **[RFC 9728 — OAuth 2.0 Protected Resource Metadata](https://www.rfc-editor.org/rfc/rfc9728.html)** — IETF (spec, URL verified 2026-08-20)
  - `resource` is the only REQUIRED metadata parameter; scopes_supported and resource_name are RECOMMENDED; authorization_servers is OPTIONAL at the RFC level. Section 3 well-known construction: insert /.well-known/oauth-protected-resource between host and path, removing any terminating slash after the host (https://resource.example.com/resource1 -> https://resource.example.com/.well-known/oauth-protected-resource/resource1). Section 3.3 validation: the retrieved `resource` value MUST be identical to the resource identifier used to build the request URL; on mismatch the response data MUST NOT be used. Section 7.7 recommends blocking private/reserved IP ranges.
- **[MCP Specification 2026-07-28 — Authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - 'MCP servers MUST implement OAuth 2.0 Protected Resource Metadata (RFC9728).' Authorization servers MUST provide RFC8414 or OIDC Discovery. Servers SHOULD include a scope parameter in the WWW-Authenticate challenge. Example verbatim: `WWW-Authenticate: Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource", scope="files:read"`. Insufficient scope -> 403 with error="insufficient_scope". Servers SHOULD NOT include offline_access in WWW-Authenticate scope or in PRM scopes_supported. Canonical server URI rules: no fragment, scheme required, prefer no trailing slash. Servers MUST validate token audience; MUST NOT accept or transit other tokens.
- **[MCP Specification 2026-07-28 — Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)** — Model Context Protocol (spec, URL verified 2026-08-20)
  - tools/list result set MUST NOT vary per-connection or as a side effect of other requests (MAY vary by authorization). Servers SHOULD return tools in deterministic order — rationale given verbatim: enables client caching and 'improves LLM prompt cache hit rates'. inputSchema MUST be a valid JSON Schema object (not null); defaults to JSON Schema 2020-12. Tool names SHOULD be 1-128 chars, case-sensitive, only [A-Za-z0-9_.-], unique within a server. Full x-mcp-header constraint list including static-reachability rule (chain of only `properties` keys; never through items/oneOf/anyOf/allOf/not/if/then/else/$ref). Clients MUST exclude violating tools from tools/list. If outputSchema present, servers MUST conform. Clients MUST treat annotations as untrusted.

## Competitor coverage

Screaming Frog and Sitebulb ship exact-duplicate and near-duplicate page detection with a similarity threshold — genuine overlap on the page-level clustering half. Neither computes the per-page unique-passage fraction (the metric that predicts chunk-embedding collapse), neither cross-references cluster membership against canonical/hreflang status to identify self-competing clusters, and neither checks HTML-versus-markdown-alternate divergence. Lighthouse ships none of this.

## Implementation sketch

Multi-page crawl (cap N, seed from sitemap.xml plus llms.txt links). Per page: extract main content, sentence-split, normalize (lowercase, collapse whitespace, strip punctuation). 1) Build a site-wide sentence-frequency map; boilerplate = sentences appearing on >= max(3, 5% of crawled pages). 2) uniqueFraction(page) = unique sentence characters / total sentence characters; flag pages below 0.30. 3) Page-level 5-gram shingles -> 128-permutation MinHash -> LSH banding -> clusters at estimated Jaccard >= 0.90. 4) For each cluster, join in rel=canonical target, hreflang cluster membership, and sitemap presence; the hard fail is a cluster whose members all self-canonicalize, since exactly one will survive Google's election (S9) and the others are wasted. 5) Divergence sub-check: for each page with a .md alternate or an llms-full.txt section, compute Jaccard between the two; 0.50-0.90 means the alternate has drifted stale and the site is serving models a different answer than it serves users — report the diverged sentences. 6) Report medianUniqueFraction as the site-level number and the three worst clusters as the actionable list.

## Example failure

A location-directory site publishes 400 'Service in {City}' pages that are byte-identical except the city name in the h1 and one sentence. uniqueFraction is 0.04; MinHash puts all 400 in one cluster; every page self-canonicalizes. Google elects one, the other 399 are consolidated away, and every chunk embedding from the set is dominated by the shared template, so none is a distinctive vector match for any city-specific query.

## Scoring

Tier per evidence policy: **scored** — grade B meets the A/B bar required for scored audits.

## Review history

- 2026-08-20 — proposed by the novel-checks research pass (10-agent evidence workflow); sources URL-verified at research time.
