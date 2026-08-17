import type { CheckResult, CategoryResult } from './types';
import { CATEGORY_WEIGHTS, CATEGORY_NAMES } from './constants';
import { calculateCategoryScore, buildCategoryResult, calculateOverallScore } from './scorer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCheck(overrides: Partial<CheckResult> = {}): CheckResult {
  return {
    id: 'test-check',
    category: 'test',
    title: 'Test Check',
    description: 'Test Description',
    status: 'pass',
    score: 1.0,
    scoreDisplayMode: 'binary',
    priority: 'medium',
    impact: 'Low',
    fix: 'Fix it',
    explanation: 'OK',
    details: { expected: 'Expected', found: 'Found' },
    ...overrides,
  };
}

function makeCategory(overrides: Partial<CategoryResult> = {}): CategoryResult {
  return {
    id: 'test',
    name: 'Test Category',
    weight: 0.5,
    score: 100,
    checks: [],
    passCount: 0,
    warnCount: 0,
    failCount: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// calculateCategoryScore
// ---------------------------------------------------------------------------

describe('calculateCategoryScore', () => {
  it('returns 100 when all checks pass (score 1.0)', () => {
    const checks = [
      makeCheck({ score: 1.0 }),
      makeCheck({ score: 1.0 }),
      makeCheck({ score: 1.0 }),
    ];
    expect(calculateCategoryScore(checks)).toBe(100);
  });

  it('returns 0 when all checks fail (score 0.0)', () => {
    const checks = [
      makeCheck({ score: 0.0, status: 'fail' }),
      makeCheck({ score: 0.0, status: 'fail' }),
      makeCheck({ score: 0.0, status: 'fail' }),
    ];
    expect(calculateCategoryScore(checks)).toBe(0);
  });

  it('returns 50 for mixed results (1 pass, 1 warn, 1 fail)', () => {
    const checks = [
      makeCheck({ score: 1.0, status: 'pass' }),
      makeCheck({ score: 0.5, status: 'warn' }),
      makeCheck({ score: 0.0, status: 'fail' }),
    ];
    expect(calculateCategoryScore(checks)).toBe(50);
  });

  it('returns 0 for an empty checks array', () => {
    expect(calculateCategoryScore([])).toBe(0);
  });

  it('rounds to the nearest integer', () => {
    // 2 pass + 1 fail = 2/3 = 0.6667 * 100 = 66.67 → 67
    const checks = [
      makeCheck({ score: 1.0 }),
      makeCheck({ score: 1.0 }),
      makeCheck({ score: 0.0 }),
    ];
    expect(calculateCategoryScore(checks)).toBe(67);
  });

  it('handles a single check', () => {
    expect(calculateCategoryScore([makeCheck({ score: 0.5 })])).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// buildCategoryResult
// ---------------------------------------------------------------------------

describe('buildCategoryResult', () => {
  it('returns correct id, name, weight from constants', () => {
    const categoryId = 'structured-data';
    const checks = [makeCheck({ category: categoryId })];
    const result = buildCategoryResult(categoryId, checks);

    expect(result.id).toBe(categoryId);
    expect(result.name).toBe(CATEGORY_NAMES[categoryId]);
    expect(result.weight).toBe(CATEGORY_WEIGHTS[categoryId]);
  });

  it('falls back to id as name when category is unknown', () => {
    const result = buildCategoryResult('unknown-category', []);
    expect(result.name).toBe('unknown-category');
    expect(result.weight).toBe(0);
  });

  it('calculates passCount, warnCount, failCount correctly', () => {
    const checks = [
      makeCheck({ status: 'pass', score: 1.0 }),
      makeCheck({ status: 'pass', score: 1.0 }),
      makeCheck({ status: 'warn', score: 0.5 }),
      makeCheck({ status: 'fail', score: 0.0 }),
    ];
    const result = buildCategoryResult('meta-tags', checks);
    expect(result.passCount).toBe(2);
    expect(result.warnCount).toBe(1);
    expect(result.failCount).toBe(1);
  });

  it('score matches calculateCategoryScore output', () => {
    const checks = [
      makeCheck({ score: 1.0 }),
      makeCheck({ score: 0.5 }),
      makeCheck({ score: 0.0 }),
    ];
    const result = buildCategoryResult('accessibility', checks);
    expect(result.score).toBe(calculateCategoryScore(checks));
  });

  it('includes the checks array in the result', () => {
    const checks = [makeCheck()];
    const result = buildCategoryResult('semantic-html', checks);
    expect(result.checks).toBe(checks);
  });
});

// ---------------------------------------------------------------------------
// calculateOverallScore
// ---------------------------------------------------------------------------

describe('calculateOverallScore', () => {
  it('computes weighted average correctly', () => {
    const categories: CategoryResult[] = [
      makeCategory({ score: 80, weight: 0.5 }),
      makeCategory({ score: 60, weight: 0.5 }),
    ];
    // (80 * 0.5) + (60 * 0.5) = 40 + 30 = 70
    expect(calculateOverallScore(categories)).toBe(70);
  });

  it('returns 100 when all categories score 100', () => {
    const categories: CategoryResult[] = [
      makeCategory({ score: 100, weight: 0.4 }),
      makeCategory({ score: 100, weight: 0.6 }),
    ];
    expect(calculateOverallScore(categories)).toBe(100);
  });

  it('returns 0 when all categories score 0', () => {
    const categories: CategoryResult[] = [
      makeCategory({ score: 0, weight: 0.4 }),
      makeCategory({ score: 0, weight: 0.6 }),
    ];
    expect(calculateOverallScore(categories)).toBe(0);
  });

  it('returns 15 for single category at 100 with weight 0.15 and rest at 0', () => {
    const categories: CategoryResult[] = [
      makeCategory({ score: 100, weight: 0.15 }),
      makeCategory({ score: 0, weight: 0.85 }),
    ];
    expect(calculateOverallScore(categories)).toBe(15);
  });

  it('rounds the result', () => {
    const categories: CategoryResult[] = [
      makeCategory({ score: 33, weight: 0.33 }),
      makeCategory({ score: 67, weight: 0.67 }),
    ];
    // (33 * 0.33) + (67 * 0.67) = 10.89 + 44.89 = 55.78 → 56
    expect(calculateOverallScore(categories)).toBe(56);
  });

  it('returns 0 for empty categories array', () => {
    expect(calculateOverallScore([])).toBe(0);
  });

  it('handles categories with zero weight', () => {
    const categories: CategoryResult[] = [
      makeCategory({ score: 100, weight: 0 }),
      makeCategory({ score: 50, weight: 1.0 }),
    ];
    expect(calculateOverallScore(categories)).toBe(50);
  });
});
