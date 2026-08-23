/**
 * v2 audits with no v1 predecessor.
 *
 * Plan 4 closed the registry at 148 audits, every one of them the target of at
 * least one `migration-map.json` entry. Plan 5 graduates checks out of
 * `packages/core/src/audits/proposed/` that never existed in v1, so they are
 * unreachable from the map by construction. Naming them here — rather than
 * weakening the map's reachability assertion — keeps the invariant exact: an
 * audit is either migrated from a v1 id, or it is on this list. Nothing else
 * may register.
 *
 * Each Plan 5 task appends exactly one id. Sorted by landing order.
 */
export const NEW_IN_V2: readonly string[] = [
  'operability-safety/form-autofill-token-coverage',
  'operability-safety/native-control-substitution',
  'operability-safety/invisible-instruction-scan',
  'operability-safety/aria-layer-injection-scan',
  'structured-data/claimreview-advisory',
  'content-extraction/css-hidden-ghost-content',
  'content-extraction/hydration-payload-share',
  'answer-readiness/snippet-gate-coverage',
  'answer-readiness/text-fragment-addressability',
  'agentic-commerce/acp-policy-link-surface',
  'agentic-commerce/landed-cost-and-returns',
  'agentic-commerce/checkout-offer-field-mapping',
  'access-crawl-control/robots-ai-group-shadowing',
  'machine-discovery/ai-crawler-surface-reachability',
  'machine-discovery/sitemap-lastmod-verifiability',
  'machine-discovery/agent-commerce-feed-parity',
  'access-crawl-control/ai-crawler-edge-parity',
  'access-crawl-control/bot-content-delta-declared',
  'agentic-commerce/agent-ua-commerce-parity',
  'agent-interfaces/mcp-modern-era-reachability',
  'agent-interfaces/mcp-oauth-discovery-chain',
  'agent-interfaces/mcp-tool-contract-validity',
  'agent-interfaces/mcp-tools-list-determinism',
  'agent-interfaces/mcp-version-downgrade',
  'operability-safety/ghost-clickable-element-ratio',
  'operability-safety/stateful-control-introspectability',
  'operability-safety/hover-only-content-and-navigation',
];

/** The 148 audits Plan 4 closed the v2 migration on. Never changes again. */
export const MIGRATED_COUNT = 148;
