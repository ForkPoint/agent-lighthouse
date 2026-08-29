import { describe, it, expect } from 'vitest';
import { OpenApiOperationIdsAudit } from './openapi-operation-ids';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';
import { expectNotApplicableOnEmpty } from '../../tests/na-contract';

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
    expect(result.message).toContain('unique, registrable operationIds');
  });

  // The same bad id copied onto two operations is one naming defect. Printing
  // it twice reads as two different ids to fix.
  it('names a repeated illegal operationId once', () => {
    const spec = JSON.stringify({
      paths: {
        '/search': { get: { operationId: 'search content' } },
        '/contact': { post: { operationId: 'search content' } },
      },
    });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.found?.match(/search content/g)).toHaveLength(1);
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

  // The naming rule folded in from 5.23 (webmcp-tool-naming) on 2026-08-22.
  // It is the structural, consumer-documented half: an operationId is the
  // function name a tool-calling runtime registers, and Anthropic requires
  // `^[a-zA-Z0-9_-]{1,64}$` for that name. 5.23's English-verb allowlist and
  // 20-character description floor are NOT ported — no spec or vendor doc
  // constrains either.
  describe('operationId legality (naming rule ported from 5.23)', () => {
    const specWith = (ids: string[]) =>
      JSON.stringify({
        paths: Object.fromEntries(
          ids.map((id, i) => [`/p${i}`, { get: { operationId: id } }]),
        ),
      });
    const ctxWith = (ids: string[]) =>
      mockCheckContext([], { '/openapi.json': mockFetchResult(specWith(ids), 200) });

    it('fails an operationId containing spaces and punctuation, naming it', () => {
      const result = audit.audit(ctxWith(["Get user's profile (v2)"]));
      expect(result.status).toBe('fail');
      expect(result.message).toContain('cannot be registered');
      expect(result.found).toContain("Get user's profile (v2)");
    });

    it('fails an operationId longer than 64 characters', () => {
      const result = audit.audit(ctxWith(['a'.repeat(65)]));
      expect(result.status).toBe('fail');
    });

    it('accepts exactly 64 characters (boundary)', () => {
      expect(audit.audit(ctxWith(['a'.repeat(64)])).status).toBe('pass');
    });

    // 5.23's VERB_PATTERN rejected these; the structural rule accepts them,
    // and MCP's own example tool is snake_case `get_weather`.
    it('accepts snake_case and kebab-case ids that 5.23’s verb allowlist rejected', () => {
      expect(audit.audit(ctxWith(['get_weather', 'search-products'])).status).toBe('pass');
    });

    it('accepts a non-English / domain verb that 5.23’s allowlist rejected', () => {
      expect(audit.audit(ctxWith(['provisionTenant', 'ingestDocument'])).status).toBe('pass');
    });

    // Deviation from 5.23's suggested "namespaced separator" escape hatch: a
    // dot is not legal in a tool-call function name, so it still fails.
    it('fails a dotted namespace, which no runtime can register verbatim', () => {
      const result = audit.audit(ctxWith(['products.search']));
      expect(result.status).toBe('fail');
      expect(result.found).toContain('products.search');
    });

    it('reports illegality ahead of a missing id when both are present', () => {
      const spec = JSON.stringify({
        paths: {
          '/a': { get: { operationId: 'bad name' } },
          '/b': { get: {} },
        },
      });
      const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
      const result = audit.audit(ctx);
      expect(result.status).toBe('fail');
      expect(result.message).toContain('1 missing');
    });

    it('lists every offending id, not just a count', () => {
      const result = audit.audit(ctxWith(['bad one', 'bad two', 'goodOne']));
      expect(result.found).toContain('bad one');
      expect(result.found).toContain('bad two');
      expect(result.found).not.toContain('goodOne');
    });
  });

  // Absent artifact, absent verdict: an operationId is a property of an
  // operation, so no document and no operations leave nothing to have read.
  // The missing/duplicate/illegal verdicts above are unchanged.
  it('declines when there is no spec', () => {
    const result = audit.audit(mockCheckContext([], {}));
    expect(result.status).toBe('na');
    expect(result.found).toBe('No OpenAPI document');
  });

  it('declines on a scan that read nothing', async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it('declines when the spec has no operations', () => {
    const ctx = mockCheckContext([], {
      '/openapi.json': mockFetchResult(JSON.stringify({ paths: {} }), 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('na');
    expect(result.message).toContain('no operationIds');
  });

  it('declines when openapi.json contains invalid JSON', () => {
    const ctx = mockCheckContext([], {
      '/openapi.json': mockFetchResult('invalid json {{{', 200),
    });
    expect(audit.audit(ctx).status).toBe('na');
  });

  it('declines on a document with no paths key — no operation was ever read', () => {
    const spec = JSON.stringify({ openapi: '3.0.3', info: {} });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('na');
    expect(result.message).toContain('no operations');
  });

  it('declines on a null path item — no operation was ever read', () => {
    const spec = JSON.stringify({ paths: { '/null-path': null } });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('na');
    expect(result.message).toContain('no operations');
  });

  it('declines on an array in place of paths — no operation was ever read', () => {
    const spec = JSON.stringify({ paths: ['get', 'post'] });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('na');
    expect(result.message).toContain('no operations');
  });

  it('declines on a string path item — no operation was ever read', () => {
    const spec = JSON.stringify({ paths: { '/products': 'GET' } });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('na');
    expect(result.message).toContain('no operations');
  });

  it('declines on an array path item — no operation was ever read', () => {
    const spec = JSON.stringify({ paths: { '/products': ['get', 'post'] } });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('na');
    expect(result.message).toContain('no operations');
  });
});
