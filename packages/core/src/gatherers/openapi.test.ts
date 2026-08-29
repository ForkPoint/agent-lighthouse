import { describe, it, expect } from 'vitest';
import { mockCheckContext, mockFetchResult } from '../__tests__/test-utils';
import {
  NO_OPENAPI_SPEC,
  openApiOperations,
  readOpenApiPaths,
  readOpenApiSpec,
} from './openapi';

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

  // A caller here is looking for one endpoint, not grading the document. A site
  // with a POST /contact and one broken sibling entry does have a contact
  // endpoint, and `readOpenApiPaths` would discard both because it judges the
  // document as a whole. That difference is why this walk is separate.
  it('keeps the well-formed entries beside a broken one', () => {
    const ops = openApiOperations({
      paths: { '/contact': { post: { operationId: 'contact' } }, '/bad': 'oops' },
    });
    expect(ops.map((o) => `${o.method} ${o.path}`)).toEqual(['post /contact']);
  });

  // OpenAPI 3.1 §4.8.8: a Paths Object may carry specification extensions
  // beside its path items. A real path key always starts with `/`, so an `x-`
  // key is never an operation, whatever it holds.
  it('skips a specification extension that looks like a path item', () => {
    const ops = openApiOperations({
      paths: { 'x-webhooks': { post: {} }, '/ok': { get: {} } },
    });
    expect(ops.map((o) => `${o.method} ${o.path}`)).toEqual(['get /ok']);
  });
});

describe('readOpenApiPaths', () => {
  // Absent and broken are different findings, and this is the one place the
  // difference is decided. An audit about the document's contents declines the
  // first and fails the second.
  it.each([
    ['no paths key', { openapi: '3.1.0', info: {} }],
    ['an empty paths object', { paths: {} }],
    ['path items that declare no method', { paths: { '/x': { summary: 'nothing' } } }],
    ['a path item whose method value is not an object', { paths: { '/x': { get: 'yes' } } }],
    ['only specification extensions', { paths: { 'x-internal': 'anything' } }],
  ])('reports %s as empty', (_label, spec) => {
    expect(readOpenApiPaths(spec as Record<string, unknown>).kind).toBe('empty');
  });

  it.each([
    ['paths as an array', { paths: ['get', 'post'] }, 'paths is an array, not an object'],
    ['paths as null', { paths: null }, 'paths is null, not an object'],
    ['paths as a string', { paths: '/search' }, 'paths is a string, not an object'],
    [
      'a null path item',
      { paths: { '/x': null } },
      'paths entry "/x" is null, not a path item object',
    ],
    [
      'a string path item',
      { paths: { '/x': 'GET' } },
      'paths entry "/x" is a string, not a path item object',
    ],
    [
      'an array path item',
      { paths: { '/x': ['get'] } },
      'paths entry "/x" is an array, not a path item object',
    ],
  ])('reports %s as malformed and names it', (_label, spec, found) => {
    const reading = readOpenApiPaths(spec as Record<string, unknown>);
    expect(reading.kind).toBe('malformed');
    expect(reading.kind === 'malformed' && reading.found).toBe(found);
  });

  it('does not judge a specification extension beside a real path item', () => {
    const reading = readOpenApiPaths({
      paths: { 'x-internal': ['anything'], '/search': { get: { operationId: 'search' } } },
    });
    expect(reading.kind).toBe('operations');
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
