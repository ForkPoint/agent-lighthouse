import type { ScoreTier } from './types';

// ── Scan Limits ────────────────────────────────────────────────

export const DEFAULT_SCAN_LIMIT = 5;
export const MAX_PAGES_PER_SCAN = 6; // 1 homepage + 5 internal
export const REQUEST_TIMEOUT_MS = 10_000;
export const SCAN_TIMEOUT_MS = 60_000;
export const MAX_RESPONSE_BODY_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_CONCURRENT_REQUESTS = 10;

// ── Scanner Identity ───────────────────────────────────────────

export const SCANNER_USER_AGENT =
  'AgentLighthouse/1.0 (+https://github.com/ForkPoint/agent-lighthouse)';

// ── Coverage tags ──────────────────────────────────────────────

export const TAG_SKIPPED_PAGE_TYPE = 'skipped:page-type';
export const TAG_SCAN_ERROR = 'scan-error';

// ── Scoring ────────────────────────────────────────────────────

export const CATEGORY_WEIGHTS: Record<string, number> = {
  'machine-discovery': 0.18,
  'access-crawl-control': 0.08,
  'structured-data': 0.12,
  'meta-tags': 0.03,
  'agent-tools': 0.18,
  'content-extraction': 0.1,
  accessibility: 0.07,
  'technical-readiness': 0.07,
  'answer-readiness': 0.17,
};

export const CATEGORY_NAMES: Record<string, string> = {
  'machine-discovery': 'Machine Discovery',
  'access-crawl-control': 'Access & Crawl Control',
  'structured-data': 'Structured Data & Schema Markup',
  'meta-tags': 'Meta Tags & AI Head Elements',
  'agent-tools': 'AI Agent Tools & Action Surfaces',
  'content-extraction': 'Content Extraction & Structure',
  accessibility: 'Accessibility & Agent Interaction',
  'technical-readiness': 'Technical Readiness & Security',
  'answer-readiness': 'Answer Readiness',
};

export const READINESS_WEIGHTS = {
  commerce: 0.4,
  content: 0.25,
  botAccessibility: 0.2,
  technical: 0.15,
} as const;

export function getScoreTier(score: number): ScoreTier {
  if (score >= 90) return 'agent-ready';
  if (score >= 70) return 'partially-ready';
  if (score >= 50) return 'needs-work';
  return 'not-ready';
}

export const SCORE_TIER_LABELS: Record<ScoreTier, string> = {
  'agent-ready': 'Agent Ready',
  'partially-ready': 'Partially Ready',
  'needs-work': 'Needs Work',
  'not-ready': 'Not Ready',
};

export function getTierLabel(tier: string | null): string {
  if (tier && tier in SCORE_TIER_LABELS) {
    return SCORE_TIER_LABELS[tier as ScoreTier];
  }
  return 'N/A';
}

export function getTierColor(tier: string | null): string {
  switch (tier) {
    case 'agent-ready':
      return '#10b981';
    case 'partially-ready':
      return '#3b82f6';
    case 'needs-work':
      return '#f59e0b';
    case 'not-ready':
      return '#ef4444';
    default:
      return '#64748b';
  }
}
