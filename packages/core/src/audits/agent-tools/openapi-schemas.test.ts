import { describe, it, expect } from 'vitest';
import { OpenApiSchemasAudit } from './openapi-schemas';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

const responseWithSchema = {
  '200': { description: 'ok', content: { 'application/json': { schema: { type: 'object' } } } },
};
const requestWithSchema = {
  required: true,
  content: { 'application/json': { schema: { type: 'object' } } },
};

describe('OpenApiSchemasAudit', () => {
  const audit = new OpenApiSchemasAudit();

  it('passes when all operations have response schemas and writes have request schemas', () => {
    const spec = JSON.stringify({
      paths: {
        '/search': { get: { operationId: 'search', responses: responseWithSchema } },
        '/contact': {
          post: { operationId: 'contact', requestBody: requestWithSchema, responses: responseWithSchema },
        },
      },
    });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('response schemas');
  });

  it('warns on partial schema coverage', () => {
    const spec = JSON.stringify({
      paths: {
        '/a': { get: { operationId: 'a', responses: responseWithSchema } },
        '/b': { get: { operationId: 'b', responses: { '200': { description: 'ok' } } } },
      },
    });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('Partial schema coverage');
  });

  it('fails on low schema coverage', () => {
    const spec = JSON.stringify({
      paths: {
        '/a': { get: { operationId: 'a', responses: { '200': { description: 'ok' } } } },
        '/b': { get: { operationId: 'b', responses: { '200': { description: 'ok' } } } },
      },
    });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('Low schema coverage');
  });

  it('fails when there is no spec', () => {
    const ctx = mockCheckContext([], {});
    expect(audit.audit(ctx).status).toBe('fail');
  });

  it('fails when there are no operations', () => {
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

  it('fails when a POST endpoint has no requestBody schema but has a response schema', () => {
    const spec = JSON.stringify({
      paths: {
        '/contact': {
          post: {
            operationId: 'submitContact',
            responses: {
              '200': {
                description: 'ok',
                content: { 'application/json': { schema: { type: 'object' } } },
              },
            },
          },
        },
      },
    });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('request schemas');
  });

  it('fails when response has content but no schema defined on any media type', () => {
    const spec = JSON.stringify({
      paths: {
        '/a': {
          get: {
            operationId: 'a',
            responses: {
              '200': { description: 'ok', content: { 'application/json': {} } },
            },
          },
        },
        '/b': {
          get: {
            operationId: 'b',
            responses: {
              '200': { description: 'ok', content: { 'application/json': {} } },
            },
          },
        },
      },
    });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('Low schema coverage');
  });

  it('passes when all GET operations have response schemas (no write methods)', () => {
    const spec = JSON.stringify({
      paths: {
        '/search': {
          get: {
            operationId: 'search',
            responses: {
              '200': { description: 'ok', content: { 'application/json': { schema: { type: 'object' } } } },
            },
          },
        },
        '/products': {
          get: {
            operationId: 'listProducts',
            responses: {
              '200': { description: 'ok', content: { 'application/json': { schema: { type: 'array' } } } },
            },
          },
        },
      },
    });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).not.toContain('write operation');
  });

  it('fails when spec has a paths entry that is not an object', () => {
    const spec = JSON.stringify({ paths: { '/null-path': null } });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No operations');
  });

  it('handles POST with requestBody that has no content property', () => {
    const spec = JSON.stringify({
      paths: {
        '/contact': {
          post: {
            operationId: 'contact',
            requestBody: { required: true },
            responses: {
              '200': {
                description: 'ok',
                content: { 'application/json': { schema: { type: 'object' } } },
              },
            },
          },
        },
      },
    });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    // Has response schema but requestBody has no content → request schema not counted
    expect(result.status).toBe('fail');
    expect(result.message).toContain('request schemas');
  });

  it('does not count response schema when response entry is not an object', () => {
    const spec = JSON.stringify({
      paths: {
        '/a': { get: { operationId: 'a', responses: { '200': null } } },
        '/b': { get: { operationId: 'b', responses: { '200': null } } },
      },
    });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('Low schema coverage');
  });

  it('fails when spec has no paths key', () => {
    const spec = JSON.stringify({ openapi: '3.0.3', info: {} });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No operations');
  });

  it('does not count request schema when POST requestBody has content but no schema in media type', () => {
    const spec = JSON.stringify({
      paths: {
        '/contact': {
          post: {
            operationId: 'contact',
            requestBody: { required: true, content: { 'application/json': {} } },
            responses: {
              '200': { description: 'ok', content: { 'application/json': { schema: { type: 'object' } } } },
            },
          },
        },
      },
    });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    // Has response schema but requestBody media type has no schema → request not counted
    expect(result.status).toBe('fail');
    expect(result.message).toContain('request schemas');
  });

  it('does not count response schema when operation has no responses key', () => {
    const spec = JSON.stringify({
      paths: {
        '/a': { post: { operationId: 'a', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } } } },
        '/b': { post: { operationId: 'b', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } } } },
      },
    });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    // Has request schemas but no response schemas → low coverage
    expect(result.status).toBe('fail');
    expect(result.message).toContain('Low schema coverage');
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
