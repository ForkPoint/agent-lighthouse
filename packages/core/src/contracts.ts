/**
 * The values and shapes a scan report carries, with no runtime dependencies.
 *
 * This module is published on its own as
 * `@forkpoint/agent-lighthouse-core/contracts`, so a browser can read, label
 * and score-band a saved report without pulling in the scanner, its Node
 * imports or its parsers. It must import nothing.
 * `src/__tests__/contracts-entry.test.ts` holds the built entry to that.
 *
 * Every definition here lives here only. The root entry re-exports them, and
 * both builds share one chunk, so the two entries hand out the same objects.
 * Scanner settings, audit registration and UI colours stay out.
 *
 * Registry-wide numbers, such as each category's evidence mass, stay out too.
 * They describe the installed version, not the scan that wrote a report. A
 * report carries the mass it was scored with in `categories[].weight` and
 * `conditions.coverage.registryMass`; read it from there.
 */

// ── Page Types ────────────────────────────────────────────────

/**
 * Every page type, as an enum-style constant. Code names a type through this
 * object (`PageType.Product`); the values stay plain strings, so callers that
 * pass `"product"` through the SDK, CLI config or MCP still type-check.
 *
 * - `Article` is an editorial page: a blog post, news story or guide. It is
 *   the only type that carries author and date obligations.
 * - `General` is every other page that is not a homepage, listing or product:
 *   about, FAQ, help, contact, policy. It is also what the classifier reports
 *   when it cannot tell, with `ClassificationConfidence.Unknown`.
 */
export const PageType = {
  Homepage: "homepage",
  Category: "category",
  Product: "product",
  Article: "article",
  General: "general",
} as const;

export type PageType = (typeof PageType)[keyof typeof PageType];

/** Every page type value, in declaration order. */
export const PAGE_TYPES = Object.values(PageType) as [PageType, ...PageType[]];

export const PAGE_TYPE_LABELS: Record<PageType, string> = {
  homepage: "Homepage",
  category: "Category Page",
  product: "Product Details Page",
  article: "Article",
  general: "General page",
};

/** Whether a value is a page type that scan input accepts. */
export function isPageType(value: unknown): value is PageType {
  return (
    typeof value === "string" &&
    (PAGE_TYPES as readonly string[]).includes(value)
  );
}

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

/** Where a page payload came from: a fetch by the server, or a client capture. */
export const PayloadOrigin = {
  Fetched: "fetched",
  Supplied: "supplied",
} as const;

export type PayloadOrigin = (typeof PayloadOrigin)[keyof typeof PayloadOrigin];

/** One page's HTML, as page detection and a later scan read it. */
export interface PagePayload {
  url: string;
  html: string;
  origin: PayloadOrigin;
  /** SHA-256 of the HTML, computed by the server, never taken from the client. */
  sha256: string;
}

/** What page detection found in one payload. Detection fetches nothing. */
export interface PageIdentity {
  url: string;
  type: PageType;
  confidence: PageClassification["confidence"];
  signals: string[];
  payloadSha256: string;
  origin: PayloadOrigin;
  /** True for a truncated, redacted or still-loading capture. */
  partial: boolean;
  /** Set when the page is a gateway. Detection does not follow it. */
  gatewayTarget?: string;
}

/**
 * The detected identity a scan received with its target payload. Information
 * only: the source stays `detected`, so it never changes how a type scores.
 */
export interface ScanPageIdentity {
  type: PageType;
  source: PageTypeSource;
  detectionId?: string;
  payloadSha256: string;
  origin: PayloadOrigin;
}

/**
 * A user-supplied page to scan with an explicit type.
 */
export interface PageOverride {
  url: string;
  pageType: PageType;
}

// ── Categories ────────────────────────────────────────────────

/**
 * The 8 audit categories, in registry order: the order a raw scan iterates.
 * `audit-config.ts` keys the registry by this object, so a category cannot
 * be registered without appearing here.
 */
export const Category = {
  AccessCrawlControl: "access-crawl-control",
  ContentExtraction: "content-extraction",
  MachineDiscovery: "machine-discovery",
  StructuredData: "structured-data",
  AnswerReadiness: "answer-readiness",
  AgentInterfaces: "agent-interfaces",
  AgenticCommerce: "agentic-commerce",
  OperabilitySafety: "operability-safety",
} as const;

export type Category = (typeof Category)[keyof typeof Category];

/**
 * Every registered category id, in registry order.
 *
 * Typed as `string[]`, as it was before this module existed, so a caller can
 * still test an arbitrary string with `includes`.
 */
