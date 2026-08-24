import { describe, it, expect } from 'vitest';
import { filterAudits } from './audit-explorer';
import type { AuditRecord } from '../lib/registry';

const record = (over: Partial<AuditRecord>): AuditRecord => ({
  id: 'a/b', category: 'a', categoryTitle: 'A', title: 'Title', description: 'Description',
  evidenceGrade: 'B', tier: 'scored', weight: 0.6, priority: 'medium', tags: [], ...over,
});

describe('filterAudits', () => {
  const audits = [
    record({ id: 'agentic-commerce/offer-truth-consistency', title: 'Offer Truth Consistency', category: 'agentic-commerce', tags: ['price'] }),
    record({ id: 'access-crawl-control/robots-directives', title: 'Robots Directives', category: 'access-crawl-control', tier: 'informative' }),
  ];

  it('matches on title, id and tag', () => {
    expect(filterAudits(audits, { text: 'offer', category: 'all', tier: 'all' })).toHaveLength(1);
    expect(filterAudits(audits, { text: 'robots-directives', category: 'all', tier: 'all' })).toHaveLength(1);
    expect(filterAudits(audits, { text: 'price', category: 'all', tier: 'all' })).toHaveLength(1);
  });

  it('filters by category and tier independently', () => {
    expect(filterAudits(audits, { text: '', category: 'agentic-commerce', tier: 'all' })).toHaveLength(1);
    expect(filterAudits(audits, { text: '', category: 'all', tier: 'informative' })).toHaveLength(1);
  });

  it('returns everything for an empty query', () => {
    expect(filterAudits(audits, { text: '', category: 'all', tier: 'all' })).toHaveLength(2);
  });
});
