---
audit: agent-interfaces/ai-catalog-exists
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/ai-catalog-exists.ts
slug: ai-catalog-exists
evidence_grade: C
disposition: "merged 2026-08-22 (Plan 4, Task 7) — absorbs ai-catalog-link (4.19); rewritten to ARD §4.1 2026-08-22 (Plan 4, Task 10)"
reviewed: 2026-10-18
recommended_tier: informative
consumers:
  - none-known (no shipping MCP client documents fetching this path)
signals:
  - name: mcp-discovery-ai-catalog-well-known
    grade: C
    domain: agent-action-surfaces
sources:
  - mcp-sep-2127
  - mcp-ext-server-card-discovery
  - ai-catalog-repo
  - iana-well-known-uris
  - mcp-spec-versioning
  - anthropic-claude-custom-connectors
  - openai-apps-sdk-deploy
  - probe-vercel-ai-catalog
  - probe-zapier-ai-catalog
  - ard-spec-v091
  - hf-discover-fields
---

# ai-catalog-exists (`5.7`, `4.19`)

> agent-interfaces · source `ai-catalog-exists.ts` · absorbs ai-catalog-link (4.19) · evidence grade **C** · tier **informative** (weight 0) · rewritten to the real ARD schema — see below

## What it checks

The AI catalog is the central discovery file that tells AI agents what capabilities your site offers. Think of it as a table of contents for your APIs, tools, and services. Without it, agents must probe multiple endpoints to understand what your site can do.

## Evidence

### Signal: mcp-discovery-ai-catalog-well-known — grade C (agent-action-surfaces)

**Mechanism:** Publishing a JSON document at https://{site}/.well-known/ai-catalog.json that lists MCP Server Card entries (type application/mcp-server-card+json) causes MCP clients performing domain-level discovery to find and connect to the site's MCP server without manual URL entry.

**Evidence:** This is the path the MCP project itself is converging on. SEP-2127 (opened 2026-01-21, label 'in-review', still OPEN and unmerged as of 2026-08-11) delegates domain-level discovery to an 'AI Catalog' and its extension repo's docs/discovery.md states: 'An AI Catalog MAY be served from any URL. For automated domain-level discovery, hosts MAY publish one at: /.well-known/ai-catalog.json. Clients performing domain-level discovery SHOULD attempt to retrieve this well-known URL.' Media type SHOULD be application/ai-catalog+json; MCP entries use type application/mcp-server-card+json and urn:air: identifiers. Real conformant deployments exist and verified live on 2026-08-20: vercel.com serves it with the exact application/ai-catalog+json media type and specVersion 1.0; zapier.com serves specVersion 1.0 with a trustManifest and an entry pointing at its MCP server card. The underlying AI Catalog repo (Agent-Card/ai-catalog, 210 stars) was pushed the same day it was checked, so the work is live. Audit guidance: check /.well-known/ai-catalog.json, validate specVersion + entries[].type + entries[].url, require a JSON content-type (reject HTML 200 soft-404s), and prefer application/ai-catalog+json.

**Path and schema (ARD v0.91, verified 2026-10-18):** ARD v0.91 moved the normative well-known path to `/.well-known/ard.json` on 2026-08-26 (§5.1: a consumer "MUST fetch `/.well-known/ard.json`"; the predecessor `/.well-known/ai-catalog.json` "MAY additionally" be consulted) — https://github.com/ards-project/ard-spec/blob/main/spec/ard.md. Its `ArdManifest` schema requires only `entries`. `specVersion` and `host` come from the Linux Foundation AI Catalog spec and are optional under ARD. The one documented consumer, hf-discover, still resolves only `ai-catalog.json` and reads only `entries`; it never reads `specVersion` or `host` — https://raw.githubusercontent.com/huggingface/hf-discover/main/src/discover/navigation.py. The MCP Server Card extension (SEP-2127) also still names `ai-catalog.json`. The two paths therefore conflict, and both have a reader, so the audit accepts either.

**Counter-evidence:** The SEP is not merged — nothing about this is in the ratified spec (current revision 2026-07-28). `ai-catalog.json` is not in the IANA Well-Known URIs registry (106 entries on 2026-10-18; mcp, mcp.json, ai-catalog.json, webmcp, openapi are all absent). The MCP extension repo carrying the discovery text had 10 stars on 2026-10-18. No MCP client vendor documents consuming it. Anthropic's own docs say 'You can manually add any third-party connector to Claude as long as you have the URL of that remote MCP server'. OpenAI's Apps SDK routes through a developer-mode URL paste, plus 'public plugin submission' with 'domain verification'. A probe of 19 major domains found only 2 publishers, both large SaaS vendors. SEP-2127 itself lists 'No Domain-Level Discovery' as an _unsolved_ pain point, which is an admission that the mechanism does not yet work.

## Limits

A well-known path whose request got no HTTP response, because it was not sent, timed out, failed in transport or ended in a redirect loop, is not read. When no manifest is found and a path was not read, the audit returns not applicable with the cause instead of reporting the catalog as absent. Both paths must answer without a manifest before absence is reported.

## Implementation deviations

- The pass condition is a non-empty `entries` array, the only field the ARD v0.91 schema requires and the only one hf-discover reads. `specVersion` and `host` are read when present and never required. Until 2026-10-18 the audit also required them (from ARD v0.9 §4.1) and failed manifests without them. Parsing lives in the shared `_ard.ts`.
- The manifest is read at `/.well-known/ard.json` (ARD v0.91) and `/.well-known/ai-catalog.json` (hf-discover, MCP Server Cards). A valid manifest at either path passes. A manifest with entries wins over an empty one; `ard.json` wins a tie. When neither is valid, a present-but-broken file is reported ahead of a 404 at the other path.
- A valid manifest with `entries: []` is a `warn`, not a pass. It advertises nothing.
- A `rel="ai-catalog"` link or `Link` header is never a pass path. The one documented consumer resolves only the well-known path.
- The advertisement turns absence (a 404 or an HTML soft-404) into a `warn`. A served but malformed manifest still fails, with the advertisement as context.
- The advertised href is never fetched. No consumer is documented to follow it.
- `application/ai-catalog+json` is recommended, not required. The media type is unregistered.
- `ctx.wafProtection` is unused. A WAF 403 on `/.well-known/*` reads as absence.
