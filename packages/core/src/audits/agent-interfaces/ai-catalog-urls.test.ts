import { describe, it, expect, vi } from 'vitest';
import { AiCatalogUrlsAudit } from './ai-catalog-urls';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';
import type { FetchResult } from '../../fetcher';

// isSafeUrl does a real DNS lookup before the audit probes a site-controlled
// URL. Stub it with an offline stand-in that still refuses loopback, private
// ranges and non-HTTP schemes, so the refusal test proves the gate not the mock.
vi.mock('../../fetcher', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../fetcher')>();
  return {
    ...actual,
    isSafeUrl: async (url: string) => {
      try {
        const { protocol, hostname } = new URL(url);
        if (protocol !== 'http:' && protocol !== 'https:') return false;
        return !/^(localhost$|127\.|\[?::1\]?$|10\.|192\.168\.)/.test(hostname);
      } catch {
        return false;
      }
    },
  };
});

function entry(over: Record<string, unknown>): Record<string, unknown> {
  return {
    identifier: 'urn:air:example.com:server:s',
    displayName: 'Service',
    type: 'application/mcp-server-card+json',
    ...over,
  };
}

function manifest(entries: Record<string, unknown>[]): string {
  return JSON.stringify({
    specVersion: '1.0',
    host: { displayName: 'Example' },
    entries,
  });
}

function ctxWith(entries: Record<string, unknown>[]) {
  return mockCheckContext([], {
    '/.well-known/ai-catalog.json': mockFetchResult(
      manifest(entries),
      200,
      'application/ai-catalog+json',
    ),
  });
}

function responder(byUrl: (url: string) => number) {
  return async ({ url }: { url: string }): Promise<FetchResult> => {
    const r = mockFetchResult('', byUrl(url));
    r.url = url;
    return r;
  };
}

describe('AiCatalogUrlsAudit', () => {
  const audit = new AiCatalogUrlsAudit();

  it('passes when every entry url is reachable', async () => {
    const ctx = ctxWith([
      entry({ url: 'https://example.com/a' }),
      entry({ url: 'https://example.com/b' }),
    ]);
    ctx.fetch = responder(() => 200);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.found).toContain('2/2');
  });

  it('skips entries that embed the artifact inline instead of linking it', async () => {
    const ctx = ctxWith([
      entry({ url: 'https://example.com/a' }),
      entry({ displayName: 'Inline', data: { name: 'inline-card' } }),
    ]);
    ctx.fetch = responder(() => 200);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.found).toContain('1/1');
    expect(result.message).toContain('inline');
  });

  // ── auth-gated and method-restricted endpoints are reachable, not broken ──

  it.each([301, 302, 401, 403, 405, 204])('treats HTTP %i as reachable', async (status) => {
    const ctx = ctxWith([entry({ url: 'https://example.com/a' })]);
    ctx.fetch = responder(() => status);
    expect((await audit.audit(ctx)).status).toBe('pass');
  });

  it.each([404, 410, 500, 0])('treats HTTP %i as broken', async (status) => {
    const ctx = ctxWith([entry({ url: 'https://example.com/a' })]);
    ctx.fetch = responder(() => status);
    expect((await audit.audit(ctx)).status).toBe('fail');
  });

  it('warns when only some entry urls are reachable', async () => {
    const ctx = ctxWith([
      entry({ url: 'https://example.com/ok' }),
      entry({ url: 'https://example.com/gone' }),
    ]);
    ctx.fetch = responder((url) => (url.includes('/ok') ? 200 : 404));
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.found).toContain('1/2');
  });

  it('counts a thrown fetch as unreachable', async () => {
    const ctx = ctxWith([entry({ url: 'https://example.com/a' })]);
    ctx.fetch = async () => {
      throw new Error('network error');
    };
    expect((await audit.audit(ctx)).status).toBe('fail');
  });

  it('resolves a relative entry url against the site base url', async () => {
    const ctx = ctxWith([entry({ url: '/api/search' })]);
    const seen: string[] = [];
    ctx.fetch = async ({ url }) => {
      seen.push(url);
      return mockFetchResult('', 200);
    };
    const result = await audit.audit(ctx);
    expect(seen).toEqual(['https://example.com/api/search']);
    expect(result.status).toBe('pass');
  });

  it('refuses to probe an unsafe url and never fetches it', async () => {
    const ctx = ctxWith([entry({ url: 'http://127.0.0.1:8080/admin' })]);
    const seen: string[] = [];
    ctx.fetch = async ({ url }) => {
      seen.push(url);
      return mockFetchResult('', 200);
    };
    const result = await audit.audit(ctx);
    expect(seen).toEqual([]);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('not safe to probe');
  });

  it('caps how many probes run at once', async () => {
    const entries = Array.from({ length: 12 }, (_, i) =>
      entry({ url: `https://example.com/e${i}` }),
    );
    const ctx = ctxWith(entries);
    let inFlight = 0;
    let peak = 0;
    ctx.fetch = async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight -= 1;
      return mockFetchResult('', 200);
    };
    await audit.audit(ctx);
    expect(peak).toBeLessThanOrEqual(5);
  });

  it('bounds the list of broken urls in the message', async () => {
    const entries = Array.from({ length: 30 }, (_, i) =>
      entry({ url: `https://example.com/very/long/broken/path/number/${i}` }),
    );
    const ctx = ctxWith(entries);
    ctx.fetch = responder(() => 404);
    const result = await audit.audit(ctx);
    expect((result.message ?? '').length).toBeLessThan(600);
    expect(result.message).toContain('more');
  });

  // ── no second zero for a file ai-catalog-exists already scores ──

  it('is not applicable when no manifest is served', async () => {
    expect((await audit.audit(mockCheckContext([], {}))).status).toBe('na');
  });

  it('is not applicable when the served file is not an ARD manifest', async () => {
    const ctx = mockCheckContext([], {
      '/.well-known/ai-catalog.json': mockFetchResult(
        JSON.stringify({ services: [{ url: 'https://example.com/a' }] }),
        200,
        'application/json',
      ),
    });
    expect((await audit.audit(ctx)).status).toBe('na');
  });

  it('is not applicable when every entry is inline and there is nothing to probe', async () => {
    const ctx = ctxWith([entry({ data: { name: 'inline' } })]);
    expect((await audit.audit(ctx)).status).toBe('na');
  });

  it('ships guidance about entries[].url, not a services array', () => {
    const code = AiCatalogUrlsAudit.meta.guidance?.code ?? '';
    expect(code).toContain('entries');
    expect(code).not.toContain('services');
  });
});
