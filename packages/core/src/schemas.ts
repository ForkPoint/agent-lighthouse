import {
  CaptureSource,
  DocumentState,
  EvidenceSource,
  FieldStatus,
  ScoreTier,
  WafProvider,
  SNAPSHOT_LIMITS,
} from "./contracts";
import { z } from "zod";
import {
  AttemptOutcome,
  AuditTier,
  CheckPriority,
  CheckStatus,
  ClassificationConfidence,
  CoverageProvenance,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  LEGACY_PAGE_TYPES,
  PageType,
  PageTypeSource,
  ScoreDisplayMode,
} from "./types";

export const CheckStatusSchema = z.enum(CheckStatus);
export const CheckPrioritySchema = z.enum(CheckPriority);

const DetailValueSchema = z.union([
  z.string().max(10000),
  z.number(),
  z.boolean(),
  z.array(z.string().max(1000)).max(100),
]);

export const AuditResultSchema = z.object({
  status: CheckStatusSchema,
  score: z.number().min(0).max(1),
  displayValue: z.string().max(1000).optional(),
  explanation: z.string().max(5000).optional(),
  expected: z.string().max(10000).optional(),
  found: z.string().max(10000).optional(),
  message: z.string().max(5000).optional(),
  details: z
    .object({
      expected: z.string().max(10000).optional(),
      found: z.string().max(10000).optional(),
      code: z.string().max(10000).optional(),
    })
    // Audits attach structured evidence beside the prose — counts, booleans,
    // ids. A closed object dropped all of it silently, which is how
    // agent-governance's trainingAgents/realtimeAgents/hasCatchAll never
    // reached a report. Unknown keys are kept, but only as scalars: nested
    // objects would let an audit smuggle unbounded payloads into the JSON
    // report. A bounded array of strings is allowed because audits report
    // named sets (which crawlers, which endpoints) as lists.
    .catchall(DetailValueSchema)
    .optional(),
  pageUrl: z
    .string()
    .max(2048)
    .url()
    .optional()
    .or(z.string().max(2048).startsWith("/"))
    .or(z.string().length(0)),
  priority: CheckPrioritySchema.optional(),
  /** A fix written from what this scan found, which beats the generic one in meta.guidance. */
  remediation: z.string().max(5000).optional(),
  code: z.string().max(10000).optional(),
});

export const FixEffortSchema = z.enum(FixEffort);

