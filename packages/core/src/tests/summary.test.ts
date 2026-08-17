import { describe, it, expect } from 'vitest';
import { generateScanSummary } from '../summary';
import type { ScanReport } from '../types';

describe('generateScanSummary', () => {
  it('should generate a summary for an agent-ready site with no issues', () => {
    const report: Partial<ScanReport> = {
      domain: 'example.com',
      overallScore: 95,
      scoreTier: 'agent-ready',
      categories: [
        {
          id: 'cat1',
          name: 'Category 1',
          score: 100,
          weight: 1,
          checks: [],
          passCount: 5,
          warnCount: 0,
          failCount: 0,
        },
      ],
      recommendations: [],
    };

    const summary = generateScanSummary(report);
    expect(summary).toContain('Scan Report for example.com: Overall Readiness 95% (Agent Ready)');
  });

  it('should highlight critical issues, vitals, and category extremes', () => {
    const report: Partial<ScanReport> = {
      domain: 'badsite.com',
      overallScore: 45,
      scoreTier: 'not-ready',
      readinessVitals: { commerce: 30, content: 40, botAccessibility: 50, technical: 60 },
      categories: [
        {
          id: 'cat1',
          name: 'Strong Cat',
          score: 80,
          weight: 0.5,
          checks: [{} as any],
          passCount: 5,
          warnCount: 0,
          failCount: 0,
        },
        {
          id: 'cat2',
          name: 'Weak Cat',
          score: 10,
          weight: 0.5,
          checks: [{} as any],
          passCount: 0,
          warnCount: 0,
          failCount: 5,
        },
      ],
      recommendations: [
        { priority: 'critical', description: 'Critical fix' },
        { priority: 'critical', description: 'Another critical fix' },
      ],
      topPasses: [],
      topFails: [],
    };

    const summary = generateScanSummary(report);
    expect(summary).toContain('Scan Report for badsite.com: Overall Readiness 45% (Not Ready)');
    expect(summary).toContain(
      'Readiness Vitals: Commerce 30%, Content 40%, AI Bot Accessibility 50%, Technical Readiness 60%',
    );
    expect(summary).toContain('Audit Statistics: 5 of 10 checks passed.');
    expect(summary).toContain('Key Issues: 2 critical, 0 high priority findings.');
    expect(summary).toContain('Top Strength: Strong Cat (80%)');
    expect(summary).toContain('Primary Improvement Area: Weak Cat (10%)');
  });

  it('should highlight high-priority issues when no critical ones exist', () => {
    const report: Partial<ScanReport> = {
      domain: 'midsite.com',
      overallScore: 75,
      scoreTier: 'partially-ready',
      recommendations: [{ priority: 'high', description: 'High fix' }],
    };

    const summary = generateScanSummary(report);
    expect(summary).toContain(
      'Scan Report for midsite.com: Overall Readiness 75% (Partially Ready)',
    );
    expect(summary).toContain('Key Issues: 0 critical, 1 high priority findings.');
  });
});
