import type { WafProtection } from './waf-detector';
export type { WafProtection };

// ── Page Types ────────────────────────────────────────────────

export type PageType = 'homepage' | 'category' | 'product' | 'content';

export const PAGE_TYPE_LABELS: Record<PageType, string> = {
  homepage: 'Homepage',
  category: 'Category Page',
  product: 'Product Details Page',
  content: 'Content Page',
};

/**
 * A user-supplied page to scan with an explicit type.
 */
export interface PageOverride {
  url: string;
  pageType: PageType;
}

/** Per-field presence in a product page's structured data. */
export type FieldStatus = 'found' | 'partial' | 'missing';

/**
 * Field-level verification of a product page, read directly from its structured
 * data (JSON-LD + Microdata + RDFa).
 */
export interface ProductFieldVerification {
  sku: FieldStatus;
  gtin: FieldStatus;
  brand: FieldStatus;
  category: FieldStatus;
  availability: FieldStatus;
  priceCurrency: FieldStatus;
  stockLevel: FieldStatus;
  reviewCount: FieldStatus;
  sourceUrl?: string;
}

// ── Audit Guidance ────────────────────────────────────────────

export type FixEffort = 'trivial' | 'easy' | 'moderate' | 'complex';

export interface AuditGuidance {
  /** Customer-facing explanation of business impact when this audit fails */
  impact: string;
  /** Actionable, concise instructions to fix the issue */
  fix: string;
  /** Canonical code snippet showing the correct implementation */
  code?: string;
  /** Estimated effort to implement the fix */
  effort: FixEffort;
  /** Link to external documentation or spec */
  docsUrl?: string;
  /** Tags for filtering/grouping in the report UI */
  tags?: string[];
}

// ── Audit Meta ────────────────────────────────────────────────

export type ScoreDisplayMode = 'binary' | 'ternary' | 'informative';

export interface AuditMeta {
  id: string;
  category: string;
  title: string;
  failureTitle: string;
  description: string;
  scoreDisplayMode: ScoreDisplayMode;
  weight: number;
  applicablePageTypes?: PageType[];
  defaultPriority: CheckPriority;
  guidance?: AuditGuidance;
}

export interface AuditResult {
  status: CheckStatus;
  score: number;
  displayValue?: string;
  explanation?: string;
  expected?: string;
  found?: string;
  message?: string;
  details?: {
    expected?: string;
    found?: string;
    code?: string;
    [key: string]: unknown;
  };
  pageUrl?: string;
  priority?: CheckPriority;
}

// ── Check Results ──────────────────────────────────────────────

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'na';

export type CheckPriority = 'critical' | 'high' | 'medium' | 'low';

export interface CheckRecommendation {
  priority: CheckPriority;
  description: string;
  code?: string;
  docsUrl?: string;
}

export interface CheckResult {
  id: string;
  category: string;
  title: string;
  description: string;
  status: CheckStatus;
  score: number;
  scoreDisplayMode: ScoreDisplayMode;
  displayValue?: string;
  explanation?: string;
  pageUrl?: string;
  priority: CheckPriority;
  impact: string;
  fix: string;
  details?: {
    expected?: string;
    found?: string;
    code?: string;
    docsUrl?: string;
    [key: string]: unknown;
  };
  tags?: string[];
}

// ── Category Results ───────────────────────────────────────────

export interface CategoryResult {
  id: string;
  name: string;
  weight: number;
  score: number; // 0–100
  checks: CheckResult[];
  passCount: number;
  warnCount: number;
  failCount: number;
}

// ── Scan Report ────────────────────────────────────────────────

export type ScoreTier = 'agent-ready' | 'partially-ready' | 'needs-work' | 'not-ready';

export interface ScanReport {
  scanId: string;
  url: string;
  domain: string;
  overallScore: number;
  scoreTier: ScoreTier;
  summary?: string;
  categories: CategoryResult[];
  topPasses: CheckResult[];
  topFails: CheckResult[];
  categoryScores?: Record<string, number>;
  checkResults?: CheckResult[];
  recommendations: CheckRecommendation[];
  pagesScanned: Array<{ url: string; pageType: PageType }>;
  pagesData?: Array<{ url: string; pageType: PageType }>;
  scannedAt: string;
  createdAt?: string;
  durationMs: number;
  previousScore?: number;
  scoreDelta?: number;
  readinessScore?: number;
  readinessVitals?: ReadinessVitals;
  productFields?: ProductFieldVerification;
  wafProtection?: WafProtection;
}

export interface ReadinessVitals {
  commerce: number;
  content: number;
  botAccessibility: number;
  technical: number;
}


