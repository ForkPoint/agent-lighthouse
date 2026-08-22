import { describe, it, expect, vi } from 'vitest';
import { SitemapLastmodVerifiabilityAudit } from './sitemap-lastmod-verifiability';
import { mockPageContext, mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';
import { expectNotApplicableOnEmpty } from '../../tests/na-contract';
import type { FetchOptions, FetchResult } from '../../fetcher';

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

const DAY = 86_400_000;
/** An ISO timestamp `daysAgo` days before now, so every case moves with the clock. */
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString();

interface PageSpec {
  /** JSON-LD dateModified, if the page publishes one. */
  dateModified?: string;
  /** The Last-Modified response header, if the server sends one. */
  lastModified?: string;
  /** <meta property="article:modified_time">, if the page carries one. */
  metaModified?: string;
}

function html(spec: PageSpec): string {
  const jsonLd = spec.dateModified
    ? `<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: 'A post',
        dateModified: spec.dateModified,
      })}</script>`
    : '';
  const meta = spec.metaModified
    ? `<meta property="article:modified_time" content="${spec.metaModified}">`
    : '';
  return `<html><head>${jsonLd}${meta}</head><body><main><p>Copy.</p></main></body></html>`;
}

function run(urls: Array<{ loc: string; lastmod?: string } & PageSpec>, serveSitemap = true) {
  const audit = new SitemapLastmodVerifiabilityAudit();
  const ctx = mockCheckContext([
    mockPageContext('https://example.com/', '<html><body><main><p>Home.</p></main></body></html>'),
  ]);
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls
    .map(
      (u) =>
        `<url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`,
    )
    .join('')}</urlset>`;

  ctx.fetch = async (o: FetchOptions): Promise<FetchResult> => {
    if (new URL(o.url).pathname === '/sitemap.xml') {
      return serveSitemap
        ? mockFetchResult(xml, 200, 'application/xml')
        : mockFetchResult('', 404);
    }
    const spec = urls.find((u) => u.loc === o.url);
    if (!spec) return mockFetchResult('', 404);
    const result = mockFetchResult(html(spec), 200, 'text/html');
    if (spec.lastModified) result.headers['last-modified'] = spec.lastModified;
    return result;
  };
  return audit.audit(ctx);
}

/** n URLs whose lastmod matches the page's own dateModified exactly. */
function consistent(n: number) {
  return Array.from({ length: n }, (_v, i) => ({
    loc: `https://example.com/post-${i}`,
    lastmod: iso(10 + i * 7),
    dateModified: iso(10 + i * 7),
  }));
}

describe('SitemapLastmodVerifiabilityAudit', () => {
  const audit = new SitemapLastmodVerifiabilityAudit();

  it('is notApplicable on an empty site', async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it('is notApplicable when no sitemap responds', async () => {
    expect((await run(consistent(3), false)).status).toBe('na');
  });

  // Presence is machine-discovery/sitemap-lastmod's question; this audit only
  // asks whether the values that exist are true.
  it('is notApplicable when the sitemap carries no lastmod at all', async () => {
    const result = await run([{ loc: 'https://example.com/a' }, { loc: 'https://example.com/b' }]);
    expect(result.status).toBe('na');
  });

  it('passes when every lastmod matches the page dateModified', async () => {
    const result = await run(consistent(5));
    expect(result.status).toBe('pass');
  });

  it('accepts the Last-Modified response header as the corroborating signal', async () => {
    const result = await run(
      Array.from({ length: 4 }, (_v, i) => ({
        loc: `https://example.com/h-${i}`,
        lastmod: iso(20 + i * 9),
        lastModified: new Date(Date.now() - (20 + i * 9) * DAY).toUTCString(),
      })),
    );
    expect(result.status).toBe('pass');
  });

  it('accepts article:modified_time as the corroborating signal', async () => {
    const result = await run(
      Array.from({ length: 4 }, (_v, i) => ({
        loc: `https://example.com/m-${i}`,
        lastmod: iso(20 + i * 9),
        metaModified: iso(20 + i * 9),
      })),
    );
    expect(result.status).toBe('pass');
  });

  it('fails on a future-dated lastmod', async () => {
    const urls = consistent(4);
    urls[0]!.lastmod = new Date(Date.now() + 30 * DAY).toISOString();
    const result = await run(urls);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('future');
  });

  it('reports a lastmod that is not a W3C Datetime as malformed', async () => {
    const urls = consistent(4);
    urls[0]!.lastmod = '20 June 2026';
    const result = await run(urls);
    expect(result.message).toContain('malformed');
    expect(result.status).toBe('warn');
  });

  // One value on nearly every URL, stamped at deploy time, is a build date
  // rather than a content date.
  it('fails when one recent lastmod value covers over 90% of sampled URLs', async () => {
    const stamp = iso(1);
    const urls = Array.from({ length: 10 }, (_v, i) => ({
      loc: `https://example.com/d-${i}`,
      lastmod: stamp,
      dateModified: stamp,
    }));
    const result = await run(urls);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('build stamp');
  });

  it('fails when over 20% of sampled URLs diverge from every page signal by more than 7 days', async () => {
    const urls = Array.from({ length: 5 }, (_v, i) => ({
      loc: `https://example.com/x-${i}`,
      lastmod: iso(1 + i * 3),
      dateModified: iso(200 + i * 3),
    }));
    const result = await run(urls);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('7 days');
  });

  // Nothing to compare against is a missing-signal problem on the page, not a
  // false lastmod, so it must not be scored as one.
  it('reports URLs with no page-level signal as a separate sub-finding', async () => {
    const urls = Array.from({ length: 4 }, (_v, i) => ({
      loc: `https://example.com/n-${i}`,
      lastmod: iso(10 + i * 9),
    }));
    const result = await run(urls);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('dateModified');
  });

  it('reports how many URLs it sampled and how many it corroborated', async () => {
    const result = await run(consistent(5));
    expect(result.found).toContain('5 sampled URL');
  });
});
