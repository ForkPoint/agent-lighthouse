import { describe, it, expect } from 'vitest';
import { ReferrerPolicyAudit } from './referrer-policy';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('ReferrerPolicyAudit', () => {
  const audit = new ReferrerPolicyAudit();

  it('passes when Referrer-Policy header is present', () => {
    const page = mockPageContext('https://example.com', '<html></html>');
    page.fetchResult.headers['referrer-policy'] = 'strict-origin-when-cross-origin';
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.found).toContain('strict-origin-when-cross-origin');
  });

  it('fails when header is missing', () => {
    const page = mockPageContext('https://example.com', '<html></html>');
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toContain('Header not found');
  });

  it('fails when there are no pages (covers headers ?? {} branch)', () => {
    const ctx = mockCheckContext([]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
  });
});
