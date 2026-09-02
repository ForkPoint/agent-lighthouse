---
audit: agent-interfaces/mcp-capabilities
audit_id: "5.14"
category: agent-interfaces
source_file: packages/core/src/audits/agent-interfaces/mcp-capabilities.ts
slug: mcp-capabilities
review_verdict: merge
severity: medium
evidence_grade: D
disposition: "merge (approved 2026-08-21)"
reviewed: 2026-08-21
---

# mcp-capabilities (`5.14`)

> agent-tools · source `mcp-capabilities.ts` · review verdict **merge** · evidence grade **D** · disposition: **merge (approved 2026-08-21)**

## What it checks

Without declared capabilities, AI agents do not know whether your MCP server offers tools, resources, or prompts. Declaring capabilities upfront lets agents decide if your server is relevant before connecting, saving time and reducing unnecessary requests.

## Code review findings (2026-08-20, 11-agent pass)

Redundant third read of the same non-standard servers.json, and it checks the wrong artifact: MCP capabilities are negotiated in the initialize response, which 5.13 already fetches and discards. Its own `expected` string promises 'servers.json OR MCP response' but no MCP response is ever consulted, so the audit misrepresents what it measured.

**Required fix:** Merge into 5.13 (mcp-endpoint): have the initialize handshake return its `result.capabilities` and report tools/resources/prompts from the wire response, with servers.json as an optional secondary hint. Delete this file. If kept standalone, it must consume the handshake result and stop claiming to check an 'MCP response' it never requests.

**False-positive risks:**

- Never contacts the server. Real MCP capabilities live in `result.capabilities` of the initialize response that 5.13 already retrieves; a server advertising tools/resources/prompts correctly over the wire fails here for not duplicating them in a static file that is not part of any spec.
- `expected: 'servers.json or MCP response declares tools, resources, or prompts'` is false advertising — the code path for 'MCP response' does not exist.
- `server[key] !== undefined && server[key] !== false` treats any truthy-or-non-false value as a declared capability, so `"tools": 0`, `"tools": ""`, or `"tools": null` count as present (null !== undefined and !== false).
- UCP fallback maps `Object.keys(capabilities)` through `cap.split('.').pop()` and passes on any non-empty key set — an unrelated JSON object with any keys under `capabilities` passes.
- Third consecutive zero for one missing non-standard file (with 5.12 and 5.13), tripling the score impact of a single absence.

**Test gaps:**

- No test asserting capabilities are read from a live initialize response
- No test that `"tools": null` / `"tools": 0` are wrongly counted as declared
- No test of the triple-penalty interaction with 5.12/5.13

**Overlaps with:** `5.12`, `5.13`

## Evidence

_No dedicated evidence signal was researched for this audit in the 2026-08-20 pass. Its tier assignment falls to the taxonomy design; unproven mechanisms default to informative per the [evidence policy](../../policy.md)._

## Review history

- 2026-08-20 — code review (11-agent workflow) + evidence research (12-domain workflow, 400 sources).
- 2026-08-21 — dossier generated; disposition pending final taxonomy design.
- 2026-08-21 — evidence graded (see below).

## Graded evidence (2026-08-21)

**Mechanism claim:** An MCP client learns whether a server offers tools, resources, or prompts by reading a static `/.well-known/mcp/servers.json` published at the site origin.

**Grade: D** — no MCP specification version, registry document, or vendor doc defines that file or any per-origin capability manifest; capabilities are protocol state obtained from the server over the wire, so the artifact this audit measures has no consumer.

**Evidence:**

- Current MCP spec (2026-07-28): capabilities come from the `server/discover` RPC — "`server/discover` lets a client query a server's supported protocol versions, capabilities, and identity before sending any other requests. Servers **MUST** implement it", returning `capabilities: { tools: {}, resources: {} }` — https://modelcontextprotocol.io/specification/2026-07-28/server/discover (verified 2026-08-21)
- Legacy MCP revisions (2025-06-18 and earlier): "The server **MUST** respond with its own capabilities and information" in the `initialize` response, where `prompts`, `resources`, and `tools` are declared — https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle (verified 2026-08-21)
- Third-party discovery of MCP servers runs through the MCP Registry — a central REST API over `server.json` metadata with namespace ownership proved by DNS/GitHub/HTTP verification — not a per-origin well-known file: "A REST API for MCP clients and aggregators to discover available servers" — https://modelcontextprotocol.io/registry/about (verified 2026-08-21)
- A named agent host confirms the wire path: Microsoft 365 Copilot "resolves the plugin's tools dynamically at runtime by default, directly from the MCP server" — https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/overview-api-plugins (verified 2026-08-21)

**Counter-evidence:** None found in the file's favour — no draft SEP, registry document, or vendor page defines `/.well-known/mcp/servers.json`, and the UCP fallback branch is likewise undocumented. The question this audit asks is legitimate and answerable at grade A, but only from the `server/discover` (or legacy `initialize`) response that `5.13` already fetches and discards, which is why the disposition is merge rather than keep.

**Merged into:** `agent-interfaces/mcp-endpoint` (Plan 4, 2026-08-22) — [merged dossier](../../audits/agent-interfaces/mcp-endpoint.md)
