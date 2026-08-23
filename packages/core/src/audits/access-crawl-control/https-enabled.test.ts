import { describe, it, expect } from 'vitest';
import { HttpsEnabledAudit } from './https-enabled';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('HttpsEnabledAudit', () => {
  const audit = new HttpsEnabledAudit();

  it('passes when baseUrl is https and homepage returns 200', () => {
    const page = mockPageContext('https://example.com', '<html><body>Hi</body></html>');
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('HTTPS');
  });

  it('warns when https but homepage returns non-200', () => {
    const page = mockPageContext('https://example.com', '<html><body>Hi</body></html>');
    page.fetchResult.status = 500;
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('500');
  });

  it('fails when baseUrl is not https', () => {
    const page = mockPageContext('http://example.com', '<html><body>Hi</body></html>');
    const ctx = mockCheckContext([page]);
    ctx.baseUrl = 'http://example.com';
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('not served over HTTPS');
  });

  it('warns with "unknown" status when https but no pages available', () => {
    const ctx = mockCheckContext([]);
    // baseUrl is 'https://example.com' by default → isHttps=true, page=undefined → warn
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('unknown');
  });
});
