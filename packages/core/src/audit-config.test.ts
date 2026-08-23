import { describe, it, expect } from 'vitest';
import type { AuditMeta } from './types';
import { defaultConfig, filterConfig, CATEGORY_IDS } from './audit-config';
import type { AuditRegistration, ScanConfig } from './audit-config';

describe('CATEGORY_IDS', () => {
  it('names exactly the 8 v2 categories', () => {
    expect([...CATEGORY_IDS].sort()).toEqual([
      'access-crawl-control',
      'agent-interfaces',
      'agentic-commerce',
      'answer-readiness',
      'content-extraction',
      'machine-discovery',
      'operability-safety',
      'structured-data',
    ]);
  });

  it('matches the ids the default config carries', () => {
    expect([...CATEGORY_IDS]).toEqual(defaultConfig.categories.map((c) => c.id));
  });
});

describe('filterConfig', () => {
  it('keeps only the named categories', () => {
    const filtered = filterConfig(defaultConfig, { categories: ['machine-discovery'] });
    expect(filtered.categories.map((c) => c.id)).toEqual(['machine-discovery']);
    expect(Object.keys(filtered.audits)).toEqual(['machine-discovery']);
    expect(filtered.audits['machine-discovery']!.length).toBeGreaterThan(0);
  });

  it('keeps several named categories in registry order', () => {
    const filtered = filterConfig(defaultConfig, {
      categories: ['agent-interfaces', 'access-crawl-control'],
    });
    expect(filtered.categories.map((c) => c.id)).toEqual([
      'access-crawl-control',
      'agent-interfaces',
    ]);
  });

  it('returns the config untouched when there is nothing to filter', () => {
    expect(filterConfig(defaultConfig, { includeExperimental: true })).toBe(defaultConfig);
  });

  it('ignores an unknown category id rather than inventing one', () => {
    const filtered = filterConfig(defaultConfig, { categories: ['nonsense'] });
    expect(filtered.categories).toEqual([]);
  });

  it('excludes experimental audits by default and includes them on request', () => {
    const base = defaultConfig.audits['machine-discovery']!;
    const experimental: AuditRegistration = {
      create: base[0]!.create,
      meta: { ...(base[0]!.meta as AuditMeta), id: 'machine-discovery/probe-x', tier: 'experimental', weight: 0 },
    };
    const withExperimental: ScanConfig = {
      categories: defaultConfig.categories.filter((c) => c.id === 'machine-discovery'),
      audits: { 'machine-discovery': [...base, experimental] },
    };

    const ids = (c: ScanConfig) => c.audits['machine-discovery']!.map((r) => r.meta.id);
    expect(ids(filterConfig(withExperimental, { includeExperimental: false }))).not.toContain(
      'machine-discovery/probe-x',
    );
    expect(ids(filterConfig(withExperimental, { includeExperimental: true }))).toContain(
      'machine-discovery/probe-x',
    );
  });

  // docs/evidence/POLICY.md: an experimental audit is "behind a flag, unscored".
  // The registry carries three; they were running on every scan regardless.
  it('drops exactly the experimental audits from the live registry by default', () => {
    const count = (c: ScanConfig) =>
      Object.values(c.audits).reduce((n, list) => n + list.length, 0);
    const kept = filterConfig(defaultConfig, {});
    const experimental = Object.values(defaultConfig.audits)
      .flat()
      .filter((r) => r.meta.tier === 'experimental');

    expect(experimental.length).toBeGreaterThan(0);
    expect(count(kept)).toBe(count(defaultConfig) - experimental.length);
    expect(count(filterConfig(defaultConfig, { includeExperimental: true }))).toBe(
      count(defaultConfig),
    );
  });

  it('keeps scored and informative audits when experimental ones are dropped', () => {
    const kept = Object.values(filterConfig(defaultConfig, {}).audits).flat();
    expect(kept.every((r) => r.meta.tier !== 'experimental')).toBe(true);
    expect(kept.some((r) => r.meta.tier === 'informative')).toBe(true);
    expect(kept.some((r) => r.meta.tier === 'scored')).toBe(true);
  });
});
