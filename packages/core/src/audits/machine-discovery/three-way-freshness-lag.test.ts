import { describe, it, expect, vi } from 'vitest';
import { ThreeWayFreshnessLagAudit } from './three-way-freshness-lag';
import { mockPageContext, mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';
import { expectNotApplicableOnEmpty } from '../../tests/na-contract';
import type { FetchOptions, FetchResult } from '../../fetcher';
import type { AuditResult } from '../../types';

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

const strings = (result: AuditResult, key: string): string[] => (result.details?.[key] ?? []) as string[];

interface Site {
  /** JSON-LD dateModified on the homepage. Omitted means no page date. */
  pageDate?: string;
  /** `<lastmod>` values, one `<url>` each. Omitted means no sitemap. */
  lastmods?: string[];
  /** Item dates, in document order. Omitted means no feed. */
  itemDates?: string[];
  /** `<lastBuildDate>`. Defaults to the newest item date. */
  lastBuild?: string;
  /** Statuses for sitemap URLs, keyed by loc. */
  urlStatus?: Record<string, number>;
  /** Sitemap URLs whose page declares noindex. */
  noindex?: string[];
}

function run(site: Site) {
  const audit = new ThreeWayFreshnessLagAudit();
  const jsonLd =
    site.pageDate === undefined
      ? ''
      : `<script type="application/ld+json">${JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Article',
          dateModified: site.pageDate,
        })}</script>`;
  const feedLink =
    site.itemDates === undefined
      ? ''
      : '<link rel="alternate" type="application/rss+xml" href="/feed.xml">';
  const html = `<html><head>${feedLink}${jsonLd}</head><body><p>Home.</p></body></html>`;

  const locs = (site.lastmods ?? []).map((_v, i) => `https://example.com/post-${i}`);
  const sitemap = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${(
    site.lastmods ?? []
  )
    .map((lastmod, i) => `<url><loc>${locs[i]}</loc><lastmod>${lastmod}</lastmod></url>`)
    .join('')}</urlset>`;

  const items = (site.itemDates ?? [])
    .map(
      (date, i) =>
        `<item><title>P${i}</title><guid>https://example.com/f-${i}</guid><link>https://example.com/f-${i}</link><pubDate>${date}</pubDate></item>`,
    )
    .join('');
  const build = site.lastBuild ?? (site.itemDates ?? [])[0] ?? '';
  const feed = `<?xml version="1.0"?><rss version="2.0"><channel><title>Blog</title>${
    build === '' ? '' : `<lastBuildDate>${build}</lastBuildDate>`
  }${items}</channel></rss>`;

  const ctx = mockCheckContext([mockPageContext('https://example.com/', html)], {
    '/robots.txt': mockFetchResult('User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml\n', 200, 'text/plain'),
  });
  const requests: FetchOptions[] = [];

  ctx.fetch = async (o: FetchOptions): Promise<FetchResult> => {
    requests.push(o);
    const path = new URL(o.url).pathname;
    if (path === '/sitemap.xml') {
      return site.lastmods === undefined
        ? mockFetchResult('', 404, 'text/plain')
        : mockFetchResult(sitemap, 200, 'application/xml');
    }
    if (path === '/feed.xml') {
      return site.itemDates === undefined
        ? mockFetchResult('', 404, 'text/plain')
        : mockFetchResult(feed, 200, 'application/rss+xml');
    }
    const status = site.urlStatus?.[o.url] ?? 200;
    if (status !== 200) return mockFetchResult('', status, 'text/html');
    const robotsMeta = site.noindex?.includes(o.url) ? '<meta name="robots" content="noindex">' : '';
    return mockFetchResult(`<html><head>${robotsMeta}</head><body><p>Post.</p></body></html>`, 200, 'text/html');
  };

  return { result: audit.audit(ctx), requests, locs };
}

/** A UTC ISO timestamp `days` before 2026-08-20. */
const iso = (days: number) => new Date(Date.parse('2026-08-20T10:00:00Z') - days * 86_400_000).toISOString();
/** The same instant in RFC 822, which is what RSS pubDate uses. */
const rfc = (days: number) => new Date(Date.parse('2026-08-20T10:00:00Z') - days * 86_400_000).toUTCString();

