import { describe, it, expect } from 'vitest';
import { OpenApiEndpointsAudit } from './openapi-endpoints';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

describe('OpenApiEndpointsAudit', () => {
  const audit = new OpenApiEndpointsAudit();

  it('passes when the spec defines operations', () => {
    const spec = JSON.stringify({
      openapi: '3.0.3',
      paths: {
        '/search': { get: { operationId: 'search' } },
        '/contact': { post: { operationId: 'contact' } },
      },
    });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('2 operation(s)');
  });

  it('fails when there is no parseable spec', () => {
    const ctx = mockCheckContext([], {});
    expect(audit.audit(ctx).status).toBe('fail');
  });

  it('fails when the spec has no operations', () => {
    const spec = JSON.stringify({ openapi: '3.0.3', paths: {} });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('no operations');
  });

  it('fails when openapi.json contains invalid JSON', () => {
    const ctx = mockCheckContext([], {
      '/openapi.json': mockFetchResult('invalid json {{{', 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No parseable');
  });

  it('fails when spec has no paths key', () => {
    const spec = JSON.stringify({ openapi: '3.0.3', info: {} });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('no operations');
  });

  it('fails when spec has a paths entry that is not an object', () => {
    const spec = JSON.stringify({ paths: { '/null-path': null } });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('no operations');
  });

  it('fails when paths is an array (covers Array.isArray branch of isObject)', () => {
    const spec = JSON.stringify({ paths: ['get', 'post'] });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('no operations');
  });

  it('fails when path item is a string (covers typeof branch of isObject)', () => {
    const spec = JSON.stringify({ paths: { '/products': 'GET' } });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('no operations');
  });

  it('fails when path item is an array (covers Array.isArray pathItem branch)', () => {
    const spec = JSON.stringify({ paths: { '/products': ['get', 'post'] } });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('no operations');
  });
});
