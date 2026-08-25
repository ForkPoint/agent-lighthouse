import { describe, it, expect } from 'vitest';
import { defaultConfig, CATEGORY_IDS } from '@forkpoint/agent-lighthouse-core';
import { auditList, auditDataList, categoryList } from './registry';

/**
 * The site's view of the audit registry.
 *
 * Every page the site publishes — the explorer, the category indexes and
 * `/audits-data.json` — is generated from these three functions, so a field
 * dropped here disappears from the built site with nothing to catch it. The
 * assertions run against the real registry rather than a fixture: that is what
 * ships, and it is what a drifting `meta` would break.
 */

const registered = Object.values(defaultConfig.audits).flat();

describe('auditList', () => {
  it('returns every registered audit exactly once', () => {
    const list = auditList();
    expect(list).toHaveLength(registered.length);
    expect(new Set(list.map((a) => a.id)).size).toBe(list.length);
  });

  it('sorts by category slug, then audit slug', () => {
    const ids = auditList().map((a) => a.id);
    const sorted = [...ids].sort((a, b) => {
      const [ac = '', as = ''] = a.split('/');
      const [bc = '', bs = ''] = b.split('/');
      return ac.localeCompare(bc) || as.localeCompare(bs);
    });
    expect(ids).toEqual(sorted);
  });

  it('names every category, never leaving a raw slug on the page', () => {
    for (const audit of auditList()) {
      expect(audit.categoryTitle, audit.id).not.toBe('');
      expect(CATEGORY_IDS, audit.id).toContain(audit.category);
    }
  });

  it('carries a grade and a tier for every audit', () => {
    for (const audit of auditList()) {
      expect(['A', 'B', 'C', 'D'], audit.id).toContain(audit.evidenceGrade);
      expect(audit.tier, audit.id).toBeTruthy();
    }
  });

  it('defaults tags to an empty array so a template can map over them', () => {
    for (const audit of auditList()) {
      expect(Array.isArray(audit.tags), audit.id).toBe(true);
    }
  });
});

describe('auditDataList', () => {
  it('covers the same audits as auditList', () => {
    expect(auditDataList().map((a) => a.id)).toEqual(auditList().map((a) => a.id));
  });

  it('falls back to the title when an audit declares no failureTitle', () => {
    for (const record of auditDataList()) {
      expect(record.failureTitle, record.id).toBeTruthy();
    }
  });

  it('points every audit at its dossier', () => {
    for (const record of auditDataList()) {
      expect(record.dossier, record.id).toMatch(/^docs\/evidence\/audits\/.+\.md$/);
    }
  });

  // The v1 file left absent fields out entirely rather than emitting null.
  it('omits optional fields instead of emitting undefined', () => {
    const json = JSON.stringify(auditDataList());
    expect(json).not.toContain('undefined');
    const withoutGuidance = auditDataList().filter((r) => r.guidance === undefined);
    for (const record of withoutGuidance) {
      expect(Object.hasOwn(record, 'guidance'), record.id).toBe(false);
    }
  });

  it('carries the guidance an operator needs to act, when the audit has any', () => {
    const withGuidance = auditDataList().find((r) => r.guidance !== undefined);
    expect(withGuidance).toBeDefined();
    expect(withGuidance!.guidance).toMatchObject({
      impact: expect.any(String),
      fix: expect.any(String),
      effort: expect.any(String),
    });
  });

  it('serialises without throwing, which is what the endpoint does', () => {
    expect(() => JSON.stringify(auditDataList())).not.toThrow();
  });
});

describe('categoryList', () => {
  it('lists the categories in report order', () => {
    expect(categoryList().map((c) => c.id)).toEqual(defaultConfig.categories.map((c) => c.id));
  });

  it('counts every audit exactly once across the categories', () => {
    const total = categoryList().reduce((sum, c) => sum + c.count, 0);
    expect(total).toBe(auditList().length);
  });

  it('leaves no category empty', () => {
    for (const category of categoryList()) {
      expect(category.count, category.id).toBeGreaterThan(0);
      expect(category.name, category.id).toBeTruthy();
    }
  });
});
