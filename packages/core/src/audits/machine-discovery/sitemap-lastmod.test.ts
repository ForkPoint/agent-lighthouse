import { describe, it, expect } from 'vitest';
import { SitemapLastmodAudit } from './sitemap-lastmod';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

/** Build a sitemap; each entry is a [loc, hasLastmod] tuple. */
const sitemap = (entries: Array<[string, boolean]>) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries
    .map(
      ([loc, hasMod]) =>
        `<url><loc>${loc}</loc>${hasMod ? '<lastmod>2026-01-01</lastmod>' : ''}</url>`,
    )
    .join('')}</urlset>`;

describe('SitemapLastmodAudit', () => {
  const audit = new SitemapLastmodAudit();

  it('passes when at least 80% of entries have <lastmod>', async () => {
    const ctx = mockCheckContext([], {
      '/sitemap.xml': mockFetchResult(
        sitemap([
          ['https://example.com/a', true],
          ['https://example.com/b', true],
          ['https://example.com/c', true],
          ['https://example.com/d', true],
          ['https://example.com/e', false],
        ]),
        200,
        'application/xml',
      ),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('have <lastmod>');
  });

  it('fails when fewer than 80% of entries have <lastmod>', async () => {
    const ctx = mockCheckContext([], {
      '/sitemap.xml': mockFetchResult(
        sitemap([
          ['https://example.com/a', true],
          ['https://example.com/b', false],
          ['https://example.com/c', false],
        ]),
        200,
        'application/xml',
      ),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('of URL entries have <lastmod>');
  });

  it('declines when the sitemap has no <url> entries', async () => {
    const ctx = mockCheckContext([], {
      '/sitemap.xml': mockFetchResult(sitemap([]), 200, 'application/xml'),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('na');
  });

  it('declines when no sitemap is found', async () => {
    const ctx = mockCheckContext([]);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('na');
  });

  it('uses sitemap-index.xml as fallback when sitemap.xml is absent (covers line 16 branch)', async () => {
    const ctx = mockCheckContext([], {
      '/sitemap-index.xml': mockFetchResult(
        sitemap([
          ['https://example.com/a', true],
          ['https://example.com/b', true],
        ]),
        200,
        'application/xml',
      ),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
  });
});

