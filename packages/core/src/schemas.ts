import { z } from 'zod';

export const CheckStatusSchema = z.enum(['pass', 'warn', 'fail', 'na']);
export const CheckPrioritySchema = z.enum(['critical', 'high', 'medium', 'low']);

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
    .optional(),
  pageUrl: z.string().max(2048).url().optional().or(z.string().max(2048).startsWith('/')).or(z.string().length(0)),
  priority: CheckPrioritySchema.optional(),
  code: z.string().max(10000).optional(),
});

export const FixEffortSchema = z.enum(['trivial', 'easy', 'moderate', 'complex']);

export const AuditGuidanceSchema = z.object({
  impact: z.string().max(5000),
  fix: z.string().max(5000),
  code: z.string().max(10000).optional(),
  effort: FixEffortSchema,
  docsUrl: z.string().max(2048).url().optional().or(z.string().length(0)),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export const ScoreDisplayModeSchema = z.enum(['binary', 'ternary', 'informative']);

export const AuditMetaSchema = z.object({
  id: z.string(),
  category: z.string(),
  title: z.string(),
  failureTitle: z.string(),
  description: z.string(),
  scoreDisplayMode: ScoreDisplayModeSchema,
  weight: z.number().positive(),
  applicablePageTypes: z.array(z.string()).optional(),
  defaultPriority: CheckPrioritySchema,
  guidance: AuditGuidanceSchema.optional(),
});

export const CheckResultSchema = z.object({
  id: z.string().max(20),
  category: z.string().max(100),
  title: z.string().max(500),
  description: z.string().max(5000),
  status: CheckStatusSchema,
  score: z.number().min(0).max(1),
  scoreDisplayMode: ScoreDisplayModeSchema,
  displayValue: z.string().max(1000).optional(),
  explanation: z.string().max(5000).optional(),
  pageUrl: z.string().max(2048).url().optional().or(z.string().max(2048).startsWith('/')).or(z.string().length(0)),
  priority: CheckPrioritySchema,
  impact: z.string().max(5000),
  fix: z.string().max(5000),
  details: z
    .object({
      expected: z.string().max(10000).optional(),
      found: z.string().max(10000).optional(),
      code: z.string().max(10000).optional(),
      docsUrl: z.string().max(2048).url().optional().or(z.string().length(0)),
    })
    .optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});
