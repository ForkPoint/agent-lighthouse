import { describe, it, expect } from 'vitest';
import type { CategoryResult, CheckResult, ScanReport } from '@forkpoint/agent-lighthouse-core';
import { generateMarkdownSummary } from './markdown-generator';

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

function report(categories: CategoryResult[]): ScanReport {
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
  };
}

describe('generateMarkdownSummary', () => {
  it('states how many checks were advisory', () => {
    const md = generateMarkdownSummary(
      report([
        cat({
          id: 'agent-interfaces',
          checks: [
            check({ tier: 'scored' }),
            check({ id: 'adv', tier: 'informative', scoreDisplayMode: 'informative' }),
          ],
        }),
      ]),
    );
    expect(md).toContain('1 advisory check ran');
  });

  it('says nothing about advisories when there are none', () => {
    const md = generateMarkdownSummary(
      report([cat({ id: 'agent-interfaces', checks: [check({ tier: 'scored' })] })]),
    );
    expect(md).not.toContain('advisory');
  });

  it('pluralises the advisory count', () => {
    const md = generateMarkdownSummary(
      report([
        cat({
          id: 'agent-interfaces',
          checks: [
            check({ id: 'a', tier: 'informative', scoreDisplayMode: 'informative' }),
            check({ id: 'b', tier: 'experimental' }),
          ],
        }),
      ]),
    );
    expect(md).toContain('2 advisory checks ran');
  });
});

describe('generateMarkdownSummary — an unscored scan', () => {
  it('says not scored, with the reason, instead of printing a number', () => {
    const md = generateMarkdownSummary({
      ...report([]),
      overallScore: null,
      scoreTier: null,
      scanValidity: {
        judgeable: false,
        evidence: {
          'origin-reachable': false,
          'unblocked-fetches': true,
          'rendered-body': false,
          'sample-adequate': false,
        },
        reasons: { 'origin-reachable': 'The homepage answered HTTP 403.' },
        unscoredReason: 'The homepage answered HTTP 403.',
      },
    });

    expect(md).toContain('_Not scored_');
    expect(md).toContain('HTTP 403');
    expect(md).not.toContain('/100');
  });
});
