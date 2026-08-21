import { describe, it, expect } from 'vitest';
import { OpenApiDescriptionQualityAudit } from './openapi-description-quality';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

const LONG_OP_DESC = 'Searches the product catalog by keyword and returns matches.';
const LONG_PARAM_DESC = "Full-text search query, e.g. 'red running shoes'.";

function specWith(body: unknown): Record<string, ReturnType<typeof mockFetchResult>> {
  return { '/openapi.json': mockFetchResult(JSON.stringify(body), 200) };
}

describe('OpenApiDescriptionQualityAudit', () => {
  const audit = new OpenApiDescriptionQualityAudit();

  it('is na when there is no spec', () => {
    const ctx = mockCheckContext([], {});
    const result = audit.audit(ctx);
    expect(result.status).toBe('na');
    expect(result.score).toBe(0);
  });

  it('is na when openapi.json is invalid JSON', () => {
    const ctx = mockCheckContext([], {
      '/openapi.json': mockFetchResult('invalid json {{{', 200),
    });
    expect(audit.audit(ctx).status).toBe('na');
  });

  it('is na when the spec has no operations or parameters', () => {
    const ctx = mockCheckContext([], specWith({ openapi: '3.0.3', paths: {} }));
    const result = audit.audit(ctx);
    expect(result.status).toBe('na');
    expect(result.message).toContain('no operations or parameters');
  });

  it('passes when all operations and parameters have verbose descriptions', () => {
    const ctx = mockCheckContext(
      [],
      specWith({
        openapi: '3.0.3',
        paths: {
          '/search': {
            get: {
              operationId: 'searchProducts',
              description: LONG_OP_DESC,
              parameters: [
                { name: 'q', in: 'query', description: LONG_PARAM_DESC },
                { name: 'limit', in: 'query', description: 'Maximum number of results to return.' },
              ],
            },
          },
          '/contact': {
            post: {
              operationId: 'submitContact',
              description: 'Submits a contact inquiry to the support team.',
            },
          },
        },
      }),
    );
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.score).toBe(1.0);
    expect(result.found).toBe('4/4 described (100%)');
  });

  it('warns when 50-90% of descriptions are verbose enough', () => {
    // 2 of 3 described = 67%
    const ctx = mockCheckContext(
      [],
      specWith({
        openapi: '3.0.3',
        paths: {
          '/search': {
            get: {
              operationId: 'searchProducts',
              description: LONG_OP_DESC,
              parameters: [
                { name: 'q', in: 'query', description: LONG_PARAM_DESC },
                { name: 'limit', in: 'query' },
              ],
            },
          },
        },
      }),
    );
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.score).toBe(0.5);
    expect(result.found).toContain('2/3');
    expect(result.details?.missingDescriptions).toEqual(["GET /search param 'limit'"]);
  });

  it('fails when fewer than 50% of descriptions are verbose enough', () => {
    // 0 of 3 described
    const ctx = mockCheckContext(
      [],
      specWith({
        openapi: '3.0.3',
        paths: {
          '/search': {
            get: {
              operationId: 'searchProducts',
              parameters: [
                { name: 'q', in: 'query' },
                { name: 'limit', in: 'query', description: 'short' },
              ],
            },
          },
        },
      }),
    );
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.score).toBe(0);
    expect(result.priority).toBe('high');
    expect(result.details?.missingDescriptions).toHaveLength(3);
  });

  it('truncates the missing list to 10 items', () => {
    const parameters = Array.from({ length: 12 }, (_, i) => ({
      name: `p${i}`,
      in: 'query',
    }));
    const ctx = mockCheckContext(
      [],
      specWith({
        openapi: '3.0.3',
        paths: { '/search': { get: { operationId: 'search', parameters } } },
      }),
    );
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.details?.missingDescriptions).toHaveLength(10);
    expect(result.message).toContain('and 3 more');
  });
});
