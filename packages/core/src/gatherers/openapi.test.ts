import { describe, it, expect } from 'vitest';
import { mockCheckContext, mockFetchResult } from '../__tests__/test-utils';
import { NO_OPENAPI_SPEC, openApiOperations, readOpenApiSpec } from './openapi';

const ctxWith = (body: string, status = 200) =>
  mockCheckContext([], { '/openapi.json': mockFetchResult(body, status) });

describe('readOpenApiSpec', () => {
  it('returns the parsed document served at /openapi.json', () => {
    const spec = readOpenApiSpec(ctxWith(JSON.stringify({ openapi: '3.1.0', paths: {} })));
    expect(spec?.['openapi']).toBe('3.1.0');
  });

  it('returns undefined when no root file was fetched', () => {
    expect(readOpenApiSpec(mockCheckContext([], {}))).toBeUndefined();
  });

  it('returns undefined on a non-200 status', () => {
    expect(readOpenApiSpec(ctxWith(JSON.stringify({ openapi: '3.1.0' }), 404))).toBeUndefined();
  });

  it('returns undefined on an empty body', () => {
    expect(readOpenApiSpec(ctxWith(''))).toBeUndefined();
  });

  it('returns undefined on a body that is not JSON', () => {
    expect(readOpenApiSpec(ctxWith('invalid json {{{'))).toBeUndefined();
  });

  it('returns undefined on JSON that is not an object', () => {
    expect(readOpenApiSpec(ctxWith('[1, 2, 3]'))).toBeUndefined();
    expect(readOpenApiSpec(ctxWith('"a string"'))).toBeUndefined();
    expect(readOpenApiSpec(ctxWith('null'))).toBeUndefined();
  });
});

describe('openApiOperations', () => {
  it('flattens every declared method into path + method + operation', () => {
    const ops = openApiOperations({
      paths: {
        '/search': { get: { operationId: 'search' }, post: { operationId: 'searchPost' } },
        '/contact': { post: { operationId: 'contact' } },
      },
    });
    expect(ops).toHaveLength(3);
    expect(ops.map((o) => `${o.method} ${o.path}`)).toContain('get /search');
  });

  it('ignores keys that are not HTTP methods', () => {
    const ops = openApiOperations({
      paths: { '/search': { get: {}, parameters: [], summary: 'not an operation' } },
    });
    expect(ops).toHaveLength(1);
  });

  // These shapes reach the traversal from real documents and from the corpus,
  // and each one used to be pinned by a near-identical test in three separate
  // audit suites. They belong to the traversal, so they live with it.
  it.each([
    ['no paths key', { openapi: '3.1.0', info: {} }],
    ['paths as an array', { paths: ['get', 'post'] }],
    ['paths as null', { paths: null }],
    ['a null path item', { paths: { '/x': null } }],
    ['a string path item', { paths: { '/x': 'GET' } }],
    ['an array path item', { paths: { '/x': ['get'] } }],
    ['a non-object operation', { paths: { '/x': { get: 'yes' } } }],
  ])('returns no operations for %s', (_label, spec) => {
    expect(openApiOperations(spec as Record<string, unknown>)).toEqual([]);
  });
});

describe('NO_OPENAPI_SPEC', () => {
  // The four content audits must say the same thing about the same absence.
  // A per-audit sentence is how three of them drifted apart in the first place.
  it('carries one message and one `found` for the whole family', () => {
    expect(NO_OPENAPI_SPEC.found).toBe('No OpenAPI document');
    expect(NO_OPENAPI_SPEC.message).toContain('/openapi.json');
  });
});
