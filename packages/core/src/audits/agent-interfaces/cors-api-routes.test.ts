import { describe, it, expect } from 'vitest';
import { CorsApiRoutesAudit } from './cors-api-routes';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';
import type { FetchResult } from '../../fetcher';

describe('CorsApiRoutesAudit', () => {
  const audit = new CorsApiRoutesAudit();

  function corsResult(acao?: string, status = 204): FetchResult {
    const r = mockFetchResult('', status);
    if (acao !== undefined) r.headers['access-control-allow-origin'] = acao;
    return r;
  }

  it('warns when no OpenAPI spec is present', async () => {
    const ctx = mockCheckContext([], {});
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('No OpenAPI spec found');
  });

  it('passes when /api/ responds with CORS headers', async () => {
    const ctx = mockCheckContext([], {
      '/openapi.json': mockFetchResult('{}', 200, 'application/json'),
    });
    ctx.fetch = async () => corsResult('*');
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('CORS headers enabled');
  });

  it('fails when /api/ has no CORS headers', async () => {
    const ctx = mockCheckContext([], {
      '/openapi.json': mockFetchResult('{}', 200, 'application/json'),
    });
    ctx.fetch = async () => corsResult(undefined);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('missing CORS headers');
  });

  it('retries without trailing slash on redirect', async () => {
    const ctx = mockCheckContext([], {
      '/openapi.json': mockFetchResult('{}', 200, 'application/json'),
    });
    let call = 0;
    ctx.fetch = async () => {
      call++;
      return call === 1 ? corsResult(undefined, 308) : corsResult('*');
    };
    const result = await audit.audit(ctx);
    expect(call).toBe(2);
    expect(result.status).toBe('pass');
  });

  it('warns when OPTIONS fetch throws', async () => {
    const ctx = mockCheckContext([], {
      '/openapi.json': mockFetchResult('{}', 200, 'application/json'),
    });
    ctx.fetch = async () => {
      throw new Error('network');
    };
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('Failed to fetch');
  });

  it('passes when CORS header is a specific non-wildcard origin', async () => {
    const ctx = mockCheckContext([], {
      '/openapi.json': mockFetchResult('{}', 200, 'application/json'),
    });
    ctx.fetch = async () => {
      const r = mockFetchResult('', 204);
      r.headers['access-control-allow-origin'] = 'https://trusted.example.com';
      return r;
    };
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('CORS headers enabled');
  });
});
