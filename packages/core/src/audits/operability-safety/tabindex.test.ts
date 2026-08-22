import { describe, it, expect } from 'vitest';
import { TabindexAudit } from './tabindex';
import { mockCheckContext } from '../../__tests__/test-utils';
import { pageWithA11y, runA11yAudit } from './_test-utils';

describe('TabindexAudit', () => {
  it('registers under the tabindex id with its dossier and grade', () => {
    expect(TabindexAudit.meta.id).toBe('operability-safety/tabindex');
    expect(TabindexAudit.meta.dossier).toBe('docs/evidence/audits/operability-safety/tabindex.md');
    expect(TabindexAudit.meta.evidenceGrade).toBe('C');
    expect(TabindexAudit.meta.tier).toBe('informative');
  });

  it('wires exactly its a11y rule(s)', () => {
    const ctx = mockCheckContext([
      pageWithA11y('https://example.com/', {
        'tabindex': { status: 'pass', nodes: [] },
      }),
    ]);
    const result = runA11yAudit(TabindexAudit, ctx);
    expect(result.expected).toBe('accessibility rules pass: tabindex');
  });

  it('fails when the `tabindex` rule reports a violation', () => {
    const ctx = mockCheckContext([
      pageWithA11y('https://example.com/', {
        'tabindex': { status: 'fail', nodes: [{ target: '#offender', summary: 'violation' }] },
      }),
    ]);
    const result = runA11yAudit(TabindexAudit, ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toContain('#offender');
  });

  it('passes when every constituent rule passes', () => {
    const ctx = mockCheckContext([
      pageWithA11y('https://example.com/', {
        'tabindex': { status: 'pass', nodes: [] },
      }),
    ]);
    expect(runA11yAudit(TabindexAudit, ctx).status).toBe('pass');
  });

  it('is na when no constituent rule applies', () => {
    const ctx = mockCheckContext([
      pageWithA11y('https://example.com/', {
        'tabindex': { status: 'inapplicable', nodes: [] },
      }),
    ]);
    expect(runA11yAudit(TabindexAudit, ctx).status).toBe('na');
  });
});
