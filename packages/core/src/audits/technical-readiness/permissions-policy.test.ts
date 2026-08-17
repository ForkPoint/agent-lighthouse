import { describe, it, expect } from 'vitest';
import { PermissionsPolicyAudit } from './permissions-policy';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('PermissionsPolicyAudit', () => {
  const audit = new PermissionsPolicyAudit();

  it('passes when Permissions-Policy header is present', () => {
    const page = mockPageContext('https://example.com', '<html></html>');
    page.fetchResult.headers['permissions-policy'] = 'camera=(), microphone=()';
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.found).toContain('camera=()');
  });

  it('truncates very long header values', () => {
    const page = mockPageContext('https://example.com', '<html></html>');
    page.fetchResult.headers['permissions-policy'] = 'camera=(), '.repeat(40);
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.found).toContain('...');
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
