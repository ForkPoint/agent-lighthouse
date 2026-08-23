import { describe, it, expect, vi } from 'vitest';
import { FeedEntryIdentityAndCanonicalIntegrityAudit } from './feed-entry-identity-and-canonical-integrity';
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

/** An item page that names `canonical` as its canonical URL. */
function itemPage(canonical: string): string {
  return `<html><head><link rel="canonical" href="${canonical}"></head><body><p>Post.</p></body></html>`;
}

interface RunOptions {
  /** Feed body served at /feed.xml. */
  feed: string;
  feedType?: string;
  /** Item pages, keyed by absolute URL. */
  items?: Record<string, string>;
  /** URLs that answer with a redirect chain, mapped to where they end up. */
  redirects?: Record<string, string>;
}

function run(options: RunOptions) {
  const audit = new FeedEntryIdentityAndCanonicalIntegrityAudit();
  const html =
    '<html><head><link rel="alternate" type="application/rss+xml" href="/feed.xml"></head><body><p>Home.</p></body></html>';
  const ctx = mockCheckContext([mockPageContext('https://example.com/', html)]);
  const requests: FetchOptions[] = [];

  ctx.fetch = async (o: FetchOptions): Promise<FetchResult> => {
    requests.push(o);
    const url = o.url;
    if (url === 'https://example.com/feed.xml') {
      const result = mockFetchResult(options.feed, 200, options.feedType ?? 'application/rss+xml');
      result.url = url;
      result.finalUrl = url;
      return result;
    }
    const target = options.redirects?.[url] ?? url;
    const body = options.items?.[target];
    if (body === undefined) return mockFetchResult('', 404, 'text/html');
    const result = mockFetchResult(body, 200, 'text/html');
    result.url = url;
    result.finalUrl = target;
    return result;
  };

  return { result: audit.audit(ctx), requests };
}

/** An Atom feed carrying `entries` verbatim. */
const atom = (entries: string) =>
  `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Blog</title><updated>2026-08-20T10:00:00Z</updated>${entries}</feed>`;

/** An RSS channel carrying `items` verbatim. */
const rss = (items: string) =>
  `<?xml version="1.0"?><rss version="2.0"><channel><title>Blog</title><lastBuildDate>Wed, 20 Aug 2026 10:00:00 GMT</lastBuildDate>${items}</channel></rss>`;

const CLEAN_ATOM = atom(
  `<entry><id>https://example.com/a</id><title>A</title><updated>2026-08-20T10:00:00Z</updated><link href="https://example.com/a"/><summary>A summary.</summary></entry>` +
    `<entry><id>https://example.com/b</id><title>B</title><updated>2026-08-19T10:00:00Z</updated><link href="https://example.com/b"/><summary>B summary.</summary></entry>`,
);

const CLEAN_ITEMS = {
  'https://example.com/a': itemPage('https://example.com/a'),
  'https://example.com/b': itemPage('https://example.com/b'),
};

