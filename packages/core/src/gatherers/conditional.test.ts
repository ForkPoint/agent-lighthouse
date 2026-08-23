import { describe, it, expect, vi } from 'vitest';
import { sharedRevalidation } from './conditional';
import { mockFetchResult } from '../__tests__/test-utils';
import type { FetchOptions, FetchResult } from '../fetcher';

vi.mock('../fetcher', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../fetcher')>();
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

const URL_UNDER_TEST = 'https://example.com/sitemap.xml';

/** A fetcher whose answers are scripted per request, in order. */
function scripted(responses: Array<(options: FetchOptions) => FetchResult>) {
  const seen: FetchOptions[] = [];
  let index = 0;
  const ctx = {
    fetch: async (options: FetchOptions): Promise<FetchResult> => {
      seen.push(options);
      const next = responses[Math.min(index, responses.length - 1)]!;
      index += 1;
      return next(options);
    },
  };
  return { ctx, seen };
}

const body = (headers: Record<string, string>, text = '<urlset/>') => {
  const result = mockFetchResult(text, 200, 'application/xml');
  Object.assign(result.headers, headers);
  return result;
};

const notModified = () => mockFetchResult('', 304, 'application/xml');

describe('sharedRevalidation', () => {
  it('reports both validators honoured, in four requests', async () => {
    const { ctx, seen } = scripted([
      () => body({ etag: '"v1"', 'last-modified': 'Wed, 20 Aug 2026 10:00:00 GMT' }),
      () => body({ etag: '"v1"', 'last-modified': 'Wed, 20 Aug 2026 10:00:00 GMT' }),
      () => notModified(),
      () => notModified(),
    ]);
    const result = await sharedRevalidation(ctx, URL_UNDER_TEST);
    expect(result?.honoursIfNoneMatch).toBe(true);
    expect(result?.honoursIfModifiedSince).toBe(true);
    expect(result?.etagStable).toBe(true);
    expect(result?.bodyStable).toBe(true);
    expect(result?.requests).toBe(4);
    expect(seen).toHaveLength(4);
    expect(seen[2]?.headers?.['If-None-Match']).toBe('"v1"');
    expect(seen[3]?.headers?.['If-Modified-Since']).toBe('Wed, 20 Aug 2026 10:00:00 GMT');
  });

  it('reports an unstable validator when the body is identical but the ETag moved', async () => {
    const { ctx } = scripted([
      () => body({ etag: '"a"' }),
      () => body({ etag: '"b"' }),
      () => notModified(),
    ]);
    const result = await sharedRevalidation(ctx, URL_UNDER_TEST);
    expect(result?.bodyStable).toBe(true);
    expect(result?.etagStable).toBe(false);
  });

  it('reports a 200 answer to a conditional request as not honoured', async () => {
    const { ctx } = scripted([
      () => body({ etag: '"v1"' }),
      () => body({ etag: '"v1"' }),
      () => body({ etag: '"v1"' }),
    ]);
    const result = await sharedRevalidation(ctx, URL_UNDER_TEST);
    expect(result?.honoursIfNoneMatch).toBe(false);
  });

  it('asks nothing it cannot ask, and says so', async () => {
    const { ctx, seen } = scripted([() => body({}), () => body({})]);
    const result = await sharedRevalidation(ctx, URL_UNDER_TEST);
    expect(result?.honoursIfNoneMatch).toBeUndefined();
    expect(result?.honoursIfModifiedSince).toBeUndefined();
    expect(seen).toHaveLength(2);
    expect(result?.bytes).toBe('<urlset/>'.length);
  });

  it('probes one URL once per scan', async () => {
    const { ctx, seen } = scripted([() => body({ etag: '"v1"' }), () => body({ etag: '"v1"' }), () => notModified()]);
    await Promise.all([sharedRevalidation(ctx, URL_UNDER_TEST), sharedRevalidation(ctx, URL_UNDER_TEST)]);
    expect(seen).toHaveLength(3);
  });

  it('returns undefined for a URL the safety gate rejects, and for a non-2xx surface', async () => {
    const { ctx, seen } = scripted([() => mockFetchResult('', 404, 'text/plain')]);
    expect(await sharedRevalidation(ctx, 'http://127.0.0.1/sitemap.xml')).toBeUndefined();
    expect(seen).toHaveLength(0);
    expect(await sharedRevalidation(ctx, URL_UNDER_TEST)).toBeUndefined();
    expect(seen).toHaveLength(1);
  });
});
