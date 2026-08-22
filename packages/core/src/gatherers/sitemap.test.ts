import { describe, it, expect, vi } from 'vitest';
import { collectSitemapEntries, sampleEntries, isW3CDateTime } from './sitemap';
import { mockFetchResult } from '../__tests__/test-utils';
import type { FetchOptions } from '../fetcher';

// isSafeUrl performs a real DNS lookup before the gatherer follows a URL it
// read out of a site-controlled sitemap. Stub it with an offline stand-in that
// still blocks loopback and private ranges, so the refusal tests prove the gate
// rather than the mock.
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

const xml = (body: string) => mockFetchResult(body, 200, 'application/xml');

const urlset = (urls: Array<[string, string?]>) =>
  xml(
    `<?xml version="1.0"?><urlset>${urls
      .map(
        ([loc, lastmod]) =>
          `<url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`,
      )
      .join('')}</urlset>`,
  );

const index = (locs: string[]) =>
  xml(
    `<?xml version="1.0"?><sitemapindex>${locs
      .map((loc) => `<sitemap><loc>${loc}</loc></sitemap>`)
      .join('')}</sitemapindex>`,
  );

function fetcher(pages: Record<string, ReturnType<typeof xml>>) {
  const seen: string[] = [];
  return {
    seen,
    fetch: async (o: FetchOptions) => {
      seen.push(o.url);
      return pages[o.url] ?? mockFetchResult('', 404);
    },
  };
}

describe('collectSitemapEntries', () => {
  it('reads loc and lastmod out of a flat urlset', async () => {
    const f = fetcher({
      'https://a.test/sitemap.xml': urlset([
        ['https://a.test/one', '2026-08-01'],
        ['https://a.test/two'],
      ]),
    });
    const tree = await collectSitemapEntries(f.fetch, ['https://a.test/sitemap.xml']);
    expect(tree.entries).toEqual([
      { loc: 'https://a.test/one', lastmod: '2026-08-01' },
      { loc: 'https://a.test/two' },
    ]);
    expect(tree.childSitemaps).toEqual([]);
    expect(f.seen).toEqual(['https://a.test/sitemap.xml']);
  });

  // One level only. A sitemapindex nested inside a child is a shape whose depth
  // the scanned site controls, so recursion stops rather than trusting the file
  // to terminate.
  it('recurses a sitemapindex exactly one level', async () => {
    const f = fetcher({
      'https://a.test/sitemap.xml': index(['https://a.test/c1.xml', 'https://a.test/c2.xml']),
      'https://a.test/c1.xml': urlset([['https://a.test/one']]),
      'https://a.test/c2.xml': index(['https://a.test/deep.xml']),
    });
    const tree = await collectSitemapEntries(f.fetch, ['https://a.test/sitemap.xml']);
    expect(tree.entries).toEqual([{ loc: 'https://a.test/one' }]);
    expect(f.seen).not.toContain('https://a.test/deep.xml');
  });

  it('caps child sitemaps at maxChildren and reports truncated', async () => {
    const children = Array.from({ length: 8 }, (_, i) => `https://a.test/c${i}.xml`);
    const pages: Record<string, ReturnType<typeof xml>> = {
      'https://a.test/sitemap.xml': index(children),
    };
    for (const c of children) pages[c] = urlset([[`${c}#u`]]);
    const f = fetcher(pages);
    const tree = await collectSitemapEntries(f.fetch, ['https://a.test/sitemap.xml'], {
      maxChildren: 5,
    });
    expect(tree.childSitemaps).toHaveLength(5);
    expect(tree.truncated).toBe(true);
  });

  it('caps total entries at maxEntries and reports truncated', async () => {
    const urls: Array<[string, string?]> = Array.from(
      { length: 20 },
      (_, i) => [`https://a.test/${i}`] as [string],
    );
    const f = fetcher({ 'https://a.test/sitemap.xml': urlset(urls) });
    const tree = await collectSitemapEntries(f.fetch, ['https://a.test/sitemap.xml'], {
      maxEntries: 6,
    });
    expect(tree.entries).toHaveLength(6);
    expect(tree.truncated).toBe(true);
  });

  it('counts lastmod values that are not W3C Datetime', async () => {
    const f = fetcher({
      'https://a.test/sitemap.xml': urlset([
        ['https://a.test/one', 'yesterday'],
        ['https://a.test/two', '2026-08-01'],
      ]),
    });
    const tree = await collectSitemapEntries(f.fetch, ['https://a.test/sitemap.xml']);
    expect(tree.malformedLastmod).toBe(1);
  });

  it('skips a child sitemap on a different host', async () => {
    const f = fetcher({
      'https://a.test/sitemap.xml': index(['https://evil.test/c.xml']),
    });
    const tree = await collectSitemapEntries(f.fetch, ['https://a.test/sitemap.xml']);
    expect(f.seen).toEqual(['https://a.test/sitemap.xml']);
    expect(tree.entries).toEqual([]);
  });

  it('deduplicates a root listed twice', async () => {
    const f = fetcher({ 'https://a.test/s.xml': urlset([['https://a.test/one']]) });
    const tree = await collectSitemapEntries(f.fetch, [
      'https://a.test/s.xml',
      'https://a.test/s.xml',
    ]);
    expect(f.seen).toEqual(['https://a.test/s.xml']);
    expect(tree.entries).toEqual([{ loc: 'https://a.test/one' }]);
  });

  it('returns an empty tree when every root 404s', async () => {
    const f = fetcher({});
    const tree = await collectSitemapEntries(f.fetch, ['https://a.test/sitemap.xml']);
    expect(tree.entries).toEqual([]);
    expect(tree.truncated).toBe(false);
  });

  it('ignores a body that is not a sitemap', async () => {
    const f = fetcher({
      'https://a.test/sitemap.xml': mockFetchResult('<html><body>hi</body></html>', 200, 'text/html'),
    });
    const tree = await collectSitemapEntries(f.fetch, ['https://a.test/sitemap.xml']);
    expect(tree.entries).toEqual([]);
  });
});

describe('sampleEntries', () => {
  it('returns every entry when n exceeds the population', () => {
    const entries = [{ loc: 'https://a.test/0' }, { loc: 'https://a.test/1' }];
    expect(sampleEntries(entries, 10)).toEqual(entries);
  });

  // Deterministic on purpose: two audits sampling the same tree must probe the
  // same URLs, or their findings cannot be compared against each other.
  it('is deterministic and evenly strided', () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({ loc: `https://a.test/${i}` }));
    expect(sampleEntries(entries, 5).map((e) => e.loc)).toEqual([
      'https://a.test/0',
      'https://a.test/2',
      'https://a.test/4',
      'https://a.test/6',
      'https://a.test/8',
    ]);
  });

  it('returns nothing for a non-positive n', () => {
    expect(sampleEntries([{ loc: 'https://a.test/0' }], 0)).toEqual([]);
  });
});

describe('isW3CDateTime', () => {
  it('accepts YYYY-MM-DD and full RFC 3339', () => {
    expect(isW3CDateTime('2026-08-22')).toBe(true);
    expect(isW3CDateTime('2026-08-22T10:30:00+02:00')).toBe(true);
    expect(isW3CDateTime('2026-08-22T10:30:00Z')).toBe(true);
  });

  it('rejects prose, epoch seconds and impossible dates', () => {
    expect(isW3CDateTime('yesterday')).toBe(false);
    expect(isW3CDateTime('1755859200')).toBe(false);
    expect(isW3CDateTime('2026-13-01')).toBe(false);
    expect(isW3CDateTime('')).toBe(false);
  });
});
