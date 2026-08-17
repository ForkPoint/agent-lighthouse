import { describe, it, expect } from 'vitest';
import {
  A11yAriaHiddenBodyAudit,
  A11yTableHeadersAudit,
  A11yDocumentTitleAudit,
} from './_a11y';
import { mockPageContext, mockCheckContext } from '../../__tests__/test-utils';
import type { A11yPageResult } from './runner';
import type { Audit } from '../../audit';
import type { CheckContext } from '../../check-context';
import type { AuditResult } from "../../types";

// The audits are generated classes typed as `typeof Audit` (abstract); construct
// them the same way the registry does. They run synchronously, so cast the
// result off the `AuditResult | Promise<AuditResult>` union.
const run = (AuditClass: unknown, ctx: CheckContext) =>
  new (AuditClass as new () => Audit)().audit(ctx) as AuditResult;

// The engine-backed audits read ctx.pages[].a11yResults (populated by the
// orchestrator). These tests exercise the aggregation logic directly with
// synthetic a11yResults — the real rule execution is covered by runner.test.ts.
function pageWithA11y(url: string, a11yResults: A11yPageResult) {
  const p = mockPageContext(url, '<!doctype html><html><body></body></html>');
  p.a11yResults = a11yResults;
  return p;
}

describe('A11yBackedAudit aggregation', () => {
  it('fails when any constituent rule has a violation on any page', () => {
    const ctx = mockCheckContext([
      pageWithA11y('https://example.com/', {
        'document-title': { status: 'pass', nodes: [] },
      }),
      pageWithA11y('https://example.com/p', {
        'document-title': { status: 'fail', nodes: [{ target: 'html', summary: 'no title' }] },
      }),
    ]);
    const result = run(A11yDocumentTitleAudit, ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toContain('html');
  });

  it('passes when a rule passes and none fail', () => {
    const ctx = mockCheckContext([
      pageWithA11y('https://example.com/', {
        'aria-hidden-body': { status: 'pass', nodes: [] },
      }),
    ]);
    const result = run(A11yAriaHiddenBodyAudit, ctx);
    expect(result.status).toBe('pass');
  });

  it('returns na when every constituent rule is inapplicable / unseen', () => {
    const ctx = mockCheckContext([
      pageWithA11y('https://example.com/', {
        'td-has-header': { status: 'inapplicable', nodes: [] },
        'th-has-data-cells': { status: 'inapplicable', nodes: [] },
      }),
    ]);
    const result = run(A11yTableHeadersAudit, ctx);
    expect(result.status).toBe('na');
  });

  it('returns na when pages have no a11yResults at all', () => {
    const ctx = mockCheckContext([mockPageContext('https://example.com/', '<html></html>')]);
    const result = run(A11yAriaHiddenBodyAudit, ctx);
    expect(result.status).toBe('na');
  });

  it('warns when a rule is incomplete and none pass or fail', () => {
    const ctx = mockCheckContext([
      pageWithA11y('https://example.com/', {
        'aria-hidden-body': { status: 'incomplete', nodes: [] },
      }),
    ]);
    const result = run(A11yAriaHiddenBodyAudit, ctx);
    expect(result.status).toBe('warn');
  });

  it('passes when a rule passes even when incomplete is also seen', () => {
    // sawIncomplete && !sawPass → false, so falls through to sawPass check
    const ctx = mockCheckContext([
      pageWithA11y('https://example.com/', {
        'aria-hidden-body': { status: 'incomplete', nodes: [] },
      }),
      pageWithA11y('https://example.com/p', {
        'aria-hidden-body': { status: 'pass', nodes: [] },
      }),
    ]);
    const result = run(A11yAriaHiddenBodyAudit, ctx);
    expect(result.status).toBe('pass');
  });

  it('caps collected failing selectors at 5 even when more nodes fail', () => {
    const ctx = mockCheckContext([
      pageWithA11y('https://example.com/', {
        'document-title': {
          status: 'fail',
          nodes: [
            { target: '#a', summary: '' },
            { target: '#b', summary: '' },
            { target: '#c', summary: '' },
            { target: '#d', summary: '' },
            { target: '#e', summary: '' },
            { target: '#f', summary: '' }, // 6th — must be dropped
          ],
        },
      }),
    ]);
    const result = run(A11yDocumentTitleAudit, ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toContain('#a');
    expect(result.found).not.toContain('#f');
  });

  it('falls back to "see report" in found when a failing rule has no nodes', () => {
    const ctx = mockCheckContext([
      pageWithA11y('https://example.com/', {
        'document-title': { status: 'fail', nodes: [] },
      }),
    ]);
    const result = run(A11yDocumentTitleAudit, ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toContain('see report');
  });
});
