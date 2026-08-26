import type { CheckResult, CategoryResult } from './types';
import { CATEGORY_NAMES } from './constants';
import { CATEGORY_MASS, defaultConfig } from './audit-config';
import {
  calculateCategoryScore,
  buildCategoryResult,
  calculateOverallScore,
  gatedMassShare,
  GATED_MASS_UNSCORED_THRESHOLD,
} from './scorer';

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
    // Equal weight by default: these cases describe the equal-weight behaviour,
    // where a weighted mean reduces to a plain mean.
    weight: 1.0,
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

describe('informative checks are score-neutral', () => {
  it('adding an informative check never changes the category score', () => {
    const scored = [
      makeCheck({ status: 'pass', score: 1, scoreDisplayMode: 'binary' }),
      makeCheck({ status: 'fail', score: 0, scoreDisplayMode: 'binary' }),
    ];
    const before = calculateCategoryScore(scored);
    const withInformative = [
      ...scored,
      makeCheck({ status: 'fail', score: 0, scoreDisplayMode: 'informative' }),
      makeCheck({ status: 'pass', score: 1, scoreDisplayMode: 'informative' }),
    ];
    expect(calculateCategoryScore(withInformative)).toBe(before);
  });

  it('a failing informative check on its own does not drag the mean down', () => {
    const scored = [
      makeCheck({ status: 'pass', score: 1, scoreDisplayMode: 'binary' }),
      makeCheck({ status: 'pass', score: 1, scoreDisplayMode: 'binary' }),
    ];
    expect(calculateCategoryScore(scored)).toBe(100);
    expect(
      calculateCategoryScore([
        ...scored,
        makeCheck({ status: 'fail', score: 0, scoreDisplayMode: 'informative' }),
      ]),
    ).toBe(100);
  });

  it('a category of only informative checks scores 0', () => {
    const only = [makeCheck({ status: 'pass', score: 1, scoreDisplayMode: 'informative' })];
    expect(calculateCategoryScore(only)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildCategoryResult
// ---------------------------------------------------------------------------

describe('buildCategoryResult', () => {
  it('returns correct id and name, and the evidence mass it was handed', () => {
    const categoryId = 'structured-data';
    const checks = [makeCheck({ category: categoryId })];
    const result = buildCategoryResult(categoryId, checks, CATEGORY_MASS[categoryId]);

    expect(result.id).toBe(categoryId);
    expect(result.name).toBe(CATEGORY_NAMES[categoryId]);
    expect(result.weight).toBe(CATEGORY_MASS[categoryId]);
  });

  it('falls back to id as name and zero mass when category is unknown', () => {
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
    const result = buildCategoryResult('machine-discovery', checks);
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
    const result = buildCategoryResult('operability-safety', checks);
    expect(result.score).toBe(calculateCategoryScore(checks));
  });

  it('includes the checks array in the result', () => {
    const checks = [makeCheck()];
    const result = buildCategoryResult('content-extraction', checks);
    expect(result.checks).toBe(checks);
  });
});

// ---------------------------------------------------------------------------
// calculateOverallScore
// ---------------------------------------------------------------------------

describe('calculateOverallScore', () => {
  it('drops a category whose checks are all notApplicable', () => {
    const commerce = makeCategory({
      id: 'agentic-commerce',
      score: 0,
      weight: 4,
      checks: [makeCheck({ status: 'na', score: 0 }), makeCheck({ status: 'na', score: 0 })],
    });
    const discovery = makeCategory({
      id: 'machine-discovery',
      score: 50,
      weight: 4,
      checks: [makeCheck(), makeCheck({ status: 'fail', score: 0 })],
    });
    // Without the rule this is (0*4 + 50*4) / 8 = 25.
    expect(calculateOverallScore([commerce, discovery])).toBe(50);
  });

  it('still counts a category that has one assessable check', () => {
    const commerce = makeCategory({
      id: 'agentic-commerce',
      score: 0,
      weight: 4,
      checks: [makeCheck({ status: 'na', score: 0 }), makeCheck({ status: 'fail', score: 0 })],
    });
    const discovery = makeCategory({
      id: 'machine-discovery',
      score: 100,
      weight: 4,
      checks: [makeCheck(), makeCheck()],
    });
    expect(calculateOverallScore([commerce, discovery])).toBe(50);
  });

  // A category whose only checks are advisory has no scored evidence either.
  it('drops a category whose checks are all informative', () => {
    const advisory = makeCategory({
      id: 'structured-data',
      score: 0,
      weight: 2,
      checks: [makeCheck({ scoreDisplayMode: 'informative', status: 'fail', score: 0 })],
    });
    const discovery = makeCategory({
      id: 'machine-discovery',
      score: 80,
      weight: 4,
      checks: [makeCheck()],
    });
    expect(calculateOverallScore([advisory, discovery])).toBe(80);
  });

  it('computes weighted average correctly', () => {
    const categories: CategoryResult[] = [
      makeCategory({ score: 80, weight: 0.5 }),
      makeCategory({ score: 60, weight: 0.5 }),
    ];
    // v2 divides by the total mass rather than assuming the weights sum to 1:
    // (80 * 0.5 + 60 * 0.5) / 1.0 = 70. These fixtures happen to sum to 1, so
    // the old v1 phrasing gave the same number and hid the divisor.
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
    // (33 * 0.33 + 67 * 0.67) / 1.0 = 10.89 + 44.89 = 55.78 → 56
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

// ---------------------------------------------------------------------------
// Evidence-mass overall score (spec §4)
// ---------------------------------------------------------------------------

describe('calculateOverallScore — evidence mass', () => {
  // Category weight is no longer a hand-tuned percentage: it is the summed
  // weight of the category's registered audits, so the divisor is whatever the
  // evidence adds up to rather than a fixed 1.0.
  it('normalizes by total mass instead of assuming weights sum to 1', () => {
    const categories: CategoryResult[] = [
      makeCategory({ id: 'a', score: 80, weight: 12 }),
      makeCategory({ id: 'b', score: 60, weight: 4 }),
    ];
    // (80*12 + 60*4) / 16 = 75
    expect(calculateOverallScore(categories)).toBe(75);
  });

  it('property: moving an audit between categories cannot move the overall when scores are equal', () => {
    const before: CategoryResult[] = [
      makeCategory({ id: 'a', score: 64, weight: 10 }),
      makeCategory({ id: 'b', score: 64, weight: 6 }),
    ];
    // The same audit (weight 1.0) now sits in category b instead of a: mass
    // shifts across the boundary, total mass is unchanged.
    const after: CategoryResult[] = [
      makeCategory({ id: 'a', score: 64, weight: 9 }),
      makeCategory({ id: 'b', score: 64, weight: 7 }),
    ];
    expect(calculateOverallScore(after)).toBe(calculateOverallScore(before));
    expect(calculateOverallScore(after)).toBe(64);
  });

  it('property: a category of only informative audits (mass 0) cannot move the overall', () => {
    const scoredOnly: CategoryResult[] = [
      makeCategory({ id: 'a', score: 90, weight: 8 }),
      makeCategory({ id: 'b', score: 40, weight: 2 }),
    ];
    const withMassless: CategoryResult[] = [
      ...scoredOnly,
      // Every member audit is informative/experimental → zero evidence mass.
      makeCategory({ id: 'informative-only', score: 0, weight: 0 }),
      makeCategory({ id: 'experimental-only', score: 100, weight: 0 }),
    ];
    expect(calculateOverallScore(withMassless)).toBe(calculateOverallScore(scoredOnly));
  });

  it('returns 0 when nothing carries mass at all', () => {
    expect(
      calculateOverallScore([
        makeCategory({ id: 'a', score: 100, weight: 0 }),
        makeCategory({ id: 'b', score: 100, weight: 0 }),
      ]),
    ).toBe(0);
  });

  it('is driven by the registry: every category weight is its evidence mass', () => {
    for (const cat of defaultConfig.categories) {
      const mass = (defaultConfig.audits[cat.id] ?? []).reduce(
        (sum, reg) => sum + reg.meta.weight,
        0,
      );
      expect(cat.weight).toBe(mass);
      expect(CATEGORY_MASS[cat.id]).toBe(mass);
    }
  });
});

// ---------------------------------------------------------------------------
// Weighted category score (evidence weight A=1.0 / B=0.6 / informative=0)
// ---------------------------------------------------------------------------

describe('weighted category score', () => {
  it('weights A (1.0) over B (0.6)', () => {
    const checks = [
      makeCheck({ status: 'pass', score: 1, weight: 1.0 }),
      makeCheck({ status: 'fail', score: 0, weight: 0.6 }),
    ];
    // (1*1.0 + 0*0.6) / 1.6 = 0.625
    expect(calculateCategoryScore(checks)).toBe(63);
  });

  it('weight 0 (informative) never moves the score', () => {
    const base = [makeCheck({ status: 'pass', score: 1, weight: 1.0 })];
    const withInformative = [...base, makeCheck({ status: 'fail', score: 0, weight: 0 })];
    expect(calculateCategoryScore(withInformative)).toBe(calculateCategoryScore(base));
  });

  it('a check with no weight contributes nothing to either side of the ratio', () => {
    // An unstamped check is unproven evidence: it must not move the score, so
    // this mixed set scores exactly as the weighted pair alone does.
    const base = [
      makeCheck({ status: 'pass', score: 1, weight: 1.0 }),
      makeCheck({ status: 'fail', score: 0, weight: 0.6 }),
    ];
    const withUnweighted = [
      ...base,
      makeCheck({ status: 'fail', score: 0, weight: undefined }),
      makeCheck({ status: 'pass', score: 1, weight: undefined }),
    ];
    expect(calculateCategoryScore(base)).toBe(63);
    expect(calculateCategoryScore(withUnweighted)).toBe(63);
    // …and a set of only unweighted checks has no evidence at all.
    expect(calculateCategoryScore([makeCheck({ status: 'pass', score: 1, weight: undefined })])).toBe(0);
  });

  it('property: adding a na check never changes the score', () => {
    const base = [
      makeCheck({ status: 'pass', score: 1, weight: 1.0 }),
      makeCheck({ status: 'fail', score: 0, weight: 0.6 }),
    ];
    const withNa = [...base, makeCheck({ status: 'na', score: 0, weight: 1.0 })];
    expect(calculateCategoryScore(withNa)).toBe(calculateCategoryScore(base));
  });

  it('all-na or zero-total-weight scores 0', () => {
    expect(calculateCategoryScore([makeCheck({ status: 'na', weight: 1 })])).toBe(0);
    expect(calculateCategoryScore([makeCheck({ status: 'fail', score: 0, weight: 0 })])).toBe(0);
  });
});

describe('gatedMassShare — what the gate removed', () => {
  const check = (over: Partial<CheckResult>): CheckResult =>
    ({
      id: 'x/y',
      category: 'content-extraction',
      title: 't',
      description: 'd',
      status: 'pass',
      score: 1,
      weight: 1,
      scoreDisplayMode: 'binary',
      priority: 'medium',
      impact: '',
      fix: '',
      ...over,
    }) as CheckResult;

  it('is zero when nothing was gated', () => {
    expect(gatedMassShare([check({}), check({ status: 'fail', score: 0 })])).toBe(0);
  });

  it('counts only the mass the gate itself removed', () => {
    const share = gatedMassShare([
      check({ id: 'a/1', status: 'na', tags: ['skipped:no-evidence'] }),
      check({ id: 'a/2', status: 'na', tags: ['skipped:page-type'] }),
      check({ id: 'a/3' }),
    ]);
    // 1 of 3 units of mass. A page-type skip is a legitimate absence and is
    // not counted: counting it would mark small honest sites unscored.
    expect(share).toBeCloseTo(1 / 3);
  });

  it('ignores informative checks, which carry no mass', () => {
    const share = gatedMassShare([
      check({ id: 'a/1', weight: 0, scoreDisplayMode: 'informative', tags: ['skipped:no-evidence'] }),
      check({ id: 'a/2' }),
    ]);
    expect(share).toBe(0);
  });

  it('reports the whole registry gone when every scored check was gated', () => {
    expect(
      gatedMassShare([
        check({ id: 'a/1', status: 'na', tags: ['skipped:no-evidence'] }),
        check({ id: 'a/2', status: 'na', tags: ['skipped:no-evidence'] }),
      ]),
    ).toBe(1);
  });

  it('crosses the unscored threshold before half the registry is gone', () => {
    // The measured failure was a shell scoring 74 against a real store's 51,
    // with four of eight categories dropped. Whatever the calibrated number
    // is, it has to trip well below "most of the registry".
    expect(GATED_MASS_UNSCORED_THRESHOLD).toBeLessThan(0.5);
    expect(GATED_MASS_UNSCORED_THRESHOLD).toBeGreaterThan(0);
  });
});
