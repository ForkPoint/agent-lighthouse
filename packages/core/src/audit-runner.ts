import type {
  CheckResult,
  CategoryResult,
  EvidenceKey,
  AuditMeta,
  ScoreDisplayMode,
  AuditCoverage,
} from "./types";
import { logger } from "./logger";
import {
  TAG_SKIPPED_PAGE_TYPE,
  TAG_SCAN_ERROR,
  TAG_SKIPPED_NO_EVIDENCE,
  TAG_SKIPPED_SCAN_BUDGET,
} from "./constants";
import type { CheckContext, PageContext } from "./check-context";
import type {
  ScanConfig,
  CategoryConfig,
  AuditRegistration,
} from "./audit-config";
import {
  assessedMassOf,
  calculateCategoryScore,
  calculateOverallScore,
} from "./scorer";
import { traceFromCheck, formatTrace, type AuditTrace } from "./audit-trace";
import {
  scanReadTheSite,
  unreadSiteReason,
  evidenceForPages,
  hasPageText,
} from "./scan-evidence";
import type { ScanEvidence } from "./scan-evidence";
import { CheckResultSchema } from "./schemas";
import { auditPageTypes, normalizeAuditMeta } from "./audit-applicability";
import { cacheOwner } from "./gatherers/cache-owner";

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
  const issues = (
    err as { issues?: Array<{ path?: unknown[]; message?: string }> }
  )?.issues;
  if (Array.isArray(issues) && issues.length > 0) {
    const seen = new Set<string>();
    for (const issue of issues) {
      const where = (issue.path ?? []).join(".");
      seen.add(where ? `${where}: ${issue.message}` : String(issue.message));
      if (seen.size >= 3) break;
    }
    return [...seen].join("; ").slice(0, MAX_ERROR_CHARS);
  }
  const message = err instanceof Error ? err.message : String(err);
  return message.length > MAX_ERROR_CHARS
    ? `${message.slice(0, MAX_ERROR_CHARS - 1)}\u2026`
    : message;
}

/**
 * Build a not-applicable stub for an audit that never produced a real verdict,
 * so it stays visible in the report (tagged with why) instead of vanishing.
 */
