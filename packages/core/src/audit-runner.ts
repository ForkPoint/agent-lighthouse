import type { CheckResult, CategoryResult, EvidenceKey, PageType, AuditMeta, ScoreDisplayMode } from './types';
import { logger } from './logger';
import { TAG_SKIPPED_PAGE_TYPE, TAG_SCAN_ERROR, TAG_SKIPPED_NO_EVIDENCE } from './constants';
import type { CheckContext, PageContext } from './check-context';
import type { ScanConfig, CategoryConfig, AuditRegistration } from './audit-config';
import { calculateCategoryScore, calculateOverallScore } from './scorer';
import { traceFromCheck, formatTrace, type AuditTrace } from './audit-trace';
import { scanReadTheSite, unreadSiteReason } from './scan-evidence';

/** How much of a failure message a report is willing to carry. */
const MAX_ERROR_CHARS = 400;

/**
 * A failure message a reader can act on.
 *
 * A Zod rejection stringifies to the whole issue tree — several hundred lines
 * of JSON for one bad field, repeated into every report the scan writes. The
 * part that identifies the defect is the path and the reason, so that is what
 * is kept: `details.ghosts: Expected string, received object` rather than the
 * tree it came from. Anything else is truncated instead of pasted whole.
 */
function describeError(err: unknown): string {
  const issues = (err as { issues?: Array<{ path?: unknown[]; message?: string }> })?.issues;
  if (Array.isArray(issues) && issues.length > 0) {
    const seen = new Set<string>();
    for (const issue of issues) {
      const where = (issue.path ?? []).join('.');
      seen.add(where ? `${where}: ${issue.message}` : String(issue.message));
      if (seen.size >= 3) break;
    }
    return [...seen].join('; ').slice(0, MAX_ERROR_CHARS);
  }
  const message = err instanceof Error ? err.message : String(err);
  return message.length > MAX_ERROR_CHARS ? `${message.slice(0, MAX_ERROR_CHARS - 1)}\u2026` : message;
}

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
    weight: meta.weight,
    scoreDisplayMode: meta.scoreDisplayMode,
    explanation,
    priority: meta.defaultPriority,
    impact: meta.guidance?.impact ?? '',
    fix: meta.guidance?.fix ?? '',
    tags: [tag],
    deprecated: meta.deprecated,
    evidenceGrade: meta.evidenceGrade,
    tier: meta.tier,
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

/**
 * Called once per registered audit, with what it did.
 *
 * Separate from {@link AuditProgressEvent}, which exists to drive a progress
 * bar and carries only a label. This carries the verdict and its evidence, and
 * fires for skipped and errored audits too — those are the ones worth seeing.
 */
export type AuditTraceHandler = (trace: AuditTrace) => void;

export interface AuditPlan {
  runnable: RunnableAudit[];
  skipped: CheckResult[];
}

/** How `planAudits` should treat audits the scan cannot feed. */
export interface PlanOptions {
  /**
   * Skip audits whose `requires` the scan did not obtain. **Defaults to true.**
   *
   * An audit's `requires` decides what a blocked or client-rendered scan
   * reports, so a caller that omits this option gets the gated set — the same
   * set a scan gets. A production diagnostic may pass `false` to bypass only
   * these per-audit `requires` checks. It is never the default, and it never
   * bypasses the unconditional unread-scan guard.
   */
  enforceEvidence?: boolean;
}

/**
 * Which of an audit's required evidence keys the scan did not obtain.
 *
 * `sample-adequate` is the one key that resolves per audit rather than per
 * scan: an audit is fed by pages of the types it declares, so it is unmet when
 * none of those types produced readable text. An audit that declares no page
 * types is fed by the homepage.
 */
/**
 * Runner scope decision function.
 *
 * Given an audit's meta and the scan context, decides both the page set the
 * audit receives and its scoreDisplayMode:
 *
 * 1. Universal audit (no pageTypes): receives all pages, meta display mode.
 * 2. Typed audit + at least one DECLARED matching page: receives all matching
 *    declared pages, meta display mode (scored).
 * 3. Typed audit + no declared match, but DETECTED matching page(s): receives
 *    matching detected pages, overridden display mode 'informative'.
 * 4. Neither: returns null (audit skipped for no matching page types).
 */