describe('ThreeWayFreshnessLagAudit', () => {
  const audit = new ThreeWayFreshnessLagAudit();

  it('is notApplicable on an empty site', async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it('is notApplicable when only one surface carries a date', async () => {
    const { result } = run({ pageDate: iso(0) });
    const r = await result;
    expect(r.status).toBe('na');
  });

  it('passes when the sitemap and the feed keep up with the pages', async () => {
    const { result } = run({ pageDate: iso(0), lastmods: [iso(1), iso(3)], itemDates: [rfc(0), rfc(2)] });
    const r = await result;
    expect(r.status).toBe('pass');
    expect(r.details?.['sitemapLagDays']).toBe(1);
  });

  it('fails when the newest sitemap lastmod trails the newest page date by over a week', async () => {
    const { result } = run({ pageDate: iso(0), lastmods: [iso(11)], itemDates: [rfc(0)] });
    const r = await result;
    expect(r.status).toBe('fail');
    expect(strings(r, 'failures').join(' ')).toContain('11 days behind');
    expect(r.details?.['sitemapLagDays']).toBe(11);
  });

  it('fails when the newest feed entry trails the newest page date by over a week', async () => {
    const { result } = run({ pageDate: iso(0), lastmods: [iso(0)], itemDates: [rfc(20)] });
    const r = await result;
    expect(r.status).toBe('fail');
    expect(strings(r, 'failures').join(' ')).toContain("feed's newest entry");
  });

  // A generator that does not stamp its own freshness header makes conditional
  // pollers skip the feed, so the new items are never read at all.
  it('fails when the feed build timestamp is older than its newest item', async () => {
    const { result } = run({
      pageDate: iso(0),
      lastmods: [iso(0)],
      itemDates: [rfc(0), rfc(4)],
      lastBuild: rfc(9),
    });
    const r = await result;
    expect(r.status).toBe('fail');
    expect(strings(r, 'failures').join(' ')).toContain('build timestamp');
  });

  it('warns when feed items are not in newest-first order', async () => {
    const { result } = run({
      pageDate: iso(0),
      lastmods: [iso(0)],
      itemDates: [rfc(5), rfc(1)],
      lastBuild: rfc(1),
    });
    const r = await result;
    expect(r.status).toBe('warn');
    expect(strings(r, 'warnings').join(' ')).toContain('newest-first');
  });

  // A timestamp with no offset cannot be compared without guessing an offset,
  // and the guess is worth up to a day of the seven this audit measures.
  it('ignores a page date that carries no timezone', async () => {
    const { result } = run({ pageDate: '2026-08-20T10:00:00', lastmods: [iso(30)] });
    const r = await result;
    expect(r.status).toBe('na');
    expect(r.found).toContain('no date');
  });

  it('warns about sitemap URLs that are advertised but dead', async () => {
    const { result } = run({
      pageDate: iso(0),
      lastmods: [iso(0), iso(1)],
      itemDates: [rfc(0)],
      urlStatus: { 'https://example.com/post-0': 404 },
    });
    const r = await result;
    expect(r.status).toBe('warn');
    expect(strings(r, 'deadSitemapUrls').join(' ')).toContain('HTTP 404');
  });

  it('counts a noindex sitemap URL as advertised but dead', async () => {
    const { result } = run({
      pageDate: iso(0),
      lastmods: [iso(0)],
      itemDates: [rfc(0)],
      noindex: ['https://example.com/post-0'],
    });
    const r = await result;
    expect(r.status).toBe('warn');
    expect(strings(r, 'deadSitemapUrls').join(' ')).toContain('noindex');
  });

  it('samples at most five sitemap URLs for the dead-URL check', async () => {
    const lastmods = Array.from({ length: 12 }, (_v, i) => iso(i));
    const { result, requests } = run({ pageDate: iso(0), lastmods, itemDates: [rfc(0)] });
    await result;
    expect(requests.filter((o) => new URL(o.url).pathname.startsWith('/post-'))).toHaveLength(5);
  });

  it('registers as a scored grade-B audit', () => {
    const { meta } = ThreeWayFreshnessLagAudit;
    expect(meta.evidenceGrade).toBe('B');
    expect(meta.tier).toBe('scored');
    expect(meta.weight).toBeCloseTo(0.6);
    expect(meta.id.length).toBeLessThanOrEqual(64);
  });
});
