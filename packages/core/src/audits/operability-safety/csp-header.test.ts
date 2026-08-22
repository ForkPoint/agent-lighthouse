import { describe, it, expect } from 'vitest';
import { CspHeaderAudit } from './csp-header';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('CspHeaderAudit', () => {
  const audit = new CspHeaderAudit();

  it('passes when Content-Security-Policy header is present', () => {
    const page = mockPageContext('https://example.com', '<html></html>');
    page.fetchResult.headers['content-security-policy'] = "default-src 'self'";
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.found).toContain("default-src 'self'");
  });

  it('truncates very long CSP values in found', () => {
    const longCsp = "default-src 'self'; " + 'img-src '.repeat(40);
    const page = mockPageContext('https://example.com', '<html></html>');
    page.fetchResult.headers['content-security-policy'] = longCsp;
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.found).toContain('...');
  });

  it('fails when CSP header is missing', () => {
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