export interface AuditScope {
  pages: PageContext[];
  scoreDisplayMode: ScoreDisplayMode;
}

export function scopeAudit(ctx: CheckContext, meta: AuditMeta): AuditScope | null {
  const pageTypes = meta.pageTypes ?? meta.applicablePageTypes;
  if (!pageTypes || pageTypes.length === 0) {
    return { pages: ctx.pages, scoreDisplayMode: meta.scoreDisplayMode };
  }

  const declaredPages = ctx.pages.filter(
    (p) => pageTypes.includes(p.pageType) && p.pageTypeSource === 'declared',
  );
  if (declaredPages.length > 0) {
    return { pages: declaredPages, scoreDisplayMode: meta.scoreDisplayMode };
  }

  const detectedPages = ctx.pages.filter(
    (p) => pageTypes.includes(p.pageType) && p.pageTypeSource === 'detected',
  );
  if (detectedPages.length > 0) {
    return { pages: detectedPages, scoreDisplayMode: 'informative' };
  }

  return null;
}

function unmetRequirements(ctx: CheckContext, meta: AuditMeta): EvidenceKey[] {
  const required = meta.requires ?? [];
  if (required.length === 0) return [];

  const evidence = ctx.evidence;
  const unmet: EvidenceKey[] = [];
  const wanted = meta.pageTypes?.length
    ? meta.pageTypes
    : meta.applicablePageTypes?.length
    ? meta.applicablePageTypes
    : (['homepage'] as PageType[]);

  for (const key of required) {
    if (key === 'sample-adequate') {
      if (!wanted.some((type) => evidence.usablePageTypes.has(type))) unmet.push(key);
      continue;
    }
    if (!evidence.met[key]) unmet.push(key);
  }
  return unmet;
}

/** The sentence a gated stub carries: the key, and why the scan lacks it. */
function gateExplanation(ctx: CheckContext, meta: AuditMeta, unmet: EvidenceKey[]): string {
  const reasons = unmet.map((key) => ctx.evidence.reasons[key]).filter(Boolean);

  if (unmet.includes('sample-adequate') && reasons.length === 0) {
    const wanted = meta.pageTypes?.length
      ? meta.pageTypes.join('/')
      : meta.applicablePageTypes?.length
      ? meta.applicablePageTypes.join('/')
      : 'homepage';
    return `Not assessed: no scanned ${wanted} page served readable text.`;
  }

  const why = reasons.length > 0 ? ` ${reasons.join(' ')}` : '';
  return `Not assessed: this scan has no ${unmet.join(', ')} evidence.${why}`;
}

export interface RunnableAudit {
  reg: AuditRegistration;
  categoryId: string;
  scopedPages?: PageContext[];
  scoreDisplayMode?: ScoreDisplayMode;
}

/**
 * Split a scan config into the audits that will actually execute and the
 * `na` stubs for those it will not. Exported so the orchestrator can size the
 * audits progress phase before running it.
 */
