import { describe, it, expect } from 'vitest';
import { NoOrphanPagesAudit } from './no-orphan-pages';
import { mockCheckContext, mockPageContext, mockFetchResult } from '../../__tests__/test-utils';

const sitemap = (locs: string[]) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locs
    .map((l) => `<url><loc>${l}</loc></url>`)
    .join('')}</urlset>`;

describe('NoOrphanPagesAudit', () => {
  const audit = new NoOrphanPagesAudit();

  it('passes when all scanned pages appear in the sitemap', () => {
    const ctx = mockCheckContext(
      [mockPageContext('https://example.com/about', '<html><body>About</body></html>')],
      { '/sitemap.xml': mockFetchResult(sitemap(['https://example.com/about']), 200, 'application/xml') },
    );
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('in the sitemap or llms.txt');
  });

  it('passes when pages are covered by llms.txt links', () => {
    const ctx = mockCheckContext(
      [mockPageContext('https://example.com/about', '<html><body>About</body></html>')],
      {
        '/llms.txt': mockFetchResult(
          '# Site\n\n## Pages\n- [About](https://example.com/about): About page',
          200,
        ),
      },
    );
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('fails when a scanned page is not in the sitemap or llms.txt', () => {
    const ctx = mockCheckContext(
      [mockPageContext('https://example.com/orphan', '<html><body>Orphan</body></html>')],
      { '/sitemap.xml': mockFetchResult(sitemap(['https://example.com/about']), 200, 'application/xml') },
    );
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('not found in sitemap or llms.txt');
  });

  it('warns when there is no sitemap or llms.txt to compare against', () => {
    const ctx = mockCheckContext([
      mockPageContext('https://example.com/', '<html><body>Home</body></html>'),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('No sitemap or llms.txt links');
  });

  it('uses sitemap-index.xml when sitemap.xml is absent (covers line 17 getSitemapResult fallback)', () => {
    const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/about</loc></url></urlset>`;
    const ctx = mockCheckContext(
      [mockPageContext('https://example.com/about', '<html><body>About</body></html>')],
      { '/sitemap-index.xml': mockFetchResult(sitemapIndex, 200, 'application/xml') },
    );
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('skips malformed URLs in llms.txt (catch branch at line 50)', () => {
    // http://[invalid has unclosed IPv6 bracket → new URL throws → catch fires
    const llmsTxtBody =
      '# Site\n\n## Pages\n' +
      '- [Bad](http://[invalid): Malformed URL\n' +
      '- [About](https://example.com/about): About page';
    const ctx = mockCheckContext(
      [mockPageContext('https://example.com/about', '<html><body>About</body></html>')],
      { '/llms.txt': mockFetchResult(llmsTxtBody, 200) },
    );
    const result = audit.audit(ctx);
    // Malformed URL skipped; valid URL covers /about → no orphans
    expect(result.status).toBe('pass');
  });

  it('skips empty <loc> entries in the sitemap (false branch of if(loc))', () => {
    // sitemap has one entry with empty loc → loc.trim() = '' → if(loc) is false → sitemapUrls stays empty
    // sitemap also has the valid URL for the scanned page so it passes
    const sitemapBody =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      '<url><loc></loc></url>' +
      '<url><loc>https://example.com/about</loc></url>' +
      '</urlset>';
    const ctx = mockCheckContext(
      [mockPageContext('https://example.com/about', '<html><body>About</body></html>')],
      { '/sitemap.xml': mockFetchResult(sitemapBody, 200, 'application/xml') },
    );
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('shows "+N more" suffix when more than 5 pages are orphans', () => {
    // Sitemap has 1 URL; 6 scanned pages are orphans → fail path with +more
    const sitemapBody = sitemap(['https://example.com/in-sitemap']);
    const orphanPages = Array.from({ length: 6 }, (_, i) =>
      mockPageContext(`https://example.com/orphan${i + 1}`, '<html><body>Orphan</body></html>', i),
    );
    const ctx = mockCheckContext(orphanPages, {
      '/sitemap.xml': mockFetchResult(sitemapBody, 200, 'application/xml'),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toContain('+1 more');
  });
});
