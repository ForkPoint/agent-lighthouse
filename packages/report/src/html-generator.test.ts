import { describe, it, expect } from 'vitest';
import type { CategoryResult, CheckResult, ScanReport } from '@forkpoint/agent-lighthouse-core';
import { generateHtmlReport } from './html-generator';

// ── Fixtures ────────────────────────────────────────────────────

function check(over: Partial<CheckResult> = {}): CheckResult {
  return {
    id: 'c',
    category: 'agent-interfaces',
    title: 'title',
    description: 'desc',
    status: 'pass',
    score: 1,
    scoreDisplayMode: 'binary',
    priority: 'medium',
    impact: '',
    fix: '',
    ...over,
  };
}

function cat(over: Partial<CategoryResult> & { id: string }): CategoryResult {
  const checks = over.checks ?? [];
  return {
    name: over.id,
    weight: 0.1,
    score: 0,
    passCount: 0,
    warnCount: 0,
    failCount: 0,
    ...over,
    checks,
  };
}

function report(categories: CategoryResult[], over: Partial<ScanReport> = {}): ScanReport {
  return {
    scanId: 's1',
    url: 'https://x.test/',
    domain: 'x.test',
    overallScore: 42,
    scoreTier: 'needs-work',
    categories,
    topPasses: [],
    topFails: [],
    recommendations: [],
    pagesScanned: [{ url: 'https://x.test/', pageType: 'homepage' }],
    scannedAt: '2026-01-01T00:00:00.000Z',
    durationMs: 1234,
    ...over,
  };
}

const NOT_A_FACTOR_LINK =
  'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/sunset/NOT-A-FACTOR.md#accessibilityskip-nav';

// ── Tests ───────────────────────────────────────────────────────

describe('generateHtmlReport', () => {
  it('renders the deprecation notice and badge for a sunset audit', () => {
    const html = generateHtmlReport(
      report([
        cat({
          id: 'agent-interfaces',
          checks: [
            check({
              id: 'accessibility-skip-nav',
              status: 'fail',
              deprecated: {
                notice: 'No consumer reads this signal.',
                link: NOT_A_FACTOR_LINK,
              },
            }),
          ],
        }),
      ]),
    );

    expect(html).toContain('Deprecated — no longer a factor');
    expect(html).toContain('docs/evidence/sunset/NOT-A-FACTOR.md#accessibilityskip-nav');
    expect(html).toContain('No consumer reads this signal.');
  });

  it('omits the deprecation block for a check without a notice', () => {
    const html = generateHtmlReport(
      report([cat({ id: 'agent-interfaces', checks: [check({ id: 'live', status: 'pass' })] })]),
    );

    expect(html).not.toContain('Deprecated — no longer a factor');
    expect(html).not.toContain('NOT-A-FACTOR.md');
  });
});
