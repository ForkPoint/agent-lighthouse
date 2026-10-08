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
  PageType,
  PageTypeSource,
  ScoreDisplayMode,
} from "./types";

export const CheckStatusSchema = z.enum(CheckStatus);
export const CheckPrioritySchema = z.enum(CheckPriority);

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
    .catchall(
      z.union([
        z.string().max(10000),
        z.number(),
        z.boolean(),
        z.array(z.string().max(1000)).max(100),
      ]),
    )
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

export const PageTypeSchema = z.enum(PageType);

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
    .catchall(
      z.union([
        z.string().max(10000),
        z.number(),
        z.boolean(),
        z.array(z.string().max(1000)).max(100),
      ]),
    )
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
  type: PageTypeSchema,
  source: z.enum(PageTypeSource),
  confidence: z.enum(ClassificationConfidence),
  signals: z.array(z.string()),
});

/** Old saved pages keep their recorded type without invented classification. */
export const ScannedPageSchema = z.object({
  url: z.string(),
  pageType: PageTypeSchema,
  classification: PageClassificationSchema.optional(),
});

export const PageAttemptSchema = z.object({
  url: z.string(),
  pageType: PageTypeSchema,
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
    type: PageTypeSchema,
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
