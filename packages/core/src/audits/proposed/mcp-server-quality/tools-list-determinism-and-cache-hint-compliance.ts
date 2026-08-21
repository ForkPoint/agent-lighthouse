import type { AuditMeta, AuditResult } from '../../../types';
import { Audit } from '../../../audit';
import type { CheckContext } from '../../../check-context';

// TODO: implement proposed audit "tools/list Determinism and Cache-Hint Compliance".
// Status: stub — not registered in any category index; returns notApplicable until implemented.
// Evidence grade A → scored tier. Implementation difficulty: static-fetch.
// Dossier (mechanism, evidence, competitor coverage): docs/evidence/proposals/mcp-server-quality/tools-list-determinism-and-cache-hint-compliance.md
//
// Implementation sketch (from the 2026-08-20 research pass):
// Issue tools/list three times: calls 1 and 2 on the same keep-alive connection ~2s apart, call 3
// on a freshly established TCP/TLS connection ~5s later. For each response with `resultType:
// "complete"` assert: - `ttlMs` is present (MUST), is an integer, and is >= 0 (MUST). Grade the
// value: 0 or absent = no caching possible (fail); >0 = pass, and report the value so operators can
// see their refetch cadence. - `cacheScope` is present and is exactly "public" or "private". Flag
// `cacheScope: "public"` on an endpoint that also issues a 401/WWW-Authenticate challenge as a
// review item — the spec warns such results may be shared across access tokens. - Ordering: compare
// the array of tool `name` values across all three calls positionally. Any positional difference
// with identical set membership = non-deterministic ordering (SHOULD violation). Additionally hash
// the canonically-serialized tool array (JCS or stable-key JSON) and compare hashes — this catches
// key-order churn inside inputSchema objects, which breaks byte-level prompt caching even when tool
// order is stable. - Set stability: assert set equality of tool names between call 2 (same
// connection) and call 3 (fresh connection). A difference is a direct MUST violation ('MUST NOT
// vary per-connection'), unless the two calls presented different authorization, which the scanner
// controls for by sending identical (or no) credentials. - Pagination: if nextCursor is returned,
// fetch all pages and assert every page carries its own ttlMs and that `cacheScope` is identical
// across all pages of the request (MUST).
export class ToolsListDeterminismAndCacheHintComplianceAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'proposed/mcp-server-quality/tools-list-determinism-and-cache-hint-compliance',
    category: 'mcp-server-quality',
    title: "tools/list Determinism and Cache-Hint Compliance",
    failureTitle: "tools/list Determinism and Cache-Hint Compliance",
    description: "Repeatedly fetches tools/list and asserts three things the spec ties directly to agent cost and latency: caching hints are present and well-formed (ttlMs >= 0, cacheScope in {public, private}), tool ordering is stable across calls, and the tool set does not vary per connection.",
    scoreDisplayMode: 'binary',
    weight: 1,
    defaultPriority: 'medium',
    guidance: {
      impact: "The spec states its own causal rationale verbatim: deterministic ordering 'enables clients to reliably cache the tool list and improves LLM prompt cache hit rates when tools are included in model context.' Tool definitions sit near the front of the model's prompt; if their serialized bytes change between turns, the provider-side prefix cache misses and the full tool block is re-billed at uncached rates on every single turn. Separately, servers MUST include caching hints on complete results, and when ttlMs is absent clients SHOULD assume 0 — immediately stale — so an omitted hint converts one cheap cached read into a network round-trip on every access. Both defects are invisible in functional testing and both are measurable with three identical requests.",
      fix: 'TODO: written when the audit is implemented.',
      effort: 'moderate',
      docsUrl: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/proposals/mcp-server-quality/tools-list-determinism-and-cache-hint-compliance.md',
      tags: ['proposed', 'mcp-server-quality'],
    },
  };

  audit(_ctx: CheckContext): AuditResult {
    // TODO: implement per the sketch above. Stub is intentionally inert.
    return this.notApplicable(
      'Proposed audit not implemented yet.',
      'Implementation per docs/evidence/proposals/mcp-server-quality/tools-list-determinism-and-cache-hint-compliance.md',
      'TODO stub',
    );
  }
}
