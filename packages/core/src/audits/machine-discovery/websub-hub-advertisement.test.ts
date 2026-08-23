import { describe, it, expect, vi } from 'vitest';
import { WebsubHubAdvertisementAudit } from './websub-hub-advertisement';
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
  /** Links inside the feed document, as raw XML. */
  documentLinks?: string;
  /** The feed's `Link:` response header. */
  linkHeader?: string;
  /** Status the hub HEAD answers. */
  hubStatus?: number;
}

const FEED_URL = 'https://example.com/feed.xml';

function run(site: Site) {
  const audit = new WebsubHubAdvertisementAudit();
  const html =
    '<html><head><link rel="alternate" type="application/atom+xml" href="/feed.xml"></head><body><p>Home.</p></body></html>';
  const feed = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Blog</title>${
    site.documentLinks ?? ''
  }<entry><id>https://example.com/a</id><title>A</title><updated>2026-08-20T10:00:00Z</updated><link href="https://example.com/a"/><summary>S.</summary></entry></feed>`;

  const ctx = mockCheckContext([mockPageContext('https://example.com/', html)]);
  const requests: FetchOptions[] = [];

  ctx.fetch = async (o: FetchOptions): Promise<FetchResult> => {
    requests.push(o);
    if (o.url === FEED_URL) {
      const result = mockFetchResult(feed, 200, 'application/atom+xml');
      result.url = FEED_URL;
      result.finalUrl = FEED_URL;
      if (site.linkHeader !== undefined) result.headers['link'] = site.linkHeader;
      return result;
    }
    if (new URL(o.url).pathname === '/feed') return mockFetchResult('', 404, 'text/plain');
    return mockFetchResult('', site.hubStatus ?? 200, 'text/plain');
  };

  return { result: audit.audit(ctx), requests };
}

const SELF_AND_HUB =
  '<link rel="self" href="https://example.com/feed.xml"/><link rel="hub" href="https://hub.example.net/"/>';

describe('WebsubHubAdvertisementAudit', () => {
  const audit = new WebsubHubAdvertisementAudit();

  it('is notApplicable on an empty site', async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it('passes a feed with one canonical self link and a live hub', async () => {
    const { result } = run({ documentLinks: SELF_AND_HUB });
    const r = await result;
    expect(r.status).toBe('pass');
    expect(r.details?.['feedsWithHub']).toBe(1);
    expect(r.details?.['feedsWithValidSelf']).toBe(1);
  });

  // The spec gives the response headers discovery precedence over the document.
  it('reads the Link response headers before the document', async () => {
    const { result } = run({
      documentLinks: '<link rel="self" href="https://example.com/wrong.xml"/>',
      linkHeader: '<https://example.com/feed.xml>; rel="self", <https://hub.example.net/>; rel="hub"',
    });
    const r = await result;
    expect(r.status).toBe('pass');
    expect(r.details?.['linksFromHeader']).toBe(true);
  });

  it('reports a relative self link', async () => {
    const { result } = run({
      documentLinks: '<link rel="self" href="/feed.xml"/><link rel="hub" href="https://hub.example.net/"/>',
    });
    const r = await result;
    expect(r.status).toBe('warn');
    expect(strings(r, 'observations').join(' ')).toContain('is relative');
  });

  it('reports a self link that names a different topic URL', async () => {
    const { result } = run({
      documentLinks:
        '<link rel="self" href="https://example.com/other.xml"/><link rel="hub" href="https://hub.example.net/"/>',
    });
    const r = await result;
    expect(r.status).toBe('warn');
    expect(strings(r, 'observations').join(' ')).toContain('different topic URL');
  });

  // http vs https is a different topic URL to a hub, however similar it looks.
  it('reports an http self link on an https feed', async () => {
    const { result } = run({
      documentLinks:
        '<link rel="self" href="http://example.com/feed.xml"/><link rel="hub" href="https://hub.example.net/"/>',
    });
    const r = await result;
    expect(r.status).toBe('warn');
    expect(strings(r, 'observations').join(' ')).toContain('different topic URL');
  });

  it('reports more than one self link', async () => {
    const { result } = run({
      documentLinks:
        '<link rel="self" href="https://example.com/feed.xml"/><link rel="self" href="https://example.com/feed.xml"/><link rel="hub" href="https://hub.example.net/"/>',
    });
    const r = await result;
    expect(r.status).toBe('warn');
    expect(strings(r, 'observations').join(' ')).toContain('exactly one');
  });

  it('reports a hub that is not absolute HTTPS', async () => {
    const { result } = run({
      documentLinks:
        '<link rel="self" href="https://example.com/feed.xml"/><link rel="hub" href="http://hub.example.net/"/>',
    });
    const r = await result;
    expect(r.status).toBe('warn');
    expect(strings(r, 'observations').join(' ')).toContain('not an absolute HTTPS URL');
  });

  it('accepts 405 from a hub that refuses a bare HEAD', async () => {
    const { result } = run({ documentLinks: SELF_AND_HUB, hubStatus: 405 });
    const r = await result;
    expect(r.status).toBe('pass');
    expect(strings(r, 'hubProbes').join(' ')).toContain('405');
  });

  it('reports a hub that answers 500', async () => {
    const { result } = run({ documentLinks: SELF_AND_HUB, hubStatus: 500 });
    const r = await result;
    expect(r.status).toBe('warn');
    expect(strings(r, 'observations').join(' ')).toContain('not reachable');
  });

  it('probes the hub with a HEAD and never subscribes', async () => {
    const { result, requests } = run({ documentLinks: SELF_AND_HUB });
    await result;
    const hub = requests.filter((o) => o.url.startsWith('https://hub.example.net'));
    expect(hub).toHaveLength(1);
    expect(hub[0]!.method).toBe('HEAD');
    expect(requests.every((o) => o.method === undefined || o.method === 'HEAD' || o.method === 'GET')).toBe(true);
  });

  it('reports a missing hub without failing', async () => {
    const { result } = run({ documentLinks: '<link rel="self" href="https://example.com/feed.xml"/>' });
    const r = await result;
    expect(r.status).toBe('warn');
    expect(strings(r, 'observations').join(' ')).toContain('no rel=hub');
  });

  it('never returns fail and carries no scoring weight', async () => {
    const { meta } = WebsubHubAdvertisementAudit;
    expect(meta.tier).toBe('informative');
    expect(meta.weight).toBe(0);
    expect(meta.scoreDisplayMode).toBe('informative');
    expect(meta.evidenceGrade).toBe('C');

    const cases: Site[] = [
      {},
      { documentLinks: SELF_AND_HUB },
      { documentLinks: SELF_AND_HUB, hubStatus: 500 },
      { documentLinks: '<link rel="hub" href="/relative"/>' },
    ];
    for (const site of cases) {
      const r = await run(site).result;
      expect(r.status, JSON.stringify(site)).not.toBe('fail');
    }
  });
});