describe('FeedEntryIdentityAndCanonicalIntegrityAudit', () => {
  const audit = new FeedEntryIdentityAndCanonicalIntegrityAudit();

  it('is notApplicable on an empty site', async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it('is notApplicable when the site publishes no feed', async () => {
    const ctx = mockCheckContext([mockPageContext('https://example.com/', '<html><body><p>Hi.</p></body></html>')]);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('na');
  });

  it('passes a feed whose entries carry unique ids and canonical links', async () => {
    const { result } = run({ feed: CLEAN_ATOM, feedType: 'application/atom+xml', items: CLEAN_ITEMS });
    const r = await result;
    expect(r.status).toBe('pass');
    expect(r.details?.['entriesChecked']).toBe(2);
    expect(strings(r, 'failures')).toHaveLength(0);
  });

  it('fails an entry with no id and names it', async () => {
    const feed = atom(
      `<entry><title>A</title><updated>2026-08-20T10:00:00Z</updated><link href="https://example.com/a"/><summary>S.</summary></entry>`,
    );
    const { result } = run({ feed, feedType: 'application/atom+xml', items: CLEAN_ITEMS });
    const r = await result;
    expect(r.status).toBe('fail');
    expect(strings(r, 'failures').join(' ')).toContain('no atom:id');
  });

  it('fails a feed that reuses one id across two entries', async () => {
    const feed = atom(
      `<entry><id>urn:same</id><title>A</title><updated>2026-08-20T10:00:00Z</updated><link href="https://example.com/a"/><summary>S.</summary></entry>` +
        `<entry><id>urn:same</id><title>B</title><updated>2026-08-19T10:00:00Z</updated><link href="https://example.com/b"/><summary>S.</summary></entry>`,
    );
    const { result } = run({ feed, feedType: 'application/atom+xml', items: CLEAN_ITEMS });
    const r = await result;
    expect(r.status).toBe('fail');
    expect(strings(r, 'failures').join(' ')).toContain('appears on 2 entries');
  });

  // RFC 4287 says exactly one atom:updated per entry, and consumers order on it.
  it('fails an Atom entry carrying two atom:updated elements', async () => {
    const feed = atom(
      `<entry><id>https://example.com/a</id><title>A</title><updated>2026-08-20T10:00:00Z</updated><updated>2026-08-18T10:00:00Z</updated><link href="https://example.com/a"/><summary>S.</summary></entry>`,
    );
    const { result } = run({ feed, feedType: 'application/atom+xml', items: CLEAN_ITEMS });
    const r = await result;
    expect(r.status).toBe('fail');
    expect(strings(r, 'failures').join(' ')).toContain('atom:updated');
  });

  it('fails an Atom entry whose content has a src but no summary', async () => {
    const feed = atom(
      `<entry><id>https://example.com/a</id><title>A</title><updated>2026-08-20T10:00:00Z</updated><link href="https://example.com/a"/><content src="https://example.com/a.mp3" type="audio/mpeg"/></entry>`,
    );
    const { result } = run({ feed, feedType: 'application/atom+xml', items: CLEAN_ITEMS });
    const r = await result;
    expect(r.status).toBe('fail');
    expect(strings(r, 'failures').join(' ')).toContain('atom:summary');
  });

  it('accepts an Atom entry whose content is inline HTML with no summary', async () => {
    const feed = atom(
      `<entry><id>https://example.com/a</id><title>A</title><updated>2026-08-20T10:00:00Z</updated><link href="https://example.com/a"/><content type="html">Body.</content></entry>`,
    );
    const { result } = run({ feed, feedType: 'application/atom+xml', items: CLEAN_ITEMS });
    const r = await result;
    expect(r.status).toBe('pass');
  });

  it('fails an RSS guid that is a permalink by default but not a URL', async () => {
    const feed = rss(
      `<item><title>A</title><guid>post-17</guid><link>https://example.com/a</link><pubDate>Wed, 20 Aug 2026 10:00:00 GMT</pubDate></item>`,
    );
    const { result } = run({ feed, items: CLEAN_ITEMS });
    const r = await result;
    expect(r.status).toBe('fail');
    expect(strings(r, 'failures').join(' ')).toContain('isPermaLink="false"');
  });

  it('accepts the same guid once it declares isPermaLink="false"', async () => {
    const feed = rss(
      `<item><title>A</title><guid isPermaLink="false">post-17</guid><link>https://example.com/a</link><pubDate>Wed, 20 Aug 2026 10:00:00 GMT</pubDate></item>`,
    );
    const { result } = run({ feed, items: CLEAN_ITEMS });
    const r = await result;
    expect(r.status).toBe('pass');
  });

  it('fails an item link that redirects somewhere else', async () => {
    const feed = rss(
      `<item><title>A</title><guid>https://example.com/old</guid><link>https://example.com/old</link><pubDate>Wed, 20 Aug 2026 10:00:00 GMT</pubDate></item>`,
    );
    const { result } = run({
      feed,
      items: { 'https://example.com/a': itemPage('https://example.com/a') },
      redirects: { 'https://example.com/old': 'https://example.com/a' },
    });
    const r = await result;
    expect(r.status).toBe('fail');
    expect(strings(r, 'failures').join(' ')).toContain('redirects to https://example.com/a');
  });

  it('fails an item link whose tracking parameters the canonical does not carry', async () => {
    const feed = rss(
      `<item><title>A</title><guid>https://example.com/a?utm_source=feed</guid><link>https://example.com/a?utm_source=feed</link><pubDate>Wed, 20 Aug 2026 10:00:00 GMT</pubDate></item>`,
    );
    const { result } = run({
      feed,
      items: { 'https://example.com/a?utm_source=feed': itemPage('https://example.com/a') },
    });
    const r = await result;
    expect(r.status).toBe('fail');
    const text = strings(r, 'failures').join(' ');
    expect(text).toContain('names https://example.com/a as canonical');
    expect(text).toContain('utm_source');
  });

  it('fails an item link that is not absolute HTTPS', async () => {
    const feed = rss(
      `<item><title>A</title><guid isPermaLink="false">a</guid><link>http://example.com/a</link><pubDate>Wed, 20 Aug 2026 10:00:00 GMT</pubDate></item>`,
    );
    const { result } = run({ feed, items: { 'http://example.com/a': itemPage('http://example.com/a') } });
    const r = await result;
    expect(r.status).toBe('fail');
    expect(strings(r, 'failures').join(' ')).toContain('not absolute HTTPS');
  });

  // A generic XML type parses, so it is a delivery defect rather than a broken feed.
  it('warns when the feed is served as text/xml but passes its identity checks', async () => {
    const { result } = run({ feed: CLEAN_ATOM, feedType: 'text/xml', items: CLEAN_ITEMS });
    const r = await result;
    expect(r.status).toBe('warn');
    expect(strings(r, 'warnings').join(' ')).toContain('text/xml');
  });

  it('fails a feed served as text/html', async () => {
    const { result } = run({ feed: CLEAN_ATOM, feedType: 'text/html', items: CLEAN_ITEMS });
    const r = await result;
    expect(r.status).toBe('fail');
    expect(strings(r, 'failures').join(' ')).toContain('not a atom media type');
  });

  it('fails a feed that starts with a byte-order mark', async () => {
    const { result } = run({ feed: `﻿${CLEAN_ATOM}`, feedType: 'application/atom+xml', items: CLEAN_ITEMS });
    const r = await result;
    expect(r.status).toBe('fail');
    expect(strings(r, 'failures').join(' ')).toContain('byte-order mark');
  });

  it('compares at most five item URLs against their canonical', async () => {
    const entries = Array.from(
      { length: 8 },
      (_v, i) =>
        `<entry><id>https://example.com/p${i}</id><title>P${i}</title><updated>2026-08-${String(10 + i).padStart(2, '0')}T10:00:00Z</updated><link href="https://example.com/p${i}"/><summary>S.</summary></entry>`,
    ).join('');
    const items = Object.fromEntries(
      Array.from({ length: 8 }, (_v, i) => [`https://example.com/p${i}`, itemPage(`https://example.com/p${i}`)]),
    );
    const { result, requests } = run({ feed: atom(entries), feedType: 'application/atom+xml', items });
    const r = await result;
    expect(r.status).toBe('pass');
    expect(r.details?.['entriesChecked']).toBe(8);
    expect(strings(r, 'canonicalChecks')).toHaveLength(5);
    // Feed discovery aside, exactly five item pages are fetched.
    expect(requests.filter((o) => o.url.startsWith('https://example.com/p'))).toHaveLength(5);
  });

  it('declares grade B, scored, and an id inside the schema cap', () => {
    const { meta } = FeedEntryIdentityAndCanonicalIntegrityAudit;
    expect(meta.evidenceGrade).toBe('B');
    expect(meta.tier).toBe('scored');
    expect(meta.weight).toBeCloseTo(0.6);
    expect(meta.id.length).toBeLessThanOrEqual(64);
  });
});
