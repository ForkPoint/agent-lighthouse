import type { WafProtection } from "./waf-detector";
export type { WafProtection };

// ── Page Types ────────────────────────────────────────────────

/**
 * Every page type, as an enum-style constant. Code names a type through this
 * object (`PageType.Product`); the values stay plain strings, so callers that
 * pass `"product"` through the SDK, CLI config or MCP still type-check.
 *
 * `Content` is a legacy general-content declaration, never an article claim.
 * A live scan never produces it: `declaredPageClassification` maps it to
 * `Unknown`.
 */
export const PageType = {
  Homepage: "homepage",
  Category: "category",
  Product: "product",
  Article: "article",
  Unknown: "unknown",
  Content: "content",
} as const;

export type PageType = (typeof PageType)[keyof typeof PageType];

/** Every page type value, in declaration order. */
export const PAGE_TYPES = Object.values(PageType) as [PageType, ...PageType[]];

/** Who decided a page's type: the operator, or the scanner's classifier. */
export const PageTypeSource = {
  Declared: "declared",
  Detected: "detected",
} as const;

export type PageTypeSource =
  (typeof PageTypeSource)[keyof typeof PageTypeSource];

/** Signal strength is diagnostic; detected types remain informative. */
export const ClassificationConfidence = {
  Strong: "strong",
  Hint: "hint",
  Unknown: "unknown",
} as const;

export type ClassificationConfidence =
  (typeof ClassificationConfidence)[keyof typeof ClassificationConfidence];

export interface PageClassification {
  type: PageType;
  source: PageTypeSource;
  confidence: ClassificationConfidence;
  signals: string[];
}

export const PAGE_TYPE_LABELS: Record<PageType, string> = {
  homepage: "Homepage",
  category: "Category Page",
  product: "Product Details Page",
  article: "Article",
  unknown: "General / unknown purpose",
  content: "General content (legacy)",
};

/**
 * A user-supplied page to scan with an explicit type.
 */
export interface PageOverride {
  url: string;
  pageType: PageType;
}

/** Per-field presence in a product page's structured data. */
export const FieldStatus = {
  Found: "found",
  Partial: "partial",
  Missing: "missing",
} as const;

export type FieldStatus = (typeof FieldStatus)[keyof typeof FieldStatus];

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

export const FixEffort = {
  Trivial: "trivial",
  Easy: "easy",
  Moderate: "moderate",
  Complex: "complex",
} as const;

export type FixEffort = (typeof FixEffort)[keyof typeof FixEffort];

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

export const ScoreDisplayMode = {
  Binary: "binary",
  Ternary: "ternary",
  Informative: "informative",
} as const;

export type ScoreDisplayMode =
  (typeof ScoreDisplayMode)[keyof typeof ScoreDisplayMode];

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
export const EvidenceGrade = {
  A: "A",
  B: "B",
  C: "C",
  D: "D",
} as const;

export type EvidenceGrade = (typeof EvidenceGrade)[keyof typeof EvidenceGrade];

/**
 * How an audit participates in scoring. Derived from its evidence grade
 * (spec §4): only `scored` audits move a category score.
 */
export const AuditTier = {
  Scored: "scored",
  Informative: "informative",
  Experimental: "experimental",
} as const;

export type AuditTier = (typeof AuditTier)[keyof typeof AuditTier];

