import { describe, it, expect } from 'vitest';
import { AiCatalogUrlsAudit } from './ai-catalog-urls';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';
import type { FetchResult } from '../../fetcher';

function catalog(urls: string[]): string {
  return JSON.stringify({
    services: urls.map((url, i) => ({ name: `svc${i}`, url, type: 'rest' })),
  });
}

describe('AiCatalogUrlsAudit', () => {
  const audit = new AiCatalogUrlsAudit();

  it('passes when all service URLs return HTTP 200', async () => {
    const ctx = mockCheckContext([], {
      '/.well-known/ai-catalog.json': mockFetchResult(
        catalog(['https://example.com/a', 'https://example.com/b']),
        200,
      ),
    });
    ctx.fetch = async () => mockFetchResult('', 200);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('2 service URL(s)');
  });

  it('warns when some service URLs are unreachable', async () => {
    const ctx = mockCheckContext([], {
      '/.well-known/ai-catalog.json': mockFetchResult(
        catalog(['https://example.com/ok', 'https://example.com/bad']),
        200,
      ),
    });
    ctx.fetch = async ({ url }) => {
      const status = url.includes('/ok') ? 200 : 404;
      const r: FetchResult = mockFetchResult('', status);
      r.url = url;
      return r;
    };
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('1/2');
  });

  it('fails when none of the service URLs are reachable', async () => {
    const ctx = mockCheckContext([], {
      '/.well-known/ai-catalog.json': mockFetchResult(
        catalog(['https://example.com/a', 'https://example.com/b']),
        200,
      ),
    });
    ctx.fetch = async () => mockFetchResult('', 500);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('None of the 2');
  });

  it('warns when there are no service URLs', async () => {
    const ctx = mockCheckContext([], {
      '/.well-known/ai-catalog.json': mockFetchResult(
        JSON.stringify({ services: [{ name: 'noUrl' }] }),
        200,
      ),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('No service URLs');
  });

  it('fails when ai-catalog.json is missing', async () => {
    const ctx = mockCheckContext([], {});
    expect((await audit.audit(ctx)).status).toBe('fail');
  });

  it('fails when there is no services array', async () => {
    const ctx = mockCheckContext([], {
      '/.well-known/ai-catalog.json': mockFetchResult(JSON.stringify({ name: 'Site' }), 200),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('no services array');
  });

  it('fails when ai-catalog.json has invalid JSON body', async () => {
    const ctx = mockCheckContext([], {
      '/.well-known/ai-catalog.json': mockFetchResult('not json {{{', 200),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('no services array');
  });

  it('counts fetch errors as status 0 and fails when all URLs unreachable', async () => {
    const ctx = mockCheckContext([], {
      '/.well-known/ai-catalog.json': mockFetchResult(
        JSON.stringify({ services: [{ name: 'svc', url: 'https://example.com/api' }] }),
        200,
      ),
    });
    ctx.fetch = async () => {
      throw new Error('network error');
    };
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('None of the 1');
  });
});
