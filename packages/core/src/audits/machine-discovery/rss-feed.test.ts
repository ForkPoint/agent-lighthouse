import { describe, it, expect } from 'vitest';
import { RssFeedAudit } from './rss-feed';
import { mockCheckContext, mockPageContext, mockFetchResult } from '../../__tests__/test-utils';

describe('RssFeedAudit', () => {
  const audit = new RssFeedAudit();

  it('passes when an RSS feed exists at a well-known path', async () => {
    const ctx = mockCheckContext([], {
      '/rss.xml': mockFetchResult('<rss><channel></channel></rss>', 200, 'application/rss+xml'),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('RSS/Atom feed found');
  });

  it('fails when no feed is found', async () => {
    // No pages, no root feed files; ctx.fetch defaults to 404 for the /atom.xml probe.
    const ctx = mockCheckContext([]);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No RSS or Atom feed found');
  });

  it('passes when a page <head> alternate link points to a relative RSS feed URL', async () => {
    // Covers headLinks loop: link.rel=alternate, link.type=rss+xml, feedUrl.startsWith('/')
    const html =
      '<html><head><link rel="alternate" type="application/rss+xml" href="/rss.xml" /></head><body></body></html>';
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)]);
    ctx.fetch = async ({ url }) => {
      const r = mockFetchResult('<rss><channel></channel></rss>', 200, 'application/rss+xml');
      r.url = url;
      r.finalUrl = url;
      return r;
    };
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('RSS/Atom feed found');
  });

  it('passes when a page <head> alternate link points to an absolute Atom feed URL', async () => {
    // Covers: link.type=atom+xml branch AND feedUrl that does NOT start with '/'
    const html =
      '<html><head><link rel="alternate" type="application/atom+xml" href="https://example.com/feed.atom" /></head><body></body></html>';
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)]);
    ctx.fetch = async ({ url }) => {
      const r = mockFetchResult('<feed></feed>', 200, 'application/atom+xml');
      r.url = url;
      r.finalUrl = url;
      return r;
    };
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('RSS/Atom feed found');
  });

  it('falls through to rootFiles when head-link feed fetch returns non-200', async () => {
    // isOk(result) false in headLinks loop → falls through to well-known paths
    const html =
      '<html><head><link rel="alternate" type="application/rss+xml" href="/bad-feed.xml" /></head><body></body></html>';
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)], {
      '/rss.xml': mockFetchResult('<rss><channel></channel></rss>', 200, 'application/rss+xml'),
    });
    ctx.fetch = async ({ url }) => {
      const r = mockFetchResult('', 404);
      r.url = url;
      r.finalUrl = url;
      return r;
    };
    const result = await audit.audit(ctx);
    // Falls through to rootFiles → /rss.xml found
    expect(result.status).toBe('pass');
  });

  it('passes when atom.xml is found via direct fetch fallback (covers atom fetch true branch)', async () => {
    // head link fails + no rootFiles → atom.xml fetched directly → 200 → return
    const html =
      '<html><head><link rel="alternate" type="application/rss+xml" href="/bad-feed.xml" /></head><body></body></html>';
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)]);
    ctx.fetch = async ({ url }) => {
      const ok = url === 'https://example.com/atom.xml';
      const r = mockFetchResult(ok ? '<feed></feed>' : '', ok ? 200 : 404, 'application/atom+xml');
      r.url = url;
      r.finalUrl = url;
      return r;
    };
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('atom.xml');
  });

  it('skips non-alternate headLinks and uses well-known paths (covers if-condition false branch)', async () => {
    // rel="icon" does not match "alternate" → condition is false → loop continues without returning
    const html =
      '<html><head><link rel="icon" href="/favicon.ico" /></head><body></body></html>';
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)], {
      '/rss.xml': mockFetchResult('<rss><channel></channel></rss>', 200, 'application/rss+xml'),
    });
    ctx.fetch = async ({ url }) => {
      const r = mockFetchResult('', 404);
      r.url = url;
      r.finalUrl = url;
      return r;
    };
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
  });
});