export const AuditGuidanceSchema = z.object({
  impact: z.string().max(5000),
  fix: z.string().max(5000),
  code: z.string().max(10000).optional(),
  effort: FixEffortSchema,
  docsUrl: z.string().max(2048).url().optional().or(z.string().length(0)),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export const ScoreDisplayModeSchema = z.enum(ScoreDisplayMode);

export const DeprecationNoticeSchema = z.object({
  notice: z.string().min(1).max(500),
  link: z.string().url(),
});

/** Evidence strength from the audit's dossier (docs/evidence/policy.md). */
export const EvidenceGradeSchema = z.enum(EvidenceGrade);
/** Scoring participation tier (spec §4). */
export const AuditTierSchema = z.enum(AuditTier);

/** v2 audit identity: `category/slug`, stable across releases (spec §6). */
export const AUDIT_ID_PATTERN = /^[a-z-]+\/[a-z0-9-]+$/;

export const EvidenceKeySchema = z.enum(EvidenceKey);

/** A retired page-type name is refused with an error that names its replacement. */
export const PageTypeSchema = z.enum(PageType, {
  error: (issue) =>
    typeof issue.input === "string" &&
    Object.hasOwn(LEGACY_PAGE_TYPES, issue.input)
      ? `"${issue.input}" was renamed to "${LEGACY_PAGE_TYPES[issue.input]}" in v7`
      : undefined,
});

/**
 * A page type read from a saved report. Reports written before v7 carry
 * `unknown` or `content`; both read as `general`, so an old report still
 * parses. Input schemas use `PageTypeSchema`, which refuses the old names.
 */
export const StoredPageTypeSchema = z.preprocess(
  (value) =>
    typeof value === "string" && Object.hasOwn(LEGACY_PAGE_TYPES, value)
      ? LEGACY_PAGE_TYPES[value]
      : value,
  PageTypeSchema,
);

export const AuditMetaSchema = z.object({
  id: z
    .string()
    .regex(AUDIT_ID_PATTERN, "audit id must be a `category/slug` path"),
  category: z.string(),
  title: z.string(),
  failureTitle: z.string(),
  description: z.string(),
  scoreDisplayMode: ScoreDisplayModeSchema,
  // 0 is legal: informative-tier and deprecated audits report evidence without
  // moving the score, so they carry weight 0 and stay out of the denominator.
  weight: z.number().nonnegative(),
  pageTypes: z.array(PageTypeSchema).optional(),
  applicablePageTypes: z.array(PageTypeSchema).optional(),
  defaultPriority: CheckPrioritySchema,
  guidance: AuditGuidanceSchema.optional(),
  deprecated: DeprecationNoticeSchema.optional(),
  // v2 taxonomy fields, now required: every registered audit must state where
  // its weight comes from (grade + tier) and which dossier proves it.
  evidenceGrade: EvidenceGradeSchema,
  tier: AuditTierSchema,
  dossier: z.string().min(1).max(500),
  // What the audit needs the scan to have obtained. Checked against the
  // source by `scripts/check-requires.mjs`, not enforced here beyond shape.
  requires: z.array(EvidenceKeySchema).optional(),
});

export const AuditCoverageSchema = z.object({
  provenance: z.enum(CoverageProvenance),
  selectedUrls: z.array(z.string().max(2048)),
  inputUrls: z.array(z.string().max(2048)),
  unreadUrls: z.array(z.string().max(2048)),
});

const CheckAssessmentSchema = z.object({
  // v2 ids are `category/slug` paths, which outgrew the old 20-char cap.
  id: z.string().max(64),
  category: z.string().max(100),
  title: z.string().max(500),
  description: z.string().max(5000),
  status: CheckStatusSchema,
  score: z.number().min(0).max(1),
  scoreDisplayMode: ScoreDisplayModeSchema,
  displayValue: z.string().max(1000).optional(),
  explanation: z.string().max(5000).optional(),
  pageUrl: z
    .string()
    .max(2048)
    .url()
    .optional()
    .or(z.string().max(2048).startsWith("/"))
    .or(z.string().length(0)),
  priority: CheckPrioritySchema,
  impact: z.string().max(5000),
  fix: z.string().max(5000),
  details: z
    .object({
      expected: z.string().max(10000).optional(),
      found: z.string().max(10000).optional(),
      code: z.string().max(10000).optional(),
      docsUrl: z.string().max(2048).url().optional().or(z.string().length(0)),
      // Derived in `toCheckResult` from the audit id. The catchall below would
      // already admit it as a plain string; declaring it here buys the checks
      // the catchall does not make — that it parses as a URL, and that it fits
      // the same 2048 budget as docsUrl.
      evidenceUrl: z.string().max(2048).url().optional(),
      effort: FixEffortSchema.optional(),
    })
    // Same rule as AuditResultSchema: structured evidence survives, nested
    // payloads do not.
    .catchall(DetailValueSchema)
    .optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  deprecated: DeprecationNoticeSchema.optional(),
  // Copied from the audit's meta so downstream surfaces can filter by
  // evidence strength without reaching back into the registry.
  evidenceGrade: EvidenceGradeSchema.optional(),
  tier: AuditTierSchema.optional(),
  weight: z.number().nonnegative().optional(),
  coverage: AuditCoverageSchema.optional(),
});

export const CheckResultSchema = CheckAssessmentSchema.extend({
  advisoryResults: z
    .array(
      CheckAssessmentSchema.extend({
        scoreDisplayMode: z.literal(ScoreDisplayMode.Informative),
      }),
    )
    .optional(),
});

export const PageClassificationSchema = z.object({
  type: StoredPageTypeSchema,
  source: z.enum(PageTypeSource),
  confidence: z.enum(ClassificationConfidence),
  signals: z.array(z.string()),
});

/** Old saved pages keep their recorded type without invented classification. */
export const ScannedPageSchema = z.object({
  url: z.string(),
  pageType: StoredPageTypeSchema,
  classification: PageClassificationSchema.optional(),
});

export const PageAttemptSchema = z.object({
  url: z.string(),
  pageType: StoredPageTypeSchema,
  source: z.enum(PageTypeSource),
  outcome: z.enum(AttemptOutcome),
  status: z.number().int().nonnegative(),
});

/** Shared manual page declarations for SDK, CLI config and MCP. */
export const PageScopeOptionsSchema = z.object({
  pageType: PageTypeSchema.optional(),
  pages: z
    .array(
      z.object({
        url: z.string().url(),
        pageType: PageTypeSchema,
      }),
    )
    .nullable()
    .optional(),
});

export const ScanConditionsSchema = z.object({
  url: z.string().url().max(2048),
  pageType: z.object({
    type: StoredPageTypeSchema,
    source: z.enum(PageTypeSource),
    confidence: z.enum(ClassificationConfidence).optional(),
    signals: z.array(z.string()).optional(),
  }),
  origin: z.object({
    origin: z.string().max(2048),
    version: z.string().max(64),
    readAt: z.string().max(64),
    cached: z.boolean(),
  }),
  coverage: z.object({
    registryMass: z.number().nonnegative(),
    assessedMass: z.number().nonnegative(),
    pageMass: z.number().nonnegative(),
    originMass: z.number().nonnegative(),
    gatedMass: z.number().nonnegative(),
  }),
  unscored: z.object({
    totalCount: z.number().int().nonnegative(),
    informativeCount: z.number().int().nonnegative(),
    gatedCount: z.number().int().nonnegative(),
    reasons: z.record(z.string(), z.number().int().nonnegative()),
  }),
  // Optional: reports written before the budget existed carry no block.
  budget: z
    .object({
      limitMs: z.number().nonnegative(),
      elapsedMs: z.number().nonnegative(),
      exhausted: z.boolean(),
      skippedCount: z.number().int().nonnegative(),
    })
    .optional(),
});

/** HTTP(S) identifiers only. Validation does not authorize a network request. */
const SnapshotUrlSchema = z
  .string()
  .min(1)
  .max(SNAPSHOT_LIMITS.maxUrlLength)
  .refine(
    // Reject controls before URL parsing can trim them.
    // oxlint-disable-next-line no-control-regex
    (value) => !/[\u0000-\u0020\u007f]/.test(value),
    "Snapshot URLs must not contain whitespace or control characters",
  )
  .url()
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        ["http:", "https:"].includes(url.protocol) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }, "Snapshot URLs require HTTP(S) and must not contain credentials");

