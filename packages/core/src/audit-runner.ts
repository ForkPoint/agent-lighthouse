import type { CheckResult, CategoryResult, EvidenceKey, PageType, AuditMeta } from './types';
import { logger } from './logger';
import { TAG_SKIPPED_PAGE_TYPE, TAG_SCAN_ERROR, TAG_SKIPPED_NO_EVIDENCE } from './constants';
import type { CheckContext } from './check-context';
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
  runnable: Array<{ reg: AuditRegistration; categoryId: string }>;
  skipped: CheckResult[];
}

/** How `planAudits` should treat audits the scan cannot feed. */
export interface PlanOptions {
  /**
   * Skip audits whose `requires` the scan did not obtain. **Defaults to true.**
   *
   * An audit's `requires` decides what a blocked or client-rendered scan
   * reports, so a caller that omits this option gets the gated set — the same
   * set a scan gets. Passing `false` is an explicit diagnostic opt-out for
   * comparing a gated run against an ungated one; it is never the default and
   * never what production takes.
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
function unmetRequirements(ctx: CheckContext, meta: AuditMeta): EvidenceKey[] {
  const required = meta.requires ?? [];
  if (required.length === 0) return [];

  const evidence = ctx.evidence;
  const unmet: EvidenceKey[] = [];
  for (const key of required) {
    if (key === 'sample-adequate') {
      const wanted = meta.applicablePageTypes?.length
        ? meta.applicablePageTypes
        : (['homepage'] as PageType[]);
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

  // `sample-adequate` can be met for the scan and unmet for this audit: the
  // scan read pages, just not of the type this audit needs. The scan-level
  // reason is empty in that case, and "no sample-adequate evidence" alone
  // tells a reader nothing.
  if (unmet.includes('sample-adequate') && reasons.length === 0) {
    const wanted = meta.applicablePageTypes?.length ? meta.applicablePageTypes.join('/') : 'homepage';
    return `Not assessed: no scanned ${wanted} page served readable text.`;
  }

  const why = reasons.length > 0 ? ` ${reasons.join(' ')}` : '';
  return `Not assessed: this scan has no ${unmet.join(', ')} evidence.${why}`;
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
): AuditPlan {
  // Collect the set of page types present in the scan context
  const scannedPageTypes = new Set(ctx.pages.map((p) => p.pageType));

  // Flatten all registrations for batched execution. Audits whose
  // applicablePageTypes don't match any scanned page type are not executed, but
  // recorded as `na` stubs so they remain visible in the report.
  const runnable: AuditPlan['runnable'] = [];
  const skipped: CheckResult[] = [];

  // One precondition above every other: the scan holds no response it can
  // attribute to this site, so no audit may say anything about it.
  //
  // This is scan-level and domain-neutral, which is the only kind of
  // precondition that belongs here — `requires` is already exactly that. An
  // artifact precondition stays in the gatherer that performs the read; see
  // docs/architecture/audits.md §12.
  //
  // It sits above `requires` rather than inside it because `requires` is the
  // audit's own claim about itself. Four audits declare none and were correct
  // only by hand-rolling this check inside `audit()`, and 142 of 215 audits
  // have no contract test that would catch the omission. An audit's protection
  // must not depend on the audit remembering.
  const unread = !scanReadTheSite(ctx.evidence);
  const unreadWhy = unread ? `Not assessed: ${unreadSiteReason(ctx.evidence)}` : '';
  for (const cat of config.categories) {
    const regs = config.audits[cat.id] ?? [];
    for (const reg of regs) {
      if (unread) {
        skipped.push(stubCheck(reg.meta, TAG_SKIPPED_NO_EVIDENCE, unreadWhy));
        continue;
      }
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
      if (options.enforceEvidence ?? true) {
        // Page-type mismatch is checked first, above, so no existing wording
        // changes. Only an audit the scan could have fed reaches this.
        const unmet = unmetRequirements(ctx, reg.meta);
        if (unmet.length > 0) {
          skipped.push(
            stubCheck(reg.meta, TAG_SKIPPED_NO_EVIDENCE, gateExplanation(ctx, reg.meta, unmet)),
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

  // Emit one record per audit, whatever became of it. Building the record
  // costs something, so it is skipped entirely unless someone is listening —
  // either a trace handler or a debug-level logger.
  const tracing = Boolean(onTrace) || logger.level === 'debug';
  const trace = (check: CheckResult, durationMs: number): void => {
    if (!tracing) return;
    const record = traceFromCheck(check, durationMs);
    logger.debug(formatTrace(record));
    onTrace?.(record);
  };

  // A skipped audit never entered `audit()`, so its duration is zero rather
  // than unmeasured.
  for (const stub of skipped) trace(stub, 0);

  // Run in batches of 20 (same concurrency as before)
  const batchSize = 20;
  for (let i = 0; i < runnable.length; i += batchSize) {
    const batch = runnable.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async ({ reg }) => {
        const label = `${reg.meta.id} ${reg.meta.title}`;
        const startedAt = tracing ? performance.now() : 0;
        const elapsed = () => (tracing ? Math.round(performance.now() - startedAt) : 0);
        try {
          const instance = reg.create();
          const result = await instance.audit(ctx);
          // `toCheckResult` stamps the evidence weight from the audit's meta.
          const check = instance.toCheckResult(result);
          onEvent?.({ type: 'unit:done', label });
          trace(check, elapsed());
          return check;
        } catch (err) {
          // Don't silently drop a throwing audit — record it as an errored
          // `na` stub so it stays visible in the report and in coverage.
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
