import type { ScoreTier } from "./types";

// ── Scan Limits ────────────────────────────────────────────────

export const DEFAULT_SCAN_LIMIT = 1;
export const MAX_PAGES_PER_SCAN = 1; // Single-page scan unit
export const ORIGIN_EVIDENCE_VERSION = "v1";
export const DEFAULT_ORIGIN_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
export const REQUEST_TIMEOUT_MS = 10_000;
export const SCAN_TIMEOUT_MS = 60_000;
export const MAX_RESPONSE_BODY_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_CONCURRENT_REQUESTS = 10;

// ── Scanner Identity ───────────────────────────────────────────

export const SCANNER_USER_AGENT =
  "AgentLighthouse/1.0 (+https://github.com/ForkPoint/agent-lighthouse)";

// ── Coverage tags ──────────────────────────────────────────────

export const TAG_SKIPPED_PAGE_TYPE = "skipped:page-type";
export const TAG_SCAN_ERROR = "scan-error";
/** An audit the scan could not feed: it needs evidence this scan never got. */
export const TAG_SKIPPED_NO_EVIDENCE = "skipped:no-evidence";

// ── Scoring ────────────────────────────────────────────────────

// Category weights are no longer hand-tuned percentages. A category's share of
// the overall score is its *evidence mass* — the summed weight of its
// registered audits — derived in `audit-config.ts` as `CATEGORY_MASS` (spec §4).

/** Display names for the 8 v2 categories. */
export const CATEGORY_NAMES: Record<string, string> = {
  "access-crawl-control": "Access & Crawl Control",
  "content-extraction": "Content Extraction",
  "machine-discovery": "Machine Discovery",
  "structured-data": "Structured Data",
  "answer-readiness": "Answer Readiness",
  "agent-interfaces": "Agent Interfaces",
  "agentic-commerce": "Agentic Commerce",
  "operability-safety": "Agent Operability & Safety",
};

export const READINESS_WEIGHTS = {
  commerce: 0.4,
  content: 0.25,
  botAccessibility: 0.2,
  technical: 0.15,
} as const;

export function getScoreTier(score: number): ScoreTier {
  if (score >= 90) return "agent-ready";
  if (score >= 70) return "partially-ready";
  if (score >= 50) return "needs-work";
  return "not-ready";
}

export const SCORE_TIER_LABELS: Record<ScoreTier, string> = {
  "agent-ready": "Agent Ready",
  "partially-ready": "Partially Ready",
  "needs-work": "Needs Work",
  "not-ready": "Not Ready",
};

export function getTierLabel(tier: string | null): string {
  if (tier && tier in SCORE_TIER_LABELS) {
    return SCORE_TIER_LABELS[tier as ScoreTier];
  }
  return "N/A";
}

export function getTierColor(tier: string | null): string {
  switch (tier) {
    case "agent-ready":
      return "#10b981";
    case "partially-ready":
      return "#3b82f6";
    case "needs-work":
      return "#f59e0b";
    case "not-ready":
      return "#ef4444";
    default:
      return "#64748b";
  }
}