/**
 * Association key for snapshot URLs, scan targets and page overrides. It drops
 * fragments and credentials and ignores a trailing slash on the path, as the
 * orchestrator does for page overrides. The query stays exact: `?next=/` and
 * `?next=` are different pages.
 */
export function snapshotUrlKey(value: string): string {
  const url = new URL(value);
  url.hash = "";
  url.username = "";
  url.password = "";
  url.pathname = url.pathname.replace(/(.)\/$/, "$1");
  return url.href;
}

/** Capture identity: requested and captured URLs may differ only by fragment. */
function captureUrlKey(value: string): string {
  const url = new URL(value);
  url.hash = "";
  return url.href;
}

/** UTF-8 byte length without allocating an encoded copy of a multi-megabyte string. */
function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (
      code >= 0xd800 &&
      code <= 0xdbff &&
      i + 1 < value.length &&
      (value.charCodeAt(i + 1) & 0xfc00) === 0xdc00
    ) {
      bytes += 4;
      i++;
    } else bytes += 3; // Includes a lone surrogate, which encodes as U+FFFD.
  }
  return bytes;
}

/** Client-supplied label: one line, no control characters, so no renderer can be fed forged lines. */
const SnapshotLabelSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine(
    // oxlint-disable-next-line no-control-regex
    (value) => !/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(value),
    "Snapshot labels must not contain line breaks or control characters",
  );

