import { describe, it, expect, vi } from 'vitest';
import { fetchSampledPage } from './sampled-pages';
import { mockFetchResult } from '../__tests__/test-utils';
import type { FetchOptions, FetchResult } from '../fetcher';

vi.mock('../fetcher', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../fetcher')>();
  return {
    ...actual,
    isSafeUrl: async (url: string) => new URL(url).hostname !== 'localhost',
  };
});

function ctxWithCounter(status = 200) {
  const calls: string[] = [];
  const ctx = {
    calls,
    fetch: async (o: FetchOptions): Promise<FetchResult> => {
      calls.push(o.url);
      return mockFetchResult('<html></html>', status, 'text/html');
    },
  };
  return ctx;
}

describe('fetchSampledPage', () => {
  // Three audits sample the same sitemap; without the cache the same document
  // is pulled once per audit.
  it('fetches one URL once per scan', async () => {
    const ctx = ctxWithCounter();
    const a = await fetchSampledPage(ctx, 'https://example.com/a');
    const b = await fetchSampledPage(ctx, 'https://example.com/a');
    expect(a).toBe(b);
    expect(ctx.calls).toEqual(['https://example.com/a']);
  });

  it('does not share its cache between two scans', async () => {
    const first = ctxWithCounter();
    const second = ctxWithCounter();
    await fetchSampledPage(first, 'https://example.com/a');
    await fetchSampledPage(second, 'https://example.com/a');
    expect(first.calls).toHaveLength(1);
    expect(second.calls).toHaveLength(1);
  });

  it('returns undefined for a non-200 response', async () => {
    expect(await fetchSampledPage(ctxWithCounter(404), 'https://example.com/a')).toBeUndefined();
  });

  it('never fetches a URL that fails the SSRF gate', async () => {
    const ctx = ctxWithCounter();
    expect(await fetchSampledPage(ctx, 'https://localhost/a')).toBeUndefined();
    expect(ctx.calls).toEqual([]);
  });
});
