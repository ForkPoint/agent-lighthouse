import type { CheckResult, CheckStatus } from './types';
import { TAG_SCAN_ERROR, TAG_SKIPPED_PAGE_TYPE } from './constants';

/**
 * What one audit did, in a form that can be diffed.
 *
 * A report says what an audit concluded. Tracing bad logic needs more: which
 * audits never ran and why, how long each took, and what evidence each verdict
 * was drawn from. That is the difference between "this site failed
 * `faqpage-schema`" and "`faqpage-schema` ran in 4ms against 0 sampled pages",
 * and only the second one tells you where to look.
 *
 * One record per registered audit, every scan, no exceptions — an audit that
 * crashed or was skipped is exactly the one worth seeing.
 */
export interface AuditTrace {
  id: string;
  category: string;
  /**
   * `ran` — the audit executed and returned.
   * `skipped` — no scanned page matched its `applicablePageTypes`.
   * `error` — it threw, or its result was rejected by the schema.
   */
  outcome: 'ran' | 'skipped' | 'error';
  status: CheckStatus;
  score: number;
  weight: number;
  tier?: string;
  evidenceGrade?: string;
  /** Wall time inside `audit()`. Zero for an audit that never ran. */
  durationMs: number;
  displayValue?: string;
  explanation?: string;
  pageUrl?: string;
  /** The structured evidence behind the verdict, as the report carries it. */
  details?: CheckResult['details'];
}

/** Which of the three outcomes a finished check represents. */
export function outcomeOf(check: CheckResult): AuditTrace['outcome'] {
  const tags = check.tags ?? [];
  if (tags.includes(TAG_SCAN_ERROR)) return 'error';
  if (tags.includes(TAG_SKIPPED_PAGE_TYPE)) return 'skipped';
  return 'ran';
}

/** Build a trace record from a finished check. */
export function traceFromCheck(check: CheckResult, durationMs: number): AuditTrace {
  return {
    id: check.id,
    category: check.category,
    outcome: outcomeOf(check),
    status: check.status,
    score: check.score,
    weight: check.weight ?? 0,
    ...(check.tier ? { tier: check.tier } : {}),
    ...(check.evidenceGrade ? { evidenceGrade: check.evidenceGrade } : {}),
    durationMs,
    ...(check.displayValue ? { displayValue: check.displayValue } : {}),
    ...(check.explanation ? { explanation: check.explanation } : {}),
    ...(check.pageUrl ? { pageUrl: check.pageUrl } : {}),
    ...(check.details ? { details: check.details } : {}),
  };
}

/** One trace as a log line: the shape a human scans, not the full record. */
export function formatTrace(trace: AuditTrace): string {
  const timing = trace.outcome === 'ran' ? ` ${trace.durationMs}ms` : '';
  const value = trace.displayValue ? ` — ${trace.displayValue}` : '';
  return `[audit] ${trace.id} ${trace.outcome}/${trace.status} score=${trace.score} weight=${trace.weight}${timing}${value}`;
}
