import { describe, it, expect } from 'vitest';
import { OpenApiOperationIdsAudit } from './openapi-operation-ids';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

describe('OpenApiOperationIdsAudit', () => {
  const audit = new OpenApiOperationIdsAudit();

  it('passes when all operations have unique operationIds', () => {
    const spec = JSON.stringify({
      paths: {
        '/search': { get: { operationId: 'searchContent' } },
        '/contact': { post: { operationId: 'submitContact' } },
      },
    });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('unique operationIds');
  });

  it('warns when some operationIds are missing', () => {
    const spec = JSON.stringify({
      paths: {
        '/search': { get: { operationId: 'searchContent' } },
        '/contact': { post: {} },
      },
    });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('1 missing');
  });

  it('warns when operationIds are duplicated', () => {
    const spec = JSON.stringify({
      paths: {
        '/a': { get: { operationId: 'dup' } },
        '/b': { get: { operationId: 'dup' } },
      },
    });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('duplicate');
  });

  it('fails when there is no spec', () => {
    const ctx = mockCheckContext([], {});
    expect(audit.audit(ctx).status).toBe('fail');
  });

  it('fails when the spec has no operations', () => {
    const ctx = mockCheckContext([], {
      '/openapi.json': mockFetchResult(JSON.stringify({ paths: {} }), 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No operations');
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
    expect(result.message).toContain('No operations');
  });

  it('fails when spec has a paths entry that is not an object', () => {
    const spec = JSON.stringify({ paths: { '/null-path': null } });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No operations');
  });

  it('fails when paths is an array (covers Array.isArray branch of isObject)', () => {
    const spec = JSON.stringify({ paths: ['get', 'post'] });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No operations');
  });

  it('fails when path item is a string (covers typeof branch of isObject)', () => {
    const spec = JSON.stringify({ paths: { '/products': 'GET' } });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No operations');
  });

  it('fails when path item is an array (covers Array.isArray pathItem branch)', () => {
    const spec = JSON.stringify({ paths: { '/products': ['get', 'post'] } });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No operations');
  });
});
