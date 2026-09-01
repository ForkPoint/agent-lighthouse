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

/** Public sunset notice for a deprecated audit (see docs/evidence/sunset/not-a-factor.md). */
export interface DeprecationNotice {
  /** One sentence: why this signal is not a factor. */
  notice: string;
  /** Public rationale URL (not-a-factor.md anchor). */
  link: string;
}

/**
 * Strength of the published evidence backing an audit, assigned in the audit's
 * dossier per docs/evidence/policy.md. Only A and B carry scoring weight.
 */
export type EvidenceGrade = 'A' | 'B' | 'C' | 'D';

/**
 * How an audit participates in scoring. Derived from its evidence grade
 * (spec §4): only `scored` audits move a category score.
 */
export type AuditTier = 'scored' | 'informative' | 'experimental';

export interface AuditMeta {
  id: string;
  category: string;
  title: string;
  failureTitle: string;
  description: string;
  scoreDisplayMode: ScoreDisplayMode;
  weight: number;
  pageTypes?: PageType[];
  applicablePageTypes?: PageType[];
  defaultPriority: CheckPriority;
  guidance?: AuditGuidance;
  /** Present when the audit is sunset: shown as a notice, excluded from scores. */
  deprecated?: DeprecationNotice;
  /** Evidence grade from the audit's dossier (docs/evidence/policy.md). */
  evidenceGrade?: EvidenceGrade;
  /** Scoring tier derived from the grade (spec §4). */
  tier?: AuditTier;
  /** Repo-relative path to the audit's evidence dossier. */
  dossier?: string;
  /**
   * Which classes of scan evidence this audit needs to say anything true.
   *
   * Declared per audit rather than inferred at runtime, and checked against
   * what the source actually reads by `scripts/check-requires.mjs`. An audit
   * that reads the sampled pages — directly or through a page-fed gatherer —
   * needs all four keys; one that reads only root files needs the origin to
   * have answered. The deliberate disagreements are the audits whose subject
   * *is* the missing evidence, and they are listed in that script.
   */
  requires?: EvidenceKey[];
}

/**
 * A class of evidence a scan either obtained or did not.
 *
 * Declared here rather than in `scan-evidence.ts` so `AuditMeta` can name it
 * without the audit layer importing the scan layer.
 */
export type EvidenceKey =
  | 'origin-reachable'
  | 'unblocked-fetches'
  | 'rendered-body'
  | 'sample-adequate';

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
  /**
   * A fix written from what this scan actually found.
   *
   * Overrides `meta.guidance.fix` in the report, so an audit can name the
   * offending section rather than repeat the generic advice.
   */
  remediation?: string;
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
  /** Evidence-derived weight copied from AuditMeta.weight (A=1.0, B=0.6, informative=0). */
  weight?: number;
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
    /** The published evidence dossier for this check, derived from its id. */
    evidenceUrl?: string;
    [key: string]: unknown;
  };
  tags?: string[];
  /** Present when the audit is sunset: shown as a notice, excluded from scores. */
  deprecated?: DeprecationNotice;
  /** Evidence grade copied from AuditMeta.evidenceGrade. */
  evidenceGrade?: EvidenceGrade;
  /** Scoring tier copied from AuditMeta.tier. */
  tier?: AuditTier;
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
  registryMass?: number;
  assessedMass?: number;
}

// ── Scan Report ────────────────────────────────────────────────

export type ScoreTier = 'agent-ready' | 'partially-ready' | 'needs-work' | 'not-ready';

/**
 * Whether a verdict about this site can mean anything, and what is missing.
 *
 * A scan that fetched nothing still produced a number before this existed:
 * `ridge.com` scored 43 and `westontable.com` 37 on scans that read no page,
 * against a real store's 51. The numbers overlap, so a reader could not
 * separate "mediocre site" from "we never saw this site". When `judgeable` is
 * false the report carries no score at all — not a zero, not a low number.
 */
export interface ScanValidity {
  judgeable: boolean;
  evidence: Record<EvidenceKey, boolean>;
  reasons: Partial<Record<EvidenceKey, string>>;
  /** Why the score was suppressed, when it was. */
  unscoredReason?: string;
}

export interface ScanReport {
  scanId: string;
  url: string;
  domain: string;
  /** Null when the scan obtained too little evidence to judge the site. */
  overallScore: number | null;
  /** Null exactly when `overallScore` is. */
  scoreTier: ScoreTier | null;
  scanValidity?: ScanValidity;
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


