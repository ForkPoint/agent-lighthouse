import { describe, it, expect } from 'vitest';
import type { CheckResult } from '@forkpoint/agent-lighthouse-core';
import { CATEGORY_MASS, CATEGORY_NAMES } from '@forkpoint/agent-lighthouse-core';
import { hydrateReport, type PersistedScanRow } from './hydrate';

function check(over: Partial<CheckResult> & { id: string; category: string }): CheckResult {
  return {
    title: 't',
    description: 'd',
    status: 'pass',
    score: 1,
    scoreDisplayMode: 'binary',
    priority: 'medium',
    impact: '',
    fix: '',
    ...over,
  };
}

function row(over: Partial<PersistedScanRow> = {}): PersistedScanRow {
  return {
    id: 'scan-1',
    url: 'https://x.test/',
    domain: 'x.test',
    overallScore: 70,
    scoreTier: 'needs-work',
    categoryScores: { 'agent-interfaces': 80, 'answer-readiness': 100 },
    checkResults: [
      check({ id: 'a1', category: 'agent-interfaces', status: 'pass' }),
      check({ id: 'a2', category: 'agent-interfaces', status: 'fail', priority: 'critical' }),
      check({ id: 'e1', category: 'answer-readiness', status: 'warn', priority: 'high' }),
    ],
    recommendations: [],
    pagesData: [{ url: 'https://x.test/', pageType: 'homepage' }],
    durationMs: 999,
    readinessScore: 65,
    readinessVitals: { commerce: 1, content: 2, botAccessibility: 3, technical: 4 },
    ...over,
  };
}

describe('hydrateReport', () => {
  it('rebuilds categories in canonical order with shared names/weights and counts', () => {
    const r = hydrateReport(row());
    expect(r.categories.map((c) => c.id)).toEqual(['agent-interfaces', 'answer-readiness']);
    const at = r.categories[0]!;
    expect(at.name).toBe(CATEGORY_NAMES['agent-interfaces']);
    expect(at.weight).toBe(CATEGORY_MASS['agent-interfaces']);
    expect(at.score).toBe(80); // from categoryScores
    expect({ pass: at.passCount, warn: at.warnCount, fail: at.failCount }).toEqual({
      pass: 1,
      warn: 0,
      fail: 1,
    });
  });

  it('includes a category that has a score but no checks', () => {
    const r = hydrateReport(row({ categoryScores: { 'agent-interfaces': 80, 'structured-data': 50 } }));
    const scoredOnly = r.categories.find((c) => c.id === 'structured-data')!;
    expect(scoredOnly.score).toBe(50);
    expect(scoredOnly.checks).toHaveLength(0);
  });

  it('appends unexpected (non-canonical) categories after the known ones', () => {
    const r = hydrateReport(
      row({
        categoryScores: {},
        checkResults: [
          check({ id: 'z1', category: 'mystery-cat' }),
          check({ id: 'a1', category: 'agent-interfaces' }),
        ],
      }),
    );
    expect(r.categories.map((c) => c.id)).toEqual(['agent-interfaces', 'mystery-cat']);
    expect(r.categories.find((c) => c.id === 'mystery-cat')!.weight).toBe(0); // no shared mass
  });

  it('derives topFails (priority order) and topPasses', () => {
    const r = hydrateReport(row());
    expect(r.topFails.map((c) => c.id)).toEqual(['a2', 'e1']); // critical before high
    expect(r.topPasses.map((c) => c.id)).toEqual(['a1']);
  });

  it('excludes informative checks from topFails and topPasses', () => {
    const r = hydrateReport(
      row({
        checkResults: [
          check({
            id: 'inf-fail',
            category: 'agent-interfaces',
            status: 'fail',
            priority: 'critical',
            scoreDisplayMode: 'informative',
          }),
          check({ id: 'norm-fail', category: 'agent-interfaces', status: 'fail', priority: 'high' }),
          check({
            id: 'inf-pass',
            category: 'agent-interfaces',
            status: 'pass',
            scoreDisplayMode: 'informative',
          }),
          check({ id: 'norm-pass', category: 'agent-interfaces', status: 'pass' }),
        ],
      }),
    );
    expect(r.topFails.map((c) => c.id)).toEqual(['norm-fail']);
    expect(r.topPasses.map((c) => c.id)).toEqual(['norm-pass']);
  });

  it('populates a non-empty summary', () => {
    const r = hydrateReport(row());
    expect(typeof r.summary).toBe('string');
    expect((r.summary ?? '').length).toBeGreaterThan(0);
  });

  it('coerces Date timestamps to ISO strings', () => {
    const created = new Date('2026-01-01T10:00:00.000Z');
    const completed = new Date('2026-01-02T10:00:00.000Z');
    const r = hydrateReport(row({ createdAt: created, completedAt: completed }));
    expect(r.scannedAt).toBe(completed.toISOString());
    expect(r.createdAt).toBe(created.toISOString());
  });

  it('passes through string timestamps and defaults missing ones', () => {
    const r = hydrateReport(row({ createdAt: null, completedAt: '2026-05-05T00:00:00.000Z' }));
    expect(r.scannedAt).toBe('2026-05-05T00:00:00.000Z');
    expect(r.createdAt).toBeUndefined();
  });

  it('applies safe defaults for a sparsely-populated row', () => {
    const r = hydrateReport({
      id: 'bare',
      url: 'https://y.test/',
      domain: 'y.test',
      overallScore: null,
      scoreTier: null,
      categoryScores: null,
      checkResults: null,
      recommendations: null,
      pagesData: null,
      durationMs: null,
      readinessScore: null,
      readinessVitals: null,
    });
    // A stored row with no score is a scan that could not be judged, not one
    // that scored zero.
    expect(r.overallScore).toBeNull();
    expect(r.scoreTier).toBeNull();
    expect(r.categories).toEqual([]);
    expect(r.checkResults).toEqual([]);
    expect(r.pagesScanned).toEqual([]);
    expect(r.durationMs).toBe(0);
  });
});
