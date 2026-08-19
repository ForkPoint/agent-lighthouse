import type { CheckResult, CategoryResult, PageType, AuditMeta } from './types';
import { logger } from './logger';
import { TAG_SKIPPED_PAGE_TYPE, TAG_SCAN_ERROR } from './constants';
import type { CheckContext } from './check-context';
import type { ScanConfig, CategoryConfig, AuditRegistration } from './audit-config';

/**
 * Build a not-applicable stub for an audit that never produced a real verdict,
 * so it stays visible in the report (tagged with why) instead of vanishing.
 */
function stubCheck(meta: AuditMeta, tag: string, explanation: string): CheckResult {
  return {
    id: meta.id,
    category: meta.category,
    title: meta.title,
    description: meta.description,
    status: 'na',
    score: 0,
    scoreDisplayMode: meta.scoreDisplayMode,
    explanation,
    priority: meta.defaultPriority,
    impact: meta.guidance?.impact ?? '',
    fix: meta.guidance?.fix ?? '',
    tags: [tag],
  };
}

export interface AuditRunResult {
  checks: CheckResult[];
  categories: CategoryResult[];
  overallScore: number;
}

/**
 * Progress emitted per settled audit. The orchestrator forwards these into the
 * ProgressTracker, which owns counting and fraction/elapsed stamping.
 */
export type AuditProgressEvent =
  | { type: 'unit:done'; label: string }
  | { type: 'unit:fail'; label: string; error: string };

export interface AuditPlan {
  runnable: Array<{ reg: AuditRegistration; categoryId: string }>;
  skipped: CheckResult[];
}

/**
 * Split a scan config into the audits that will actually execute and the
 * page-type-skipped `na` stubs. Exported so the orchestrator can size the
 * audits progress phase before running it.
 */
export function planAudits(ctx: CheckContext, config: ScanConfig): AuditPlan {
  // Collect the set of page types present in the scan context
  const scannedPageTypes = new Set(ctx.pages.map((p) => p.pageType));

  // Flatten all registrations for batched execution. Audits whose
  // applicablePageTypes don't match any scanned page type are not executed, but
  // recorded as `na` stubs so they remain visible in the report.
  const runnable: AuditPlan['runnable'] = [];
  const skipped: CheckResult[] = [];
  for (const cat of config.categories) {
    const regs = config.audits[cat.id] ?? [];
    for (const reg of regs) {
      const applicable = reg.meta.applicablePageTypes;
      if (applicable && applicable.length > 0) {
        if (!applicable.some((pt: PageType) => scannedPageTypes.has(pt))) {
          skipped.push(
            stubCheck(
              reg.meta,
              TAG_SKIPPED_PAGE_TYPE,
              `Not applicable: no scanned page is of type ${applicable.join('/')}.`,
            ),
          );
          continue;
        }
      }
      runnable.push({ reg, categoryId: cat.id });
    }
  }
  return { runnable, skipped };
}

/**
 * Execute all audits registered in the config against the scan context.
 * Returns check results grouped into categories with weighted scores.
 */
export async function runAudits(
  ctx: CheckContext,
  config: ScanConfig,
  onEvent?: (event: AuditProgressEvent) => void,
): Promise<AuditRunResult> {
  const { runnable, skipped } = planAudits(ctx, config);
  const allChecks: CheckResult[] = [...skipped];

  // Run in batches of 20 (same concurrency as before)
  const batchSize = 20;
  for (let i = 0; i < runnable.length; i += batchSize) {
    const batch = runnable.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async ({ reg }) => {
        const label = `${reg.meta.id} ${reg.meta.title}`;
        try {
          const instance = reg.create();
          const result = await instance.audit(ctx);
          const check = instance.toCheckResult(result);
          onEvent?.({ type: 'unit:done', label });
          return check;
        } catch (err) {
          // Don't silently drop a throwing audit — record it as an errored
          // `na` stub so it stays visible in the report and in coverage.
          logger.error({ err, auditId: reg.meta.id }, '[scanner] Audit error');
          const message = err instanceof Error ? err.message : String(err);
          onEvent?.({ type: 'unit:fail', label, error: message });
          return stubCheck(reg.meta, TAG_SCAN_ERROR, `Audit failed to run: ${message}`);
        }
      }),
    );

    allChecks.push(...batchResults);
  }

  // Build category results
  const categories = config.categories.map((cat) => {
    const catChecks = allChecks.filter((c) => c.category === cat.id);
    const catRegs = config.audits[cat.id] ?? [];
    return buildWeightedCategoryResult(cat, catChecks, catRegs);
  });

  const overallScore = Math.round(categories.reduce((sum, cat) => sum + cat.score * cat.weight, 0));

  return { checks: allChecks, categories, overallScore };
}

function buildWeightedCategoryResult(
  cat: CategoryConfig,
  checks: CheckResult[],
  registrations: AuditRegistration[],
): CategoryResult {
  if (checks.length === 0) {
    return {
      id: cat.id,
      name: cat.name,
      weight: cat.weight,
      score: 0,
      checks,
      passCount: 0,
      warnCount: 0,
      failCount: 0,
    };
  }

  // Build weight map: auditId → weight
  const weightMap = new Map<string, number>();
  for (const reg of registrations) {
    weightMap.set(reg.meta.id, reg.meta.weight);
  }

  // Not-applicable checks represent "nothing to assess" — exclude them from the
  // weighted average so they don't deflate the category score.
  let totalWeight = 0;
  let weightedSum = 0;
  for (const check of checks) {
    if (check.status === 'na') continue;
    const w = weightMap.get(check.id) ?? 1.0;
    weightedSum += check.score * w;
    totalWeight += w;
  }

  const score = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0;

  return {
    id: cat.id,
    name: cat.name,
    weight: cat.weight,
    score,
    checks,
    passCount: checks.filter((c) => c.status === 'pass').length,
    warnCount: checks.filter((c) => c.status === 'warn').length,
    failCount: checks.filter((c) => c.status === 'fail').length,
  };
}
