import type { CheckResult, CategoryResult } from './types';
import { CATEGORY_WEIGHTS, CATEGORY_NAMES, getScoreTier } from './constants';

export function calculateCategoryScore(checks: CheckResult[]): number {
  // Not-applicable checks leave the denominator entirely: "nothing to
  // assess" must not move a score in either direction.
  const scored = checks.filter((c) => c.status !== 'na');
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
