import { SCORE_TIER_LABELS, ScoreTier } from "./contracts";

// Coverage tags, category names and score tiers are part of a saved report,
// so they live in `contracts.ts`. Re-exported for core modules and the root
// entry.
export {
  CATEGORY_NAMES,
  getScoreTier,
  SCORE_TIER_LABELS,
  TAG_SCAN_ERROR,
  TAG_SKIPPED_NO_EVIDENCE,
  TAG_SKIPPED_PAGE_TYPE,
  TAG_SKIPPED_SCAN_BUDGET,
} from "./contracts";

// ── Scan Limits ────────────────────────────────────────────────

// v2: the root-file set grew (A2A agent-card.json and agent.json, ard.json),
// so an origin cached under v1 lacks files the 9.0 audits read.
export const ORIGIN_EVIDENCE_VERSION = "v2";
export const DEFAULT_ORIGIN_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
/**
 * How many origins the shared cache holds at once. Each entry carries every
 * root file of one origin, so a long-lived process (the MCP server, a looped
 * live run) needs a ceiling, not only a TTL.
 */
export const DEFAULT_ORIGIN_CACHE_MAX_ENTRIES = 256;
export const REQUEST_TIMEOUT_MS = 10_000;
/**
 * Wall-clock budget for one scan. When it runs out, requests in flight are
 * aborted, no further request is sent, and every audit not yet started is
 * reported `na` tagged `skipped:scan-budget`. Callers can override the
 * 180-second default for their own workload.
 */
export const SCAN_TIMEOUT_MS = 180_000;
export const MAX_RESPONSE_BODY_BYTES = 5 * 1024 * 1024; // 5MB
/** @deprecated Unused internally; retained for published API stability. Scheduled for removal in v4. */
export const MAX_CONCURRENT_REQUESTS = 10;

// ── Scanner Identity ───────────────────────────────────────────

export const SCANNER_USER_AGENT =
  "AgentLighthouse/1.0 (+https://github.com/ForkPoint/agent-lighthouse)";

/**
 * A mainstream browser UA: the control request of UA-parity checks.
 *
 * The Chrome major tracks the current Stable channel (155 per
 * https://chromiumdash.appspot.com/fetch_releases?channel=Stable&platform=Mac&num=1,
 * verified 2026-10-19), with the reduced `.0.0.0` version Chrome itself sends.
 */
export const BASELINE_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36";

// ── Scoring ────────────────────────────────────────────────────

// Category weights are no longer hand-tuned percentages. A category's share of
// the overall score is its *evidence mass* — the summed weight of its
// registered audits — derived in `audit-config.ts` as `CATEGORY_MASS` (spec §4).

export const READINESS_WEIGHTS = {
  commerce: 0.4,
  content: 0.25,
  botAccessibility: 0.2,
  technical: 0.15,
} as const;

export function getTierLabel(tier: string | null): string {
  if (tier && Object.hasOwn(SCORE_TIER_LABELS, tier)) {
    return SCORE_TIER_LABELS[tier as ScoreTier];
  }
  return "N/A";
}

export function getTierColor(tier: string | null): string {
  switch (tier) {
    case ScoreTier.AgentReady:
      return "#10b981";
    case ScoreTier.PartiallyReady:
      return "#3b82f6";
    case ScoreTier.NeedsWork:
      return "#f59e0b";
    case ScoreTier.NotReady:
      return "#ef4444";
    case null:
    default:
      return "#64748b";
  }
}
