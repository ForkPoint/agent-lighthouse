import { describe, it, expect, vi } from 'vitest';
import { DiscoveryIndexCoverageAudit } from './discovery-index-coverage';
import { mockCheckContext, mockPageContext, mockFetchResult } from '../../__tests__/test-utils';
import type { CheckContext } from '../../check-context';

const sitemap = (locs: string[]) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locs
    .map((l) => `<url><loc>${l}</loc></url>`)
    .join('')}</urlset>`;

const sitemapIndex = (locs: string[]) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locs
    .map((l) => `<sitemap><loc>${l}</loc></sitemap>`)
    .join('')}</sitemapindex>`;

const page = (url: string, index = 0) =>
  mockPageContext(url, '<html><body>Page</body></html>', index);

describe('DiscoveryIndexCoverageAudit', () => {
  const audit = new DiscoveryIndexCoverageAudit();

  it('passes when all scanned pages are in the sitemap', async () => {
    const ctx = mockCheckContext([page('https://example.com/about')], {
      '/sitemap.xml': mockFetchResult(sitemap(['https://example.com/about']), 200, 'application/xml'),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('covered by a discovery index');
  });

  // Ported from no-orphan-pages: llms.txt is the second discovery index.
  it('passes when a page is listed only in llms.txt', async () => {
    const ctx = mockCheckContext([page('https://example.com/about')], {
      '/llms.txt': mockFetchResult(
        '# Site\n\n## Pages\n- [About](https://example.com/about): About page',
        200,
      ),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  // Review finding (1.22): extractMarkdownLinks drops relative URLs, so the
  // llms.txt half of the comparison was empty for any site using them.
  it('resolves relative llms.txt links against the base URL', async () => {
    const ctx = mockCheckContext([page('https://example.com/about')], {
      '/llms.txt': mockFetchResult('# Site\n\n## Pages\n- [About](/about): About page', 200),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('skips malformed llms.txt links', async () => {
    const body =
      '# Site\n\n## Pages\n- [Bad](http://[invalid): Malformed\n- [About](https://example.com/about): About';
    const ctx = mockCheckContext([page('https://example.com/about')], {
      '/llms.txt': mockFetchResult(body, 200),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('fails when a majority of scanned pages are in no index', async () => {
    const ctx = mockCheckContext([page('https://example.com/orphan')], {
      '/sitemap.xml': mockFetchResult(sitemap(['https://example.com/about']), 200, 'application/xml'),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('in no discovery index');
  });

  it('warns when a minority of scanned pages are in no index', async () => {
    const ctx = mockCheckContext(
      [page('https://example.com/about'), page('https://example.com/orphan', 1)],
      {
        '/sitemap.xml': mockFetchResult(
          sitemap(['https://example.com/about']),
          200,
          'application/xml',
        ),
      },
    );
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('in no discovery index');
  });

  it('lists at most five uncovered pages with a "+N more" suffix', async () => {
    const pages = Array.from({ length: 6 }, (_, i) => page(`https://example.com/orphan${i + 1}`, i));
    const ctx = mockCheckContext(pages, {
      '/sitemap.xml': mockFetchResult(
        sitemap(['https://example.com/listed']),
        200,
        'application/xml',
      ),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toContain('+1 more');
  });

  // Review finding (1.8): a <sitemapindex> short-circuited to an unconditional
  // pass without reading a single URL — a vacuous pass on the most common real
  // configuration. Review finding (1.22): the Shopify-only filename heuristic
  // reported every page of a Yoast/Next.js site as an orphan.
  it('fetches sub-sitemaps from a sitemap index instead of passing vacuously', async () => {
    const ctx: CheckContext = {
      ...mockCheckContext([page('https://example.com/about')], {
        '/sitemap.xml': mockFetchResult(
          sitemapIndex(['https://example.com/post-sitemap.xml']),
          200,
          'application/xml',
        ),
      }),
      fetch: vi.fn(async () =>
        mockFetchResult(sitemap(['https://example.com/about']), 200, 'application/xml'),
      ),
    };
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(ctx.fetch).toHaveBeenCalledTimes(1);
  });

  it('reports pages that no sub-sitemap of the index lists', async () => {
    const ctx: CheckContext = {
      ...mockCheckContext([page('https://example.com/orphan')], {
        '/sitemap.xml': mockFetchResult(
          sitemapIndex(['https://example.com/post-sitemap.xml']),
          200,
          'application/xml',
        ),
      }),
      fetch: async () =>
        mockFetchResult(sitemap(['https://example.com/about']), 200, 'application/xml'),
    };
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('in no discovery index');
  });

  it('caps sub-sitemap fetches at ten', async () => {
    const subs = Array.from({ length: 25 }, (_, i) => `https://example.com/sitemap-${i}.xml`);
    const fetch = vi.fn(async () => mockFetchResult(sitemap([]), 200, 'application/xml'));
    const ctx: CheckContext = {
      ...mockCheckContext([page('https://example.com/about')], {
        '/sitemap.xml': mockFetchResult(sitemapIndex(subs), 200, 'application/xml'),
      }),
      fetch,
    };
    await audit.audit(ctx);
    expect(fetch).toHaveBeenCalledTimes(10);
  });

  // Review finding (1.8 + 1.22): raw string equality over trailing-slash
  // variants only, so protocol/host/case/encoding differences produced phantom
  // "missing" pages.
  it('matches across protocol, www, trailing slash, case and query differences', async () => {
    const ctx = mockCheckContext([page('https://www.example.com/About/?utm_source=x')], {
      '/sitemap.xml': mockFetchResult(
        sitemap(['http://example.com/about']),
        200,
        'application/xml',
      ),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('falls back to sitemap-index.xml when sitemap.xml is absent', async () => {
    const ctx = mockCheckContext([page('https://example.com/about')], {
      '/sitemap-index.xml': mockFetchResult(
        sitemap(['https://example.com/about']),
        200,
        'application/xml',
      ),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  // The absent-sitemap failure belongs to sitemap-exists (1.7); levying it here
  // too charged one missing file twice.
  it('warns rather than fails when neither index exists', async () => {
    const ctx = mockCheckContext([page('https://example.com/')]);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('No sitemap URLs or llms.txt links');
  });

  it('warns when the sitemap carries no <loc> entries at all', async () => {
    const ctx = mockCheckContext([page('https://example.com/about')], {
      '/sitemap.xml': mockFetchResult(sitemap([]), 200, 'application/xml'),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('No sitemap URLs or llms.txt links');
  });

  it('skips empty <loc> entries', async () => {
    const body =
      '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      '<url><loc></loc></url><url><loc>https://example.com/about</loc></url></urlset>';
    const ctx = mockCheckContext([page('https://example.com/about')], {
      '/sitemap.xml': mockFetchResult(body, 200, 'application/xml'),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('reports no pages to check when the scan found none', async () => {
    const ctx = mockCheckContext([], {
      '/sitemap.xml': mockFetchResult(sitemap(['https://example.com/about']), 200, 'application/xml'),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('na');
  });
});
