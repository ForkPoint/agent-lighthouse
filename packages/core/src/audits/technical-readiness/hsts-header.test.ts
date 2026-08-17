import { describe, it, expect } from 'vitest';
import { HstsHeaderAudit } from './hsts-header';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('HstsHeaderAudit', () => {
  const audit = new HstsHeaderAudit();

  it('passes when Strict-Transport-Security header is present', () => {
    const page = mockPageContext('https://example.com', '<html></html>');
    page.fetchResult.headers['strict-transport-security'] = 'max-age=31536000; includeSubDomains';
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.found).toContain('max-age=31536000');
  });

  it('fails when HSTS header is missing', () => {
    const page = mockPageContext('https://example.com', '<html></html>');
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toContain('Header not found');
  });

  it('fails when there are no pages', () => {
    const ctx = mockCheckContext([]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
  });
});
