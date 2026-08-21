import type { CheckResult, CategoryResult, EvidenceGrade, AuditTier } from './types';
import { CATEGORY_WEIGHTS, CATEGORY_NAMES, getScoreTier } from './constants';

/**
 * Spec §4 weight law: an audit's scoring weight is a pure function of its
 * evidence grade and tier. Only the `scored` tier carries weight, and only
 * grades A and B are proven enough to move a score.
 */
export function weightForGrade(grade: EvidenceGrade, tier: AuditTier): number {
  if (tier !== 'scored') return 0;
  return grade === 'A' ? 1.0 : grade === 'B' ? 0.6 : 0;
}

/**
 * Single source of truth for "this check is advisory only".
 *
 * Informative checks (deprecated audits / no proven consumer) are still shown
 * to the user, but they must never influence scores, recommendations, top
 * fails/passes or readiness vitals. Every surface that ranks or scores checks
 * filters through this predicate so the rule cannot drift per package.
 */
export function isInformative(check: Pick<CheckResult, 'scoreDisplayMode'>): boolean {
  return check.scoreDisplayMode === 'informative';
}

export function calculateCategoryScore(checks: CheckResult[]): number {
  // Not-applicable checks leave the denominator entirely: "nothing to
  // assess" must not move a score in either direction. Informative checks
  // are advisory only — excluded even if one ever carried a nonzero weight.
  const scored = checks.filter((c) => c.status !== 'na' && !isInformative(c));
  const totalWeight = scored.reduce((sum, c) => sum + (c.weight ?? 0), 0);
  if (totalWeight === 0) return 0;
  const weighted = scored.reduce((sum, c) => sum + c.score * (c.weight ?? 0), 0);
  return Math.round((weighted / totalWeight) * 100);
}

export function buildCategoryResult(
  id: string,
  checks: CheckResult[],
): CategoryResult {
  return {
    id,
    name: CATEGORY_NAMES[id] ?? id,
    weight: CATEGORY_WEIGHTS[id] ?? 0,
    score: calculateCategoryScore(checks),
    checks,
    passCount: checks.filter((c) => c.status === 'pass').length,
    warnCount: checks.filter((c) => c.status === 'warn').length,
    failCount: checks.filter((c) => c.status === 'fail').length,
  };
}

export function calculateOverallScore(categories: CategoryResult[]): number {
  return Math.round(
    categories.reduce((sum, cat) => sum + cat.score * cat.weight, 0),
  );
}

export { getScoreTier };