function stubCheck(
  meta: AuditMeta,
  tag: string,
  explanation: string,
): CheckResult {
  return {
    id: meta.id,
    category: meta.category,
    title: meta.title,
    description: meta.description,
    status: "na",
    score: 0,
    weight: meta.weight,
    scoreDisplayMode: meta.scoreDisplayMode,
    explanation,
    priority: meta.defaultPriority,
    impact: meta.guidance?.impact ?? "",
    fix: meta.guidance?.fix ?? "",
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
  | { type: "unit:done"; label: string }
  | { type: "unit:fail"; label: string; error: string };

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
 * Select primary and advisory populations separately. Universal audits use all
 * pages. A typed audit keeps declared matches as its primary population and
 * retains detected matches as advisory work. Detection never grants scoring
 * permission. Missing provenance is conservative detected input.
 */
export interface AuditScope {
  /** Primary population; declared pages score, detected-only pages inform. */
  pages: PageContext[];
  scoreDisplayMode: ScoreDisplayMode;
  provenance: AuditCoverage["provenance"];
  advisoryPages?: PageContext[];
}

function orderedPages(pages: PageContext[]): PageContext[] {
  return [...pages].sort((a, b) => (a.url ?? "").localeCompare(b.url ?? ""));
}

export function scopeAudit(
  ctx: CheckContext,
  meta: AuditMeta,
): AuditScope | null {
  const types = auditPageTypes(meta);
  if (!types?.length)
    return {
      pages: orderedPages(ctx.pages),
      scoreDisplayMode: meta.scoreDisplayMode,
      provenance: "all",
    };
  const matches = ctx.pages.filter((p) => types.includes(p.pageType));
  const declared = orderedPages(
    matches.filter((p) => p.pageTypeSource === "declared"),
  );
  const detected = orderedPages(
    matches.filter((p) => p.pageTypeSource !== "declared"),
  );
  const attempted = (source: "declared" | "detected") =>
    ctx.pageAttempts?.some(
      (p) => types.includes(p.pageType) && p.source === source,
    );
  if (declared.length || attempted("declared"))
    return {
      pages: declared,
      scoreDisplayMode: meta.scoreDisplayMode,
      provenance: "declared",
      ...(detected.length || attempted("detected")
        ? { advisoryPages: detected }
        : {}),
    };
  if (detected.length || attempted("detected"))
    return {
      pages: detected,
      scoreDisplayMode: "informative",
      provenance: "detected",
    };
  return null;
}

function unmetRequirements(ctx: CheckContext, meta: AuditMeta): EvidenceKey[] {
  return (meta.requires ?? []).filter((key) => !ctx.evidence.met[key]);
}

export interface PlannedAssessment {
  pages: PageContext[];
  evidence: ScanEvidence;
  scoreDisplayMode: ScoreDisplayMode;
  coverage: AuditCoverage;
  skipped?: CheckResult;
}

function planAssessment(
  ctx: CheckContext,
  meta: AuditMeta,
  pages: PageContext[],
  provenance: AuditCoverage["provenance"],
  scoreDisplayMode: ScoreDisplayMode,
  enforce: boolean,
): PlannedAssessment {
  const types = auditPageTypes(meta);
  const attempts = (ctx.pageAttempts ?? []).filter(
    (p) =>
      (!types?.length || types.includes(p.pageType)) &&
      (provenance === "all" || p.source === provenance),
  );
  const needsText = meta.requires?.some(
    (k) => k === "rendered-body" || k === "sample-adequate",
  );
  const inputs =
    enforce && needsText
      ? pages.filter((p) => hasPageText(ctx.evidence, p))
      : pages;
  const urls = (values: string[]) =>
    [...new Set(values.filter(Boolean))].sort();
  const coverage: AuditCoverage = {
    provenance,
    selectedUrls: urls([
      ...pages.map((p) => p.url),
      ...attempts.map((p) => p.url),
    ]),
    inputUrls: urls(inputs.map((p) => p.url)),
    unreadUrls: urls([
      ...pages.filter((p) => !hasPageText(ctx.evidence, p)).map((p) => p.url),
      ...attempts.filter((p) => p.outcome === "unread").map((p) => p.url),
    ]),
  };
  const evidence = evidenceForPages(ctx.evidence, inputs);
  const view = { ...ctx, pages: inputs, evidence };
  const unmet = enforce ? unmetRequirements(view, meta) : [];
  // A failed fetch must not turn into a vacuous verdict even for header-only checks.
  const failedPopulation =
    Boolean(types?.length) &&
    attempts.length > 0 &&
    inputs.length === 0 &&
    attempts.every((p) => p.outcome === "unread");
  const skipped =
    unmet.length || failedPopulation
      ? {
          ...stubCheck(
            meta,
            TAG_SKIPPED_NO_EVIDENCE,
            unmet.length
              ? gateExplanation(view, meta, unmet)
              : "Not assessed: no selected page could be fetched.",
          ),
          scoreDisplayMode,
          coverage: { ...coverage, inputUrls: [] },
        }
      : undefined;
  return {
    pages: inputs,
    evidence,
    scoreDisplayMode,
    coverage,
    ...(skipped ? { skipped } : {}),
  };
}

function combineAssessments(checks: CheckResult[]): CheckResult {
  const [primary, ...advisory] = checks;
  return {
    ...primary,
    ...(advisory.length ? { advisoryResults: advisory } : {}),
  };
}

/** The sentence a gated stub carries: the key, and why the scan lacks it. */
function gateExplanation(
  ctx: CheckContext,
  meta: AuditMeta,
  unmet: EvidenceKey[],
): string {
  const reasons = unmet.map((key) => ctx.evidence.reasons[key]).filter(Boolean);

  if (unmet.includes("sample-adequate") && reasons.length === 0) {
    const wanted = auditPageTypes(meta)?.join("/") || undefined;
    return wanted
      ? `Not assessed: no scanned ${wanted} page served readable text.`
      : "Not assessed: no scanned page of any type served readable text.";
  }

  const why = reasons.length > 0 ? ` ${reasons.join(" ")}` : "";
  return `Not assessed: this scan has no ${unmet.join(", ")} evidence.${why}`;
}

export interface RunnableAudit {
  reg: AuditRegistration;
  categoryId: string;
  scopedPages?: PageContext[];
  scoreDisplayMode?: ScoreDisplayMode;
  assessments?: PlannedAssessment[];
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
  const unreadWhy = unread
    ? `Not assessed: ${unreadSiteReason(ctx.evidence)}`
    : "";
  for (const cat of config.categories) {
    const regs = config.audits[cat.id] ?? [];
    for (const registration of regs) {
      const reg = {
        ...registration,
        meta: normalizeAuditMeta(registration.meta),
      };
      if (unread) {
        skipped.push(stubCheck(reg.meta, TAG_SKIPPED_NO_EVIDENCE, unreadWhy));
        continue;
      }
      const scope = scopeAudit(ctx, reg.meta);
      if (!scope) {
        const wanted = (reg.meta.applicablePageTypes ?? []).join("/");
        skipped.push(
          stubCheck(
            reg.meta,
            TAG_SKIPPED_PAGE_TYPE,
            `Not applicable: no scanned page is of type ${wanted}.`,
          ),
        );
        continue;
      }
      const enforce = options.enforceEvidence ?? true;
      const assessments = [
        planAssessment(
          ctx,
          reg.meta,
          scope.pages,
          scope.provenance,
          scope.scoreDisplayMode,
          enforce,
        ),
      ];
      if (scope.advisoryPages)
        assessments.push(
          planAssessment(
            ctx,
            reg.meta,
            scope.advisoryPages,
            "detected",
            "informative",
            enforce,
          ),
        );
      if (assessments.every((a) => a.skipped)) {
        skipped.push(combineAssessments(assessments.map((a) => a.skipped!)));
        continue;
      }
      runnable.push({
        reg,
        categoryId: cat.id,
        scopedPages: assessments[0].pages,
        scoreDisplayMode: scope.scoreDisplayMode,
        assessments,
      });
    }
  }
  return { runnable, skipped };
}

/** A budget as a sentence names it: whole seconds, or milliseconds under one. */
export function formatBudget(ms: number): string {
  return ms >= 1000 ? `${Math.round(ms / 1000)} s` : `${ms} ms`;
}

/** What an aborted budget signal says, for the stub that names it. */
export function budgetReason(signal: AbortSignal): string {
  const reason: unknown = signal.reason;
  // A bare abort() carries a DOMException whose text names no budget.
  if (
    reason instanceof Error &&
    !(reason instanceof DOMException) &&
    reason.message
  )
    return reason.message;
  return "The scan budget ran out.";
}

/**
 * Execute all audits registered in the config against the scan context.
 * Returns check results grouped into categories with weighted scores.
 * Pass a precomputed `plan` (from {@link planAudits}) to avoid recomputing it.
 *
 * `budget` is the scan's wall-clock budget. Once it is aborted, no further
 * audit is constructed, and none that was still running is believed: both
 * report `na` tagged {@link TAG_SKIPPED_SCAN_BUDGET}. The running one is
 * withheld because a request the budget refused answers with an error, and
 * an audit reads that error as a broken link or a missing artifact. That
 * would be a claim about the clock, not about the site.
 */
export async function runAudits(
  ctx: CheckContext,
  config: ScanConfig,
  onEvent?: (event: AuditProgressEvent) => void,
  plan?: AuditPlan,
  onTrace?: AuditTraceHandler,
  budget?: AbortSignal,
): Promise<AuditRunResult> {
  const { runnable, skipped } = plan ?? planAudits(ctx, config);
  const allChecks: CheckResult[] = [...skipped];

  const budgetStub = (entry: RunnableAudit): CheckResult => {
    const { reg, assessments } = entry;
    const label = `${reg.meta.id} ${reg.meta.title}`;
    const stub = stubCheck(
      reg.meta,
      TAG_SKIPPED_SCAN_BUDGET,
      `Not assessed: ${budgetReason(budget!)} This audit had not started.`,
    );
    if (typeof onEvent === "function") onEvent({ type: "unit:done", label });
    return assessments
      ? combineAssessments(
          assessments.map(
            (a) =>
              a.skipped ?? {
                ...stub,
                scoreDisplayMode: a.scoreDisplayMode,
                coverage: { ...a.coverage, inputUrls: [] },
              },
          ),
        )
      : stub;
  };

  const tracing = Boolean(onTrace) || logger.level === "debug";
  const trace = (check: CheckResult, durationMs: number): void => {
    if (!tracing) return;
    const record = traceFromCheck(check, durationMs);
    logger.debug(formatTrace(record));
    onTrace?.(record);
  };

  for (const stub of skipped) {
    onEvent?.({ type: "unit:done", label: `${stub.id} ${stub.title}` });
    trace(stub, 0);
  }

  const batchSize = 20;
  for (let i = 0; i < runnable.length; i += batchSize) {
    if (budget?.aborted) {
      for (const entry of runnable.slice(i)) {
        const stub = budgetStub(entry);
        trace(stub, 0);
        allChecks.push(stub);
      }
      break;
    }
    const batch = runnable.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async ({ reg, scopedPages, scoreDisplayMode, assessments }) => {
        if (budget?.aborted) {
          const stub = budgetStub({
            reg,
            categoryId: reg.meta.category,
            scopedPages,
            scoreDisplayMode,
            assessments,
          });
          trace(stub, 0);
          return stub;
        }
        const label = `${reg.meta.id} ${reg.meta.title}`;
        const startedAt = tracing ? performance.now() : 0;
        const elapsed = () =>
          tracing ? Math.round(performance.now() - startedAt) : 0;
        const execute = async (
          assessment?: PlannedAssessment,
        ): Promise<CheckResult> => {
          if (assessment?.skipped) return assessment.skipped;
          const mode = assessment?.scoreDisplayMode ?? scoreDisplayMode;
          const finish = (check: CheckResult): CheckResult => ({
            ...check,
            ...(mode ? { scoreDisplayMode: mode } : {}),
            ...(assessment ? { coverage: assessment.coverage } : {}),
          });
          if (budget?.aborted)
            return finish(
              stubCheck(
                reg.meta,
                TAG_SKIPPED_SCAN_BUDGET,
                `Not assessed: ${budgetReason(budget)}`,
              ),
            );
          try {
            const instance = reg.create();
            const pages = assessment?.pages ?? scopedPages ?? ctx.pages;
            const scopedCtx = {
              ...ctx,
              pages,
              evidence: assessment?.evidence ?? ctx.evidence,
              cacheOwner: cacheOwner(ctx),
            };
            const result = await instance.audit(scopedCtx);
            if (budget?.aborted)
              return finish(
                stubCheck(
                  reg.meta,
                  TAG_SKIPPED_SCAN_BUDGET,
                  `Not assessed: ${budgetReason(budget)} This audit was still running.`,
                ),
              );
            return CheckResultSchema.parse(
              finish(instance.toCheckResult(result, mode)),
            );
          } catch (err) {
            logger.error(
              { err, auditId: reg.meta.id },
              "[scanner] Audit error",
            );
            return finish(
              stubCheck(
                reg.meta,
                TAG_SCAN_ERROR,
                `Audit failed to run: ${describeError(err)}`,
              ),
            );
          }
        };
        // Separate instances preserve each population's verdict without sharing audit state.
        const checks: CheckResult[] = [];
        for (const assessment of assessments ?? [undefined])
          checks.push(await execute(assessment));
        const check = combineAssessments(checks);
        const failure = checks.find((c) => c.tags?.includes(TAG_SCAN_ERROR));
        if (failure)
          onEvent?.({
            type: "unit:fail",
            label,
            error:
              failure.explanation?.replace(/^Audit failed to run: /, "") ??
              "Audit error",
          });
        else onEvent?.({ type: "unit:done", label });
        trace(check, elapsed());
        return check;
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

function buildWeightedCategoryResult(
  cat: CategoryConfig,
  checks: CheckResult[],
): CategoryResult {
  return {
    id: cat.id,
    name: cat.name,
    weight: cat.weight,
    // `calculateOverallScore` weights a category by what it assessed, and
    // falls back to the registry mass only when this is absent. It must be
    // set here, on the path every scan takes, or the fallback is the rule.
    registryMass: cat.weight,
    assessedMass: assessedMassOf(checks),
    // One scorer for the whole engine: each check carries its own weight
    // (stamped by `toCheckResult`/`stubCheck`), and a check without one is
    // unproven evidence that must not move the score.
    score: calculateCategoryScore(checks),
    checks,
    passCount: checks.filter((c) => c.status === "pass").length,
    warnCount: checks.filter((c) => c.status === "warn").length,
    failCount: checks.filter((c) => c.status === "fail").length,
  };
}