export const CATEGORY_IDS: readonly string[] = Object.values(Category);

/** Display names for the 8 categories. */
export const CATEGORY_NAMES: Record<string, string> = {
  "access-crawl-control": "Access & Crawl Control",
  "content-extraction": "Content Extraction",
  "machine-discovery": "Machine Discovery",
  "structured-data": "Structured Data",
  "answer-readiness": "Answer Readiness",
  "agent-interfaces": "Agent Interfaces",
  "agentic-commerce": "Agentic Commerce",
  "operability-safety": "Agent Operability & Safety",
} satisfies Record<Category, string>;

// ── Audit Meta ────────────────────────────────────────────────

export const FixEffort = {
  Trivial: "trivial",
  Easy: "easy",
  Moderate: "moderate",
  Complex: "complex",
} as const;

export type FixEffort = (typeof FixEffort)[keyof typeof FixEffort];

export const ScoreDisplayMode = {
  Binary: "binary",
  Ternary: "ternary",
  Informative: "informative",
} as const;

export type ScoreDisplayMode =
  (typeof ScoreDisplayMode)[keyof typeof ScoreDisplayMode];

/**
 * Why an audit carries a public notice instead of (or beside) a verdict.
 *
 * The three kinds make different claims, and each needs a different source:
 * `obsolete` says a consumer withdrew the thing, a vendor documents ignoring
 * it, or its spec is dead; `unconsumed` says only that no AI vendor documents
 * reading it, while it stays live; `deprecated` says the audit itself leaves
 * in the next major release (docs/evidence/policy.md, deprecation process).
 */
export const NoticeKind = {
  Deprecated: "deprecated",
  Obsolete: "obsolete",
  Unconsumed: "unconsumed",
} as const;

export type NoticeKind = (typeof NoticeKind)[keyof typeof NoticeKind];

/**
 * Public notice attached to an audit and copied onto every result it
 * produces. An `obsolete`-tier audit must carry one of kind `obsolete`.
 */
