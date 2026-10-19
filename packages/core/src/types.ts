// Everything a saved scan report carries lives in `contracts.ts`, the
// dependency-free public entry. It is re-exported here so core modules and the
// root entry keep importing it from `types`.
import {
  type AuditTier,
  type CheckPriority,
  type CheckStatus,
  type DeprecationNotice,
  type EvidenceGrade,
  type EvidenceKey,
  type FixEffort,
  PageType,
  type ScoreDisplayMode,
} from "./contracts";

export {
  AttemptOutcome,
  AuditTier,
  Category,
  CheckPriority,
  CheckStatus,
  ClassificationConfidence,
  CoverageProvenance,
  EvidenceGrade,
  EvidenceKey,
  FieldStatus,
  FixEffort,
  isPageType,
  NoticeKind,
  PAGE_TYPE_LABELS,
  PAGE_TYPES,
  PageType,
  PageTypeSource,
  ScoreDisplayMode,
  ScoreTier,
  WafProvider,
} from "./contracts";
export type {
  AuditCoverage,
  CategoryResult,
  CheckRecommendation,
  CheckResult,
  DeprecationNotice,
  PageAttempt,
  PageClassification,
  PageOverride,
  ProductFieldVerification,
  ReadinessVitals,
  ScanConditions,
  ScanReport,
  ScanValidity,
  WafProtection,
} from "./contracts";

// ── Page Types ────────────────────────────────────────────────

/**
 * Page-type names retired in v7, each with the type that replaced it. Readers
 * of saved reports map these; input parsers name the replacement in their
 * error.
 */
export const LEGACY_PAGE_TYPES: Readonly<Record<string, PageType>> = {
  unknown: PageType.General,
  content: PageType.General,
};

// ── Audit Guidance ────────────────────────────────────────────

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