export interface AuditMeta {
  id: string;
  category: string;
  title: string;
  failureTitle: string;
  description: string;
  scoreDisplayMode: ScoreDisplayMode;
  weight: number;
  /** Legacy alias; conflicting aliases are rejected at the runner boundary. */
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
export const EvidenceKey = {
  OriginReachable: "origin-reachable",
  UnblockedFetches: "unblocked-fetches",
  RenderedBody: "rendered-body",
  SampleAdequate: "sample-adequate",
} as const;

export type EvidenceKey = (typeof EvidenceKey)[keyof typeof EvidenceKey];

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

/** HTTP methods the scanner's fetcher sends. */
export const HttpMethod = {
  Get: "GET",
  Post: "POST",
  Options: "OPTIONS",
  Head: "HEAD",
  Delete: "DELETE",
} as const;

export type HttpMethod = (typeof HttpMethod)[keyof typeof HttpMethod];

// ── Check Results ──────────────────────────────────────────────

export const CheckStatus = {
  Pass: "pass",
  Warn: "warn",
  Fail: "fail",
  NotApplicable: "na",
} as const;

export type CheckStatus = (typeof CheckStatus)[keyof typeof CheckStatus];

export const CheckPriority = {
  Critical: "critical",
  High: "high",
  Medium: "medium",
  Low: "low",
} as const;

export type CheckPriority = (typeof CheckPriority)[keyof typeof CheckPriority];

export interface CheckRecommendation {
  priority: CheckPriority;
  description: string;
  code?: string;
  docsUrl?: string;
}

/** URLs considered and passed to one audit execution. Missing text is not absence. */
export const CoverageProvenance = {
  All: "all",
  Declared: "declared",
  Detected: "detected",
} as const;

export type CoverageProvenance =
  (typeof CoverageProvenance)[keyof typeof CoverageProvenance];

export interface AuditCoverage {
  provenance: CoverageProvenance;
  selectedUrls: string[];
  inputUrls: string[];
  unreadUrls: string[];
}

/** Whether a requested page parsed into a page context. */
export const AttemptOutcome = {
  Read: "read",
  Unread: "unread",
} as const;

export type AttemptOutcome =
  (typeof AttemptOutcome)[keyof typeof AttemptOutcome];

export interface PageAttempt {
  url: string;
  pageType: PageType;
  source: PageTypeSource;
  outcome: AttemptOutcome;
  status: number;
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
  /** Per-execution input coverage, absent in older reports. */
  coverage?: AuditCoverage;
  /** Other matching pages, always advisory; never counted as another audit weight. */
  advisoryResults?: Array<Omit<CheckResult, "advisoryResults">>;
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

export const ScoreTier = {
  AgentReady: "agent-ready",
  PartiallyReady: "partially-ready",
  NeedsWork: "needs-work",
  NotReady: "not-ready",
} as const;

export type ScoreTier = (typeof ScoreTier)[keyof typeof ScoreTier];

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
  pagesScanned: Array<{
    url: string;
    pageType: PageType;
    classification?: PageClassification;
  }>;
  pageAttempts?: PageAttempt[];
  pagesData?: ScanReport["pagesScanned"];
  scannedAt: string;
  createdAt?: string;
  durationMs: number;
  previousScore?: number;
  scoreDelta?: number;
  readinessScore?: number;
  readinessVitals?: ReadinessVitals;
  productFields?: ProductFieldVerification;
  wafProtection?: WafProtection;
  originEvidence?: {
    origin: string;
    version: string;
    readAt: string;
    cached: boolean;
  };
  conditions?: ScanConditions;
}

export interface ScanConditions {
  url: string;
  pageType: {
    type: PageType;
    source: PageTypeSource;
    confidence?: ClassificationConfidence;
    signals?: string[];
  };
  origin: {
    origin: string;
    version: string;
    readAt: string;
    cached: boolean;
  };
  coverage: {
    registryMass: number;
    assessedMass: number;
    pageMass: number;
    originMass: number;
    gatedMass: number;
  };
  unscored: {
    totalCount: number;
    informativeCount: number;
    gatedCount: number;
    reasons: Record<string, number>;
  };
  /** The wall-clock budget the scan ran under, and whether it ran out. */
  budget?: {
    limitMs: number;
    elapsedMs: number;
    exhausted: boolean;
    /** Audits reported `na` because the budget ran out before they started. */
    skippedCount: number;
  };
}

export interface ReadinessVitals {
  commerce: number;
  content: number;
  botAccessibility: number;
  technical: number;
}