export interface DeprecationNotice {
  /** Absent means `deprecated`, the original and only meaning before 9.0. */
  kind?: NoticeKind;
  /** One sentence: why this signal is not a factor. */
  notice: string;
  /** Public rationale URL: the cited source or the audit's dossier. */
  link: string;
  /** What to publish instead, when anything replaces it. */
  replacement?: string;
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
 *
 * `informative` reports a live practice no consumer documents yet;
 * `obsolete` tells a site owner that something it publishes was retired,
 * is ignored by its consumer, or follows a dead spec. Obsolete audits carry
 * grade D and a `NoticeKind.Obsolete` notice, and never fail.
 */
export const AuditTier = {
  Scored: "scored",
  Informative: "informative",
  Experimental: "experimental",
  Obsolete: "obsolete",
} as const;

export type AuditTier = (typeof AuditTier)[keyof typeof AuditTier];

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

// ── Coverage tags ──────────────────────────────────────────────

/** An audit that did not run: no page of a type it applies to was scanned. */
export const TAG_SKIPPED_PAGE_TYPE = "skipped:page-type";
/** An audit that threw instead of returning a result. */
export const TAG_SCAN_ERROR = "scan-error";
/** An audit the scan could not feed: it needs evidence this scan never got. */
export const TAG_SKIPPED_NO_EVIDENCE = "skipped:no-evidence";
/** An audit the scan never started: its wall-clock budget ran out first. */
export const TAG_SKIPPED_SCAN_BUDGET = "skipped:scan-budget";

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

// ── Product Fields ─────────────────────────────────────────────

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

// ── Bot Protection ─────────────────────────────────────────────

export const WafProvider = {
  Akamai: "akamai",
  Cloudflare: "cloudflare",
  Datadome: "datadome",
  Perimeterx: "perimeterx",
  Imperva: "imperva",
  Kasada: "kasada",
  AwsWaf: "aws-waf",
  GenericWaf: "generic-waf",
  ConnectionDrop: "connection-drop",
  RateLimited: "rate-limited",
} as const;

export type WafProvider = (typeof WafProvider)[keyof typeof WafProvider];

export interface WafProtection {
  isBlocked: boolean;
  provider?: WafProvider;
  name: string;
  reason: string;
  statusCode?: number;
  /**
   * The scan was throttled, not refused.
   *
   * An HTTP 429 says "too many requests", which is a statement about this
   * scan's request rate and not about who the site admits. An audit that
   * cannot tell the two apart must not report a bot wall on the strength of
   * one — a storefront that serves GPTBot perfectly well would be told its
   * firewall is blocking AI crawlers.
   */
  isRateLimit?: boolean;
}

// ── Scan Report ────────────────────────────────────────────────

export const ScoreTier = {
  AgentReady: "agent-ready",
  PartiallyReady: "partially-ready",
  NeedsWork: "needs-work",
  NotReady: "not-ready",
} as const;

export type ScoreTier = (typeof ScoreTier)[keyof typeof ScoreTier];

/** The tier a 0–100 score falls in. */
export function getScoreTier(score: number): ScoreTier {
  if (score >= 90) return ScoreTier.AgentReady;
  if (score >= 70) return ScoreTier.PartiallyReady;
  if (score >= 50) return ScoreTier.NeedsWork;
  return ScoreTier.NotReady;
}

export const SCORE_TIER_LABELS: Record<ScoreTier, string> = {
  [ScoreTier.AgentReady]: "Agent Ready",
  [ScoreTier.PartiallyReady]: "Partially Ready",
  [ScoreTier.NeedsWork]: "Needs Work",
  [ScoreTier.NotReady]: "Not Ready",
};

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

export interface ReadinessVitals {
  commerce: number;
  content: number;
  botAccessibility: number;
  technical: number;
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
  /** Client-supplied DOM findings; never part of crawler scoring. */
  browserAssessment?: BrowserAssessment;
  /** The page detection this scan was started from, when it had one. */
  pageIdentity?: ScanPageIdentity;
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

// ── Browser snapshots ──────────────────────────────────────────

export const CaptureSource = {
  CurrentTab: "current-tab",
  FreshBrowser: "fresh-browser",
} as const;
export type CaptureSource = (typeof CaptureSource)[keyof typeof CaptureSource];

export const DocumentState = {
  Loading: "loading",
  Interactive: "interactive",
  Complete: "complete",
} as const;
export type DocumentState = (typeof DocumentState)[keyof typeof DocumentState];

export const EvidenceSource = {
  Http: "http",
  BrowserSnapshot: "browser-snapshot",
} as const;
export type EvidenceSource =
  (typeof EvidenceSource)[keyof typeof EvidenceSource];

export const SNAPSHOT_LIMITS = {
  maxPages: 6,
  maxHtmlBytes: 2 * 1024 * 1024,
  maxTotalHtmlBytes: 6 * 1024 * 1024,
  maxUrlLength: 2048,
} as const;

/**
 * DOM analysis limits for HTTP pages and browser snapshots. DOM audits climb
 * ancestors for each element, so their cost grows with the sum of element
 * depths: 8,000 nested elements (64M steps) took over 100 s.
 */
export const DOM_WORK_LIMITS = {
  /** Chromium's HTML parser stops nesting at 512, so a parsed page cannot be deeper. */
  maxDepth: 512,
  /** Summed element depth for a served page: room for 30,000+ element pages. */
  httpAncestorSteps: 3_000_000,
  /** Summed element depth for one uploaded capture; up to six run per scan. */
  snapshotAncestorSteps: 1_000_000,
} as const;

/** All capture metadata is asserted by the client, not verified by the server. */
export interface SnapshotCapture {
  requestedUrl: string;
  capturedUrl: string;
  capturedAt: string;
  captureSource: CaptureSource;
  collector: { name: string; version: string };
  documentState: DocumentState;
  truncation: { truncated: boolean; originalBytes?: number | undefined };
  redaction: { redacted: boolean; fields: string[] };
}
export interface BrowserSnapshot extends SnapshotCapture {
  html: string;
}
export interface BrowserSnapshots {
  version: 1;
  pages: BrowserSnapshot[];
}
export interface BrowserFinding {
  evidenceSource: typeof EvidenceSource.BrowserSnapshot;
  pageUrl: string;
  captureSource: CaptureSource;
  check: CheckResult;
}
export interface BrowserAssessment {
  version: 1;
  evidenceSource: typeof EvidenceSource.BrowserSnapshot;
  score: null;
  unscoredReason: string;
  captures: SnapshotCapture[];
  findings: BrowserFinding[];
  coverage: {
    /** Exact audited inventory after category/tier filters. */
    eligibleAuditIds: string[];
    /** Eligible audit/page pairs, including captures with missing evidence. */
    eligible: number;
    /** Completed audit/page pairs, including legitimate not-applicable results. */
    assessed: number;
  };
  /** Eligible audits without a verdict on one capture, with the reason. */
  missingEvidence: Array<{ auditId: string; pageUrl: string; reason: string }>;
  /** Audits snapshots cannot assess, listed once per assessment rather than once per capture. */
  notEligible: Array<{ auditIds: string[]; reason: string }>;
  limits: string[];
}
