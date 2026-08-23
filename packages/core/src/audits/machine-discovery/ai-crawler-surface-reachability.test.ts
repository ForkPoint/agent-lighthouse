import { describe, it, expect, vi } from 'vitest';
import { AiCrawlerSurfaceReachabilityAudit } from './ai-crawler-surface-reachability';
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

const DOC_URLS = Array.from({ length: 9 }, (_i, n) => `https://example.com/docs/page-${n}`);
const ALL_URLS = ['https://example.com/', ...DOC_URLS];

const sitemapXml = (urls: string[]) =>
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls
    .map((u) => `<url><loc>${u}</loc></url>`)
    .join('')}</urlset>`;

function run(options: { robots?: string; urls?: string[]; head?: string } = {}) {
  const audit = new AiCrawlerSurfaceReachabilityAudit();
  const page = mockPageContext(
    'https://example.com/',
    `<html><head>${options.head ?? ''}</head><body><main><p>Copy.</p></main></body></html>`,
  );
  const rootFiles: Record<string, FetchResult> = options.robots
    ? { '/robots.txt': mockFetchResult(options.robots, 200, 'text/plain') }
    : {};
  const ctx = mockCheckContext([page], rootFiles);
  ctx.fetch = async (o: FetchOptions) => {
    if (new URL(o.url).pathname === '/sitemap.xml' && options.urls) {
      return mockFetchResult(sitemapXml(options.urls), 200, 'application/xml');
    }
    return mockFetchResult('', 404);
  };
  return audit.audit(ctx);
}

describe('AiCrawlerSurfaceReachabilityAudit', () => {
  const audit = new AiCrawlerSurfaceReachabilityAudit();

  it('is notApplicable on an empty site', async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it('is notApplicable with no robots.txt, no sitemap and no feed', async () => {
    expect((await run()).status).toBe('na');
  });

  it('passes when every panel crawler can reach every advertised surface', async () => {
    const result = await run({ robots: 'User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml\n', urls: ALL_URLS });
    expect(result.status).toBe('pass');
  });

  // The Sitemap: directive is host-global and user-agent independent, which is
  // exactly why a file can advertise a path its own rules forbid.
  it('fails when robots.txt advertises a sitemap the same file disallows', async () => {
    const result = await run({
      robots: 'Sitemap: https://example.com/sitemap.xml\n\nUser-agent: *\nDisallow: /sitemap.xml\n',
      urls: ALL_URLS,
    });
    expect(result.status).toBe('fail');
    expect(result.message).toContain('Sitemap: https://example.com/sitemap.xml');
    expect(result.message).toContain('Disallow: /sitemap.xml');
  });

  it('fails a named group whose sitemap coverage drops under 50% where the wildcard allowed it', async () => {
    const result = await run({
      robots: 'User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml\n\nUser-agent: GPTBot\nDisallow: /docs\n',
      urls: ALL_URLS,
    });
    expect(result.status).toBe('fail');
    expect(result.message).toContain('GPTBot');
  });

  it('fails a feed advertised by <link rel="alternate"> but disallowed', async () => {
    const result = await run({
      robots: 'User-agent: *\nAllow: /\nDisallow: /feed.xml\nSitemap: https://example.com/sitemap.xml\n',
      urls: ALL_URLS,
      head: '<link rel="alternate" type="application/rss+xml" href="/feed.xml">',
    });
    expect(result.status).toBe('fail');
    expect(result.message).toContain('/feed.xml');
  });

  // A blanket block is a policy statement, not a broken configuration.
  it('warns rather than fails when a named AI group disallows everything', async () => {
    const result = await run({
      robots: 'User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml\n\nUser-agent: ClaudeBot\nDisallow: /\n',
      urls: ALL_URLS,
    });
    expect(result.status).toBe('warn');
    expect(result.message).toContain('ClaudeBot');
  });

  it('reports the per-crawler coverage in the output', async () => {
    const result = await run({ robots: 'User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml\n', urls: ALL_URLS });
    expect(result.found).toContain('10 sampled sitemap URL');
  });
});
