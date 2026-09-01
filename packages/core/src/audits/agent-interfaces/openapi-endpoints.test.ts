import { describe, it, expect } from 'vitest';
import { OpenApiEndpointsAudit } from './openapi-endpoints';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';
import { expectNotApplicableOnEmpty } from '../../tests/na-contract';

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

  it('fails when the spec has no operations', () => {
    const spec = JSON.stringify({ openapi: '3.0.3', paths: {} });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('no operations');
  });

  // A body that will not parse is a document this audit never read, so it is
  // the same absence `openapi-exists` already reports.
  it('declines when openapi.json contains invalid JSON', () => {
    const ctx = mockCheckContext([], {
      '/openapi.json': mockFetchResult('invalid json {{{', 200),
    });
    expect(audit.audit(ctx).status).toBe('na');
  });

  // Absent artifact, absent verdict. A document that declares no operations
  // is still this audit's finding — see the `fail` cases above.
  it('declines when there is no spec', () => {
    const result = audit.audit(mockCheckContext([], {}));
    expect(result.status).toBe('na');
    expect(result.found).toBe('No readable OpenAPI document');
  });

  it('declines on a scan that read nothing', async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it('fails when spec has no paths key', () => {
    const spec = JSON.stringify({ openapi: '3.0.3', info: {} });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('no operations');
  });

  // Present and broken, not absent. Each of these is a `paths` the author
  // wrote and an agent cannot walk, so it stays a failure and says so.
  it('fails and names the defect when a path item is null', () => {
    const spec = JSON.stringify({ paths: { '/null-path': null } });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('malformed paths object');
    expect(result.found).toBe('paths entry "/null-path" is null, not a path item object');
  });

  it('fails and names the defect when paths is an array', () => {
    const spec = JSON.stringify({ paths: ['get', 'post'] });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toBe('paths is an array, not an object');
  });

  it('fails and names the defect when a path item is a string', () => {
    const spec = JSON.stringify({ paths: { '/products': 'GET' } });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toBe('paths entry "/products" is a string, not a path item object');
  });

  it('fails and names the defect when a path item is an array', () => {
    const spec = JSON.stringify({ paths: { '/products': ['get', 'post'] } });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toBe('paths entry "/products" is an array, not a path item object');
  });
  // Against released `main` a document with twenty good operations and one
  // broken entry passed with "20 operation(s)". It still does: the readable
  // operations meet the stated expectation, and the defect is named, not
  // charged.
  it('passes on readable operations beside a broken entry and names the defect', () => {
    const spec = JSON.stringify({
      paths: {
        '/a': { get: { operationId: 'a' } },
        '/b': { post: { operationId: 'b' } },
        '/legacy': null,
      },
    });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('2 operation(s)');
    expect(result.message).toContain('Skipped 1 unreadable entry');
    expect(result.found).toBe('2 operation(s); 1 unreadable');
  });

  // A defect one level down is the same defect: nothing is readable, so this
  // is a present-and-broken document, not an empty one.
  it('fails when the only method value is not an operation object', () => {
    const spec = JSON.stringify({ paths: { '/x': { get: 'yes' } } });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toBe('paths entry "/x" declares get as a string, not an operation object');
  });

  // Legal OpenAPI that declares nothing: broken is not the finding here.
  it('reports an empty path item as an empty document, not a malformed one', () => {
    const spec = JSON.stringify({ paths: { '/x': {} } });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toBe('0 operations');
  });
});
