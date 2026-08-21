import { describe, it, expect } from 'vitest';
import type { CategoryResult, CheckResult, ScanReport } from '@forkpoint/agent-lighthouse-core';
import { TAG_SCAN_ERROR, TAG_SKIPPED_PAGE_TYPE } from '@forkpoint/agent-lighthouse-core';
import { buildReportView } from './view-model';

// ── Fixtures ────────────────────────────────────────────────────

function check(over: Partial<CheckResult> = {}): CheckResult {
  return {
    id: 'c',
    category: 'agent-tools',
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

// A report spanning two section groups with a mix of statuses on agent-tools.
function mixedReport(): ScanReport {
  return report([
    cat({
      id: 'agent-tools',
      weight: 0.18,
      score: 80,
      checks: [
        check({ id: 'p1', status: 'pass' }),
        check({ id: 'w1', status: 'warn', priority: 'high' }),
        check({ id: 'f1', status: 'fail', priority: 'critical' }),
        check({ id: 'e1', status: 'na', tags: [TAG_SCAN_ERROR] }),
        check({ id: 's1', status: 'na', tags: [TAG_SKIPPED_PAGE_TYPE] }),
        check({ id: 'n1', status: 'na' }),
      ],
    }),
    cat({
      id: 'machine-discovery',
      weight: 0.15,
      score: 60,
      checks: [check({ id: 'cd1', category: 'machine-discovery', status: 'pass' })],
    }),
    cat({
      id: 'answer-engine',
      weight: 0.07,
      score: 100,
      checks: [check({ id: 'ae1', category: 'answer-engine', status: 'pass' })],
    }),
  ]);
}

// ── Tests ───────────────────────────────────────────────────────

describe('buildReportView', () => {
  it('groups categories into their section groups with a weighted roll-up score', () => {
    const v = buildReportView(mixedReport());
    // technicalFoundation has no categories present → dropped.
    expect(v.groups.map((g) => g.key)).toEqual(['agenticReadiness', 'aiSearchOptimization']);
    // agenticReadiness = round((80*0.18 + 60*0.15) / (0.18 + 0.15)) = 71
    expect(v.groups[0]!.score).toBe(71);
    expect(v.groups[0]!.label).toBe('Agentic Readiness');
    // aiSearchOptimization = round(100*0.07 / 0.07) = 100
    expect(v.groups[1]!.score).toBe(100);
  });

  it('returns categories flat in canonical order regardless of input order', () => {
    const v = buildReportView(
      report([cat({ id: 'answer-engine' }), cat({ id: 'agent-tools' })]),
    );
    // agent-tools precedes answer-engine in CATEGORY_ORDER.
    expect(v.categories.map((c) => c.id)).toEqual(['agent-tools', 'answer-engine']);
  });

  it('splits assessed checks from not-applicable and counts them', () => {
    const v = buildReportView(mixedReport());
    const at = v.categories.find((c) => c.id === 'agent-tools')!;
    expect(at.checks.map((c) => c.id)).toEqual(['p1', 'w1', 'f1']); // assessed only
    expect(at.notApplicable.map((c) => c.id)).toEqual(['e1', 's1', 'n1']);
    expect(at.counts).toEqual({ pass: 1, warn: 1, fail: 1, na: 3, total: 3 });
  });

  it('buckets coverage by na tag across all categories', () => {
    const v = buildReportView(mixedReport());
    expect(v.coverage).toMatchObject({
      ran: 5, // p1,w1,f1 + cd1 + ae1
      errored: 1, // e1
      skippedByPageType: 1, // s1
      notApplicable: 1, // n1 (untagged na)
    });
    expect(v.coverage.erroredChecks.map((c) => c.id)).toEqual(['e1']);
  });

  it('orders topFixes by priority (fail+warn) and topPasses by category weight', () => {
    const v = buildReportView(mixedReport());
    expect(v.topFixes.map((c) => c.id)).toEqual(['f1', 'w1']); // critical before high
    // passes sorted by owning category weight desc: agent-tools .18 > md .15 > ae .07
    expect(v.topPasses.map((c) => c.id)).toEqual(['p1', 'cd1', 'ae1']);
  });

  it('excludes informative checks from topFixes and topPasses', () => {
    const v = buildReportView(
      report([
        cat({
          id: 'agent-tools',
          weight: 0.18,
          checks: [
            check({ id: 'inf-fail', status: 'fail', priority: 'critical', scoreDisplayMode: 'informative' }),
            check({ id: 'norm-fail', status: 'fail', priority: 'high' }),
            check({ id: 'inf-pass', status: 'pass', scoreDisplayMode: 'informative' }),
            check({ id: 'norm-pass', status: 'pass' }),
          ],
        }),
      ]),
    );
    expect(v.topFixes.map((c) => c.id)).toEqual(['norm-fail']);
    expect(v.topPasses.map((c) => c.id)).toEqual(['norm-pass']);
  });

  it('honours topN for topFixes / topPasses', () => {
    const many = report([
      cat({
        id: 'agent-tools',
        checks: Array.from({ length: 5 }, (_v, i) =>
          check({ id: `f${i}`, status: 'fail', priority: 'high' }),
        ),
      }),
    ]);
    expect(buildReportView(many, { topN: 2 }).topFixes).toHaveLength(2);
  });

  it('applies the priority filter to checks, categories, and recommendations', () => {
    const v = buildReportView(mixedReport(), { priority: 'critical' });
    // only f1 (critical) survives → only agent-tools remains.
    expect(v.categories.map((c) => c.id)).toEqual(['agent-tools']);
    expect(v.categories[0]!.checks.map((c) => c.id)).toEqual(['f1']);
    expect(v.groups.map((g) => g.key)).toEqual(['agenticReadiness']);
  });

  it('filters recommendations by priority when requested', () => {
    const r = report([cat({ id: 'agent-tools', checks: [check({ status: 'fail', priority: 'low' })] })], {
      recommendations: [
        { priority: 'critical', description: 'crit' },
        { priority: 'low', description: 'low' },
      ],
    });
    expect(buildReportView(r, { priority: 'low' }).recommendations).toEqual([
      { priority: 'low', description: 'low' },
    ]);
  });

  it('guards the group roll-up against a zero total weight', () => {
    const v = buildReportView(report([cat({ id: 'agent-tools', weight: 0, score: 90 })]));
    expect(v.groups[0]!.score).toBe(0);
  });

  it('fills defaults for optional report fields', () => {
    const v = buildReportView(
      report([cat({ id: 'agent-tools' })], {
        summary: undefined,
        readinessVitals: undefined,
        readinessScore: undefined,
        overallScore: 55,
      }),
    );
    expect(v.summary).toBe('');
    expect(v.vitals).toEqual({ commerce: 0, content: 0, botAccessibility: 0, technical: 0 });
    expect(v.readinessScore).toBe(55); // falls back to overallScore
  });
});
