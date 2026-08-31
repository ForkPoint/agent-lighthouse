import { describe, it, expect } from 'vitest';
import { defaultConfig } from '../../audit-config';
import { planAudits } from '../../audit-runner';
import { RssFeedAudit } from './rss-feed';
import {
  attributableFixture,
  mockCheckContext,
  mockFetchResult,
  mockPageContext,
  unreachedSiteContext,
} from '../../__tests__/test-utils';

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

  // A feed link sits in a shared layout, so every scanned page declares it.
  // Fetching it once per page spent N requests to learn one fact.
  it('fetches a feed linked from several pages only once', async () => {
    const html =
      '<html><head><link rel="alternate" type="application/rss+xml" href="/rss.xml" /></head><body></body></html>';
    const ctx = mockCheckContext([
      mockPageContext('https://example.com/', html, 0),
      mockPageContext('https://example.com/blog', html, 1),
      mockPageContext('https://example.com/news', html, 2),
    ]);
    const requested: string[] = [];
    ctx.fetch = async ({ url }) => {
      requested.push(url);
      const r = mockFetchResult('<rss><channel></channel></rss>', 200, 'application/rss+xml');
      r.url = url;
      r.finalUrl = url;
      return r;
    };
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(requested.filter((u) => u === 'https://example.com/rss.xml')).toHaveLength(1);
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

  describe('feed autodiscovery <link> (absorbed from rss-feed-link, v1 4.16)', () => {
    const withHead = (head: string) =>
      mockPageContext('https://example.com/', `<html><head>${head}</head><body></body></html>`);

    it('reports the autodiscovery link alongside the feed', async () => {
      const ctx = mockCheckContext(
        [withHead('<link rel="alternate" type="application/rss+xml" href="/rss.xml">')],
        { '/rss.xml': mockFetchResult('<rss><channel></channel></rss>', 200, 'application/rss+xml') },
      );
      ctx.fetch = async ({ url }) => {
        const r = mockFetchResult('<rss><channel></channel></rss>', 200, 'application/rss+xml');
        r.url = url;
        r.finalUrl = url;
        return r;
      };
      const result = await audit.audit(ctx);
      expect(result.status).toBe('pass');
      expect(result.found).toContain('autodiscovery <link> present');
    });

    it('reports a feed found without any autodiscovery link', async () => {
      const ctx = mockCheckContext([withHead('')], {
        '/rss.xml': mockFetchResult('<rss><channel></channel></rss>', 200, 'application/rss+xml'),
      });
      const result = await audit.audit(ctx);
      expect(result.status).toBe('pass');
      expect(result.found).toContain('no autodiscovery <link>');
    });

    // Review finding (4.16): only `application/rss+xml` was accepted, so every
    // Atom- or JSON-Feed-only site was reported as having no feed link — the
    // highest-frequency false failure in the category.
    it('accepts atom, JSON Feed and charset-parameterised feed types', async () => {
      for (const type of [
        'application/atom+xml',
        'application/feed+json',
        'application/rss+xml; charset=UTF-8',
      ]) {
        const ctx = mockCheckContext([withHead(`<link rel="alternate" type="${type}" href="/feed">`)]);
        ctx.fetch = async ({ url }) => {
          const r = mockFetchResult('<feed></feed>', 200, 'application/atom+xml');
          r.url = url;
          r.finalUrl = url;
          return r;
        };
        const result = await audit.audit(ctx);
        expect(result.status, type).toBe('pass');
        expect(result.found, type).toContain('autodiscovery <link> present');
      }
    });

    // Review finding (4.16 + 1.11): rel was compared exactly and case-sensitively,
    // so WordPress' multi-token rel and a capitalised rel both missed.
    it('accepts an uppercase or multi-token rel', async () => {
      for (const rel of ['Alternate', 'alternate home']) {
        const ctx = mockCheckContext([
          withHead(`<link rel="${rel}" type="application/rss+xml" href="/rss.xml">`),
        ]);
        ctx.fetch = async ({ url }) => {
          const r = mockFetchResult('<rss><channel></channel></rss>', 200, 'application/rss+xml');
          r.url = url;
          r.finalUrl = url;
          return r;
        };
        const result = await audit.audit(ctx);
        expect(result.status, rel).toBe('pass');
        expect(result.found, rel).toContain('autodiscovery <link> present');
      }
    });

    // Review finding (1.11): only '/'-prefixed hrefs were resolved, so a
    // document-relative feed href was fetched verbatim and failed.
    it('resolves a document-relative feed href against the page URL', async () => {
      const page = mockPageContext(
        'https://example.com/blog/',
        '<html><head><link rel="alternate" type="application/rss+xml" href="feed.xml"></head><body></body></html>',
      );
      const ctx = mockCheckContext([page]);
      ctx.fetch = async ({ url }) => {
        const ok = url === 'https://example.com/blog/feed.xml';
        const r = mockFetchResult(ok ? '<rss><channel></channel></rss>' : '', ok ? 200 : 404);
        r.url = url;
        r.finalUrl = url;
        return r;
      };
      const result = await audit.audit(ctx);
      expect(result.status).toBe('pass');
      expect(result.message).toContain('blog/feed.xml');
    });

    // Review finding (4.16): the feed is often declared on the blog index, not
    // the homepage, and v1 4.16 only looked at ctx.pages[0].
    it('finds the autodiscovery link on a non-homepage', async () => {
      const ctx = mockCheckContext([
        withHead(''),
        mockPageContext(
          'https://example.com/blog',
          '<html><head><link rel="alternate" type="application/rss+xml" href="/rss.xml"></head><body></body></html>',
          1,
        ),
      ]);
      ctx.fetch = async ({ url }) => {
        const r = mockFetchResult('<rss><channel></channel></rss>', 200, 'application/rss+xml');
        r.url = url;
        r.finalUrl = url;
        return r;
      };
      const result = await audit.audit(ctx);
      expect(result.found).toContain('autodiscovery <link> present');
    });

    it('reports the missing link when no feed is found at all', async () => {
      const ctx = mockCheckContext([withHead('')]);
      const result = await audit.audit(ctx);
      expect(result.status).toBe('fail');
      expect(result.found).toContain('no autodiscovery <link>');
    });
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and the runner has to honour it rather than run this audit anyway.
  it('declines when no response can be attributed to this site', async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new RssFeedAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, 'the same input reached is judged').not.toBe('na');

    const plan = planAudits(unreachedSiteContext(pages, rootFiles), defaultConfig);
    expect(plan.runnable.map((entry) => entry.reg.meta.id)).not.toContain(RssFeedAudit.meta.id);
    expect(plan.skipped.find((stub) => stub.id === RssFeedAudit.meta.id)?.status).toBe('na');
  });
});