export const SnapshotCaptureSchema = z.strictObject({
  requestedUrl: SnapshotUrlSchema,
  capturedUrl: SnapshotUrlSchema,
  capturedAt: z.iso.datetime({ offset: true }),
  captureSource: z.enum(CaptureSource),
  collector: z.strictObject({
    name: SnapshotLabelSchema,
    version: SnapshotLabelSchema,
  }),
  documentState: z.enum(DocumentState),
  truncation: z.strictObject({
    truncated: z.boolean(),
    originalBytes: z.number().int().nonnegative().optional(),
  }),
  redaction: z.strictObject({
    redacted: z.boolean(),
    fields: z.array(SnapshotLabelSchema).max(100),
  }),
});

export const BrowserSnapshotSchema = SnapshotCaptureSchema.extend({
  // The length bound is a cheap pre-check; the byte bound follows in superRefine.
  html: z.string().min(1).max(SNAPSHOT_LIMITS.maxHtmlBytes),
}).superRefine((snapshot, ctx) => {
  const bytes = utf8ByteLength(snapshot.html);
  if (bytes > SNAPSHOT_LIMITS.maxHtmlBytes)
    ctx.addIssue({
      code: "custom",
      path: ["html"],
      message: "Snapshot HTML exceeds the UTF-8 byte limit",
    });
  if (
    SnapshotUrlSchema.safeParse(snapshot.requestedUrl).success &&
    SnapshotUrlSchema.safeParse(snapshot.capturedUrl).success &&
    captureUrlKey(snapshot.requestedUrl) !== captureUrlKey(snapshot.capturedUrl)
  )
    ctx.addIssue({
      code: "custom",
      path: ["capturedUrl"],
      message:
        "Captured URL does not match requested URL (only fragments may differ)",
    });
  if (!snapshot.redaction.redacted && snapshot.redaction.fields.length)
    ctx.addIssue({
      code: "custom",
      path: ["redaction"],
      message: "Unredacted captures must have an empty fields list",
    });
  if (
    snapshot.truncation.originalBytes !== undefined &&
    snapshot.truncation.originalBytes < bytes
  )
    ctx.addIssue({
      code: "custom",
      path: ["truncation"],
      message: "originalBytes must be at least the supplied HTML byte size",
    });
});

export const BrowserSnapshotsSchema = z
  .strictObject({
    version: z.literal(1),
    pages: z.array(BrowserSnapshotSchema).min(1).max(SNAPSHOT_LIMITS.maxPages),
  })
  .superRefine((input, ctx) => {
    const keys = input.pages
      .filter((page) => SnapshotUrlSchema.safeParse(page.requestedUrl).success)
      .map((page) => snapshotUrlKey(page.requestedUrl));
    if (new Set(keys).size !== keys.length)
      ctx.addIssue({
        code: "custom",
        path: ["pages"],
        message: "Duplicate snapshot URL association",
      });
    const bytes = input.pages.reduce(
      (sum, page) => sum + utf8ByteLength(page.html),
      0,
    );
    if (bytes > SNAPSHOT_LIMITS.maxTotalHtmlBytes)
      ctx.addIssue({
        code: "custom",
        path: ["pages"],
        message: "Snapshot batch exceeds the total UTF-8 byte limit",
      });
  });

export const BrowserAssessmentSchema = z.object({
  version: z.literal(1),
  evidenceSource: z.literal(EvidenceSource.BrowserSnapshot),
  score: z.null(),
  unscoredReason: z.string().min(1).max(5000),
  captures: z.array(SnapshotCaptureSchema).max(SNAPSHOT_LIMITS.maxPages),
  findings: z.array(
    z.object({
      evidenceSource: z.literal(EvidenceSource.BrowserSnapshot),
      pageUrl: SnapshotUrlSchema,
      captureSource: z.enum(CaptureSource),
      check: CheckResultSchema,
    }),
  ),
  coverage: z.object({
    eligibleAuditIds: z.array(z.string().max(64)),
    eligible: z.number().int().nonnegative(),
    assessed: z.number().int().nonnegative(),
  }),
  missingEvidence: z.array(
    z.object({
      auditId: z.string().max(64),
      pageUrl: SnapshotUrlSchema,
      reason: z.string().min(1).max(5000),
    }),
  ),
  notEligible: z.array(
    z.object({
      auditIds: z.array(z.string().max(64)).min(1),
      reason: z.string().min(1).max(5000),
    }),
  ),
  limits: z.array(z.string().max(1000)),
});