export function planAudits(
  ctx: CheckContext,
  config: ScanConfig,
  options: PlanOptions = {},
): { runnable: RunnableAudit[]; skipped: CheckResult[] } {
  const runnable: RunnableAudit[] = [];
  const skipped: CheckResult[] = [];

  const unread = !scanReadTheSite(ctx.evidence);
  const unreadWhy = unread ? `Not assessed: ${unreadSiteReason(ctx.evidence)}` : '';
  for (const cat of config.categories) {
    const regs = config.audits[cat.id] ?? [];
    for (const reg of regs) {
      if (unread) {
        skipped.push(stubCheck(reg.meta, TAG_SKIPPED_NO_EVIDENCE, unreadWhy));
        continue;
      }
      const scope = scopeAudit(ctx, reg.meta);
      if (!scope) {
        const wanted = (reg.meta.pageTypes ?? reg.meta.applicablePageTypes ?? []).join('/');
        skipped.push(
          stubCheck(
            reg.meta,
            TAG_SKIPPED_PAGE_TYPE,
            `Not applicable: no scanned page is of type ${wanted}.`,
          ),
        );
        continue;
      }
      if (options.enforceEvidence ?? true) {
        const unmet = unmetRequirements(ctx, reg.meta);
        if (unmet.length > 0) {
          skipped.push(
            stubCheck(reg.meta, TAG_SKIPPED_NO_EVIDENCE, gateExplanation(ctx, reg.meta, unmet)),
          );
          continue;
        }
      }
      runnable.push({
        reg,
        categoryId: cat.id,
        scopedPages: scope.pages,
        scoreDisplayMode: scope.scoreDisplayMode,
      });
    }
  }
  return { runnable, skipped };
}

/**
 * Execute all audits registered in the config against the scan context.
 * Returns check results grouped into categories with weighted scores.
 * Pass a precomputed `plan` (from {@link planAudits}) to avoid recomputing it.
 */
export async function runAudits(
  ctx: CheckContext,
  config: ScanConfig,
  onEvent?: (event: AuditProgressEvent) => void,
  plan?: AuditPlan,
  onTrace?: AuditTraceHandler,
): Promise<AuditRunResult> {
  const { runnable, skipped } = plan ?? planAudits(ctx, config);
  const allChecks: CheckResult[] = [...skipped];

  const tracing = Boolean(onTrace) || logger.level === 'debug';
  const trace = (check: CheckResult, durationMs: number): void => {
    if (!tracing) return;
    const record = traceFromCheck(check, durationMs);
    logger.debug(formatTrace(record));
    onTrace?.(record);
  };

  for (const stub of skipped) trace(stub, 0);

  const batchSize = 20;
  for (let i = 0; i < runnable.length; i += batchSize) {
    const batch = runnable.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async ({ reg, scopedPages, scoreDisplayMode }) => {
        const label = `${reg.meta.id} ${reg.meta.title}`;
        const startedAt = tracing ? performance.now() : 0;
        const elapsed = () => (tracing ? Math.round(performance.now() - startedAt) : 0);
        try {
          const instance = reg.create();
          const scopedCtx = scopedPages ? { ...ctx, pages: scopedPages } : ctx;
          const result = await instance.audit(scopedCtx);
          const check = instance.toCheckResult(result, scoreDisplayMode);
          onEvent?.({ type: 'unit:done', label });
          trace(check, elapsed());
          return check;
        } catch (err) {
          logger.error({ err, auditId: reg.meta.id }, '[scanner] Audit error');
          const message = describeError(err);
          onEvent?.({ type: 'unit:fail', label, error: message });
          const stub = stubCheck(reg.meta, TAG_SCAN_ERROR, `Audit failed to run: ${message}`);
          trace(stub, elapsed());
          return stub;
        }
      }),
    );

    allChecks.push(...batchResults);
  }

  // Build category results
  const categories = config.categories.map((cat) => {
    const catChecks = allChecks.filter((c) => c.category === cat.id);
    return buildWeightedCategoryResult(cat, catChecks);
  });

  // One overall-score law for the whole engine: evidence-mass weighted (spec §4).
  const overallScore = calculateOverallScore(categories);

  return { checks: allChecks, categories, overallScore };
}

function buildWeightedCategoryResult(cat: CategoryConfig, checks: CheckResult[]): CategoryResult {
  return {
    id: cat.id,
    name: cat.name,
    weight: cat.weight,
    // One scorer for the whole engine: each check carries its own weight
    // (stamped by `toCheckResult`/`stubCheck`), and a check without one is
    // unproven evidence that must not move the score.
    score: calculateCategoryScore(checks),
    checks,
    passCount: checks.filter((c) => c.status === 'pass').length,
    warnCount: checks.filter((c) => c.status === 'warn').length,
    failCount: checks.filter((c) => c.status === 'fail').length,
  };
}
