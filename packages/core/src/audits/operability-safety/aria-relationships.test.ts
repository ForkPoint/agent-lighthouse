import { describe, it, expect } from 'vitest';
import { AriaRelationshipsAudit } from './aria-relationships';
import { mockCheckContext } from '../../__tests__/test-utils';
import { pageWithA11y, runA11yAudit } from './_test-utils';

describe('AriaRelationshipsAudit', () => {
  it('registers under the aria-relationships id with its dossier and grade', () => {
    expect(AriaRelationshipsAudit.meta.id).toBe('operability-safety/aria-relationships');
    expect(AriaRelationshipsAudit.meta.dossier).toBe('docs/evidence/audits/operability-safety/aria-relationships.md');
    expect(AriaRelationshipsAudit.meta.evidenceGrade).toBe('A');
    expect(AriaRelationshipsAudit.meta.tier).toBe('scored');
  });

  it('wires exactly its a11y rule(s)', () => {
    const ctx = mockCheckContext([
      pageWithA11y('https://example.com/', {
        'aria-required-attr': { status: 'pass', nodes: [] },
        'aria-required-children': { status: 'pass', nodes: [] },
        'aria-required-parent': { status: 'pass', nodes: [] },
      }),
    ]);
    const result = runA11yAudit(AriaRelationshipsAudit, ctx);
    expect(result.expected).toBe('accessibility rules pass: aria-required-attr, aria-required-children, aria-required-parent');
  });

  it('fails when the `aria-required-attr` rule reports a violation', () => {
    const ctx = mockCheckContext([
      pageWithA11y('https://example.com/', {
        'aria-required-attr': { status: 'fail', nodes: [{ target: '#offender', summary: 'violation' }] },
        'aria-required-children': { status: 'pass', nodes: [] },
        'aria-required-parent': { status: 'pass', nodes: [] },
      }),
    ]);
    const result = runA11yAudit(AriaRelationshipsAudit, ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toContain('#offender');
  });

  it('fails when the `aria-required-children` rule reports a violation', () => {
    const ctx = mockCheckContext([
      pageWithA11y('https://example.com/', {
        'aria-required-attr': { status: 'pass', nodes: [] },
        'aria-required-children': { status: 'fail', nodes: [{ target: '#offender', summary: 'violation' }] },
        'aria-required-parent': { status: 'pass', nodes: [] },
      }),
    ]);
    const result = runA11yAudit(AriaRelationshipsAudit, ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toContain('#offender');
  });

  it('fails when the `aria-required-parent` rule reports a violation', () => {
    const ctx = mockCheckContext([
      pageWithA11y('https://example.com/', {
        'aria-required-attr': { status: 'pass', nodes: [] },
        'aria-required-children': { status: 'pass', nodes: [] },
        'aria-required-parent': { status: 'fail', nodes: [{ target: '#offender', summary: 'violation' }] },
      }),
    ]);
    const result = runA11yAudit(AriaRelationshipsAudit, ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toContain('#offender');
  });

  it('passes when every constituent rule passes', () => {
    const ctx = mockCheckContext([
      pageWithA11y('https://example.com/', {
        'aria-required-attr': { status: 'pass', nodes: [] },
        'aria-required-children': { status: 'pass', nodes: [] },
        'aria-required-parent': { status: 'pass', nodes: [] },
      }),
    ]);
    expect(runA11yAudit(AriaRelationshipsAudit, ctx).status).toBe('pass');
  });

  it('is na when no constituent rule applies', () => {
    const ctx = mockCheckContext([
      pageWithA11y('https://example.com/', {
        'aria-required-attr': { status: 'inapplicable', nodes: [] },
        'aria-required-children': { status: 'inapplicable', nodes: [] },
        'aria-required-parent': { status: 'inapplicable', nodes: [] },
      }),
    ]);
    expect(runA11yAudit(AriaRelationshipsAudit, ctx).status).toBe('na');
  });
});