/** Shared optional input for SDK adapters, CLI config and MCP. */
export const SnapshotScanOptionsSchema = PageScopeOptionsSchema.extend({
  snapshots: BrowserSnapshotsSchema.optional(),
});

/** Validate a complete saved report without discarding its browser assessment. */
export const ScanReportSchema = z.object({
  scanId: z.string(),
  url: z.string().url(),
  domain: z.string(),
  overallScore: z.number().min(0).max(100).nullable(),
  scoreTier: z.enum(ScoreTier).nullable(),
  scanValidity: z
    .object({
      judgeable: z.boolean(),
      evidence: z.record(EvidenceKeySchema, z.boolean()),
      reasons: z.partialRecord(EvidenceKeySchema, z.string()),
      unscoredReason: z.string().optional(),
    })
    .optional(),
  summary: z.string().optional(),
  categories: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      weight: z.number(),
      score: z.number(),
      checks: z.array(CheckResultSchema),
      passCount: z.number(),
      warnCount: z.number(),
      failCount: z.number(),
      registryMass: z.number().optional(),
      assessedMass: z.number().optional(),
    }),
  ),
  topPasses: z.array(CheckResultSchema),
  topFails: z.array(CheckResultSchema),
  categoryScores: z.record(z.string(), z.number()).optional(),
  checkResults: z.array(CheckResultSchema).optional(),
  recommendations: z.array(
    z.looseObject({
      priority: CheckPrioritySchema,
      description: z.string(),
      code: z.string().optional(),
      docsUrl: z.string().optional(),
    }),
  ),
  pagesScanned: z.array(ScannedPageSchema),
  pageAttempts: z.array(PageAttemptSchema).optional(),
  pagesData: z.array(ScannedPageSchema).optional(),
  scannedAt: z.string(),
  createdAt: z.string().optional(),
  durationMs: z.number(),
  previousScore: z.number().optional(),
  scoreDelta: z.number().optional(),
  readinessScore: z.number().optional(),
  readinessVitals: z
    .object({
      commerce: z.number(),
      content: z.number(),
      botAccessibility: z.number(),
      technical: z.number(),
    })
    .optional(),
  productFields: z
    .object({
      sku: z.enum(FieldStatus),
      gtin: z.enum(FieldStatus),
      brand: z.enum(FieldStatus),
      category: z.enum(FieldStatus),
      availability: z.enum(FieldStatus),
      priceCurrency: z.enum(FieldStatus),
      stockLevel: z.enum(FieldStatus),
      reviewCount: z.enum(FieldStatus),
      sourceUrl: z.string().optional(),
    })
    .optional(),
  wafProtection: z
    .object({
      isBlocked: z.boolean(),
      provider: z.enum(WafProvider).optional(),
      name: z.string(),
      reason: z.string(),
      statusCode: z.number().optional(),
      isRateLimit: z.boolean().optional(),
    })
    .optional(),
  originEvidence: ScanConditionsSchema.shape.origin.optional(),
  conditions: ScanConditionsSchema.optional(),
  browserAssessment: BrowserAssessmentSchema.optional(),
});

const buildSnapshotsJsonSchema = () =>
  z.toJSONSchema(BrowserSnapshotsSchema, { unrepresentable: "any" });
let snapshotsJsonSchema:
  ReturnType<typeof buildSnapshotsJsonSchema> | undefined;

/**
 * JSON Schema advertises shape and limits; runtime refinements remain authoritative.
 * Built on first call, so importing core (CLI startup) does not pay for it.
 */
export function browserSnapshotsJsonSchema(): ReturnType<
  typeof buildSnapshotsJsonSchema
> {
  return (snapshotsJsonSchema ??= buildSnapshotsJsonSchema());
}
