import { describe, it, expect } from 'vitest';
import { SitemapKeyPagesAudit } from './discovery-index-coverage';
import { mockCheckContext, mockPageContext, mockFetchResult } from '../../__tests__/test-utils';

const sitemap = (locs: string[]) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locs
    .map((l) => `<url><loc>${l}</loc></url>`)
    .join('')}</urlset>`;

describe('SitemapKeyPagesAudit', () => {
  const audit = new SitemapKeyPagesAudit();

  it('passes when all scanned pages are in the sitemap', () => {
    const ctx = mockCheckContext(
      [mockPageContext('https://example.com/about', '<html><body>About</body></html>')],
      { '/sitemap.xml': mockFetchResult(sitemap(['https://example.com/about']), 200, 'application/xml') },
    );
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('found in the sitemap');
  });

  it('fails when a majority of pages are missing from the sitemap', () => {
    const ctx = mockCheckContext(
      [mockPageContext('https://example.com/orphan', '<html><body>Orphan</body></html>')],
      { '/sitemap.xml': mockFetchResult(sitemap(['https://example.com/about']), 200, 'application/xml') },
    );
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('missing from sitemap');
  });

  it('warns when a minority of pages are missing from the sitemap', () => {
    const ctx = mockCheckContext(
      [
        mockPageContext('https://example.com/about', '<html><body>About</body></html>'),
        mockPageContext('https://example.com/orphan', '<html><body>Orphan</body></html>', 1),
      ],
      { '/sitemap.xml': mockFetchResult(sitemap(['https://example.com/about']), 200, 'application/xml') },
    );
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('missing from sitemap');
  });

  it('warns when the sitemap has no <url> entries', () => {
    const ctx = mockCheckContext(
      [mockPageContext('https://example.com/about', '<html><body>About</body></html>')],
      { '/sitemap.xml': mockFetchResult(sitemap([]), 200, 'application/xml') },
    );
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('no <url> entries');
  });

  it('fails when no sitemap is found', () => {
    const ctx = mockCheckContext([
      mockPageContext('https://example.com/', '<html><body>Home</body></html>'),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No sitemap found');
  });

  it('uses sitemap-index.xml as fallback when sitemap.xml is absent (covers line 16 branch)', () => {
    const ctx = mockCheckContext(
      [mockPageContext('https://example.com/about', '<html><body>About</body></html>')],
      {
        '/sitemap-index.xml': mockFetchResult(
          sitemap(['https://example.com/about']),
          200,
          'application/xml',
        ),
      },
    );
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('skips empty <loc> entries in the sitemap (covers if(loc) false branch)', () => {
    // An empty <loc></loc> makes loc = '' → if(loc) is false → sitemapUrls stays empty
    const body =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      '<url><loc></loc></url>' +
      '</urlset>';
    const ctx = mockCheckContext(
      [mockPageContext('https://example.com/about', '<html><body>About</body></html>')],
      { '/sitemap.xml': mockFetchResult(body, 200, 'application/xml') },
    );
    const result = audit.audit(ctx);
    // sitemapUrls is empty after skipping → warns (0 entries case)
    expect(result.status).toBe('warn');
  });

  it('shows "+N more" in fail path when more than 5 pages are missing (ratio > 0.5)', () => {
    // 10 scanned pages; 6 not in sitemap (ratio 60% > 50%) → fail with +more
    const inSitemap = Array.from({ length: 4 }, (_, i) => `https://example.com/p${i + 1}`);
    const allPages = [
      ...inSitemap.map((url, i) =>
        mockPageContext(url, '<html><body>Page</body></html>', i),
      ),
      ...Array.from({ length: 6 }, (_, i) =>
        mockPageContext(`https://example.com/missing${i + 1}`, '<html><body>Page</body></html>', i + 4),
      ),
    ];
    const ctx = mockCheckContext(allPages, {
      '/sitemap.xml': mockFetchResult(sitemap(inSitemap), 200, 'application/xml'),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toContain('+1 more');
  });

  it('shows "+N more" in warn path when more than 5 pages are missing (ratio <= 0.5)', () => {
    // 12 scanned pages; 6 not in sitemap (ratio 50% = 0.5, NOT > 0.5) → warn with +more
    const inSitemap = Array.from({ length: 6 }, (_, i) => `https://example.com/p${i + 1}`);
    const allPages = [
      ...inSitemap.map((url, i) =>
        mockPageContext(url, '<html><body>Page</body></html>', i),
      ),
      ...Array.from({ length: 6 }, (_, i) =>
        mockPageContext(`https://example.com/missing${i + 1}`, '<html><body>Page</body></html>', i + 6),
      ),
    ];
    const ctx = mockCheckContext(allPages, {
      '/sitemap.xml': mockFetchResult(sitemap(inSitemap), 200, 'application/xml'),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.found).toContain('+1 more');
  });
});
