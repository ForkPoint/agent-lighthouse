import type { CheckResult, CategoryResult } from './types';
import { CATEGORY_WEIGHTS, CATEGORY_NAMES, getScoreTier } from './constants';

export function calculateCategoryScore(checks: CheckResult[]): number {
  // Not-applicable checks are excluded from the average entirely — they
  // represent "nothing to assess", so counting them as 0 would unfairly
  // deflate the score for a feature the site was never expected to have.
  const scored = checks.filter((c) => c.status !== 'na');
  if (scored.length === 0) return 0;
  const total = scored.reduce((sum, c) => sum + c.score, 0);
  return Math.round((total / scored.length) * 100);
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
