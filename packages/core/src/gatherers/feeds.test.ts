import { describe, it, expect, vi } from 'vitest';
import { discoverFeedUrls, parseFeed, parseFeedDate, sharedFeed, sharedFeeds } from './feeds';
import { mockFetchResult } from '../__tests__/test-utils';
import type { FetchOptions, FetchResult } from '../fetcher';

// isSafeUrl does a real DNS lookup. The offline stand-in still blocks loopback
// and private ranges, so a refusal test proves the gate rather than the mock.
vi.mock('../fetcher', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../fetcher')>();
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

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <updated>2026-08-20T10:00:00Z</updated>
  <link rel="self" href="https://example.com/atom.xml"/>
  <link rel="hub" href="https://hub.example/"/>
  <entry>
    <id>tag:example.com,2026:1</id>
    <updated>2026-08-20T10:00:00Z</updated>
    <title>First</title>
    <summary>A summary.</summary>
    <link rel="alternate" href="/posts/1"/>
    <content type="text/html" src="/posts/1.html"/>
  </entry>
</feed>`;

const RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <lastBuildDate>Wed, 20 Aug 2026 10:00:00 GMT</lastBuildDate>
  <item>
    <guid>https://example.com/posts/1</guid>
    <link>https://example.com/posts/1</link>
    <pubDate>Wed, 20 Aug 2026 10:00:00 GMT</pubDate>
    <title>First</title>
    <description>A summary.</description>
  </item>
  <item>
    <guid isPermaLink="false">abc-123</guid>
    <link>https://example.com/posts/2</link>
    <pubDate>Wed, 19 Aug 2026 10:00:00 GMT</pubDate>
    <title>Second</title>
  </item>
</channel></rss>`;

function context(
  pages: Array<{ url: string; headLinks: Array<{ rel: string; type: string; href: string }> }>,
  bodies: Record<string, FetchResult> = {},
) {
  const calls: string[] = [];
  const ctx = {
    baseUrl: 'https://example.com',
    pages,
    fetch: async (options: FetchOptions): Promise<FetchResult> => {
      calls.push(options.url);
      return bodies[options.url] ?? mockFetchResult('', 404, 'text/plain');
    },
  };
  return { ctx, calls };
}

const page = (links: Array<{ rel: string; type: string; href: string }>) => ({
  url: 'https://example.com/',
  headLinks: links,
});

describe('discoverFeedUrls', () => {
  it('returns autodiscovered feeds plus the conventional paths, deduped', () => {
    const { ctx } = context([
      page([{ rel: 'alternate', type: 'application/atom+xml', href: '/atom.xml' }]),
    ]);
    const urls = discoverFeedUrls(ctx);
    expect(urls[0]).toBe('https://example.com/atom.xml');
    expect(urls).toContain('https://example.com/feed');
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('drops a feed on another host', () => {
    const { ctx } = context([
      page([{ rel: 'alternate', type: 'application/rss+xml', href: 'https://other.example/rss' }]),
    ]);
    expect(discoverFeedUrls(ctx)).not.toContain('https://other.example/rss');
  });

  it('ignores a link that is not a feed type', () => {
    const { ctx } = context([page([{ rel: 'alternate', type: 'text/html', href: '/amp' }])]);
    expect(discoverFeedUrls(ctx)).not.toContain('https://example.com/amp');
  });
});

describe('parseFeed', () => {
  it('reads Atom entries, self and hub links, and the feed build date', () => {
    const doc = parseFeed('https://example.com/atom.xml', mockFetchResult(ATOM, 200, 'application/atom+xml'));
    expect(doc.declaredType).toBe('atom');
    expect(doc.selfLink).toBe('https://example.com/atom.xml');
    expect(doc.hubLinks).toEqual(['https://hub.example/']);
    expect(doc.lastBuild).toBe(Date.parse('2026-08-20T10:00:00Z'));
    const [entry] = doc.entries;
    expect(entry?.id).toBe('tag:example.com,2026:1');
    expect(entry?.link).toBe('https://example.com/posts/1');
    expect(entry?.summaryPresent).toBe(true);
    expect(entry?.contentSrc).toBe('/posts/1.html');
    expect(entry?.idCount).toBe(1);
  });

  it('reads an RSS guid as a permalink unless isPermaLink says otherwise', () => {
    const doc = parseFeed('https://example.com/rss.xml', mockFetchResult(RSS, 200, 'application/rss+xml'));
    expect(doc.declaredType).toBe('rss');
    expect(doc.entries[0]?.idIsPermalink).toBe(true);
    expect(doc.entries[1]?.idIsPermalink).toBe(false);
    expect(doc.lastBuild).toBe(Date.parse('Wed, 20 Aug 2026 10:00:00 GMT'));
  });

  it('prefers the Link response header over the document for self and hub', () => {
    const result = mockFetchResult(ATOM, 200, 'application/atom+xml');
    result.url = 'https://example.com/atom.xml';
    result.headers['link'] = '<https://example.com/real-self>; rel=self, <https://hub2.example/>; rel=hub';
    const doc = parseFeed('https://example.com/atom.xml', result);
    expect(doc.selfLink).toBe('https://example.com/real-self');
    expect(doc.hubLinks).toEqual(['https://hub2.example/']);
    expect(doc.linksFromHeader).toBe(true);
  });

  it('reports a byte-order mark or leading whitespace', () => {
    const doc = parseFeed('https://example.com/rss.xml', mockFetchResult(`﻿${RSS}`, 200, 'application/rss+xml'));
    expect(doc.bomOrLeadingSpace).toBe(true);
    expect(doc.parsed).toBe(true);
  });

  it('does not claim to have parsed a document that is not a feed', () => {
    const doc = parseFeed('https://example.com/rss.xml', mockFetchResult('<html><body>no</body></html>', 200, 'text/html'));
    expect(doc.parsed).toBe(false);
    expect(doc.declaredType).toBe('unknown');
  });
});

describe('parseFeedDate', () => {
  it('parses a timezone-carrying ISO and RFC 822 date to UTC', () => {
    expect(parseFeedDate('2026-08-20T10:00:00Z')).toBe(Date.parse('2026-08-20T10:00:00Z'));
    expect(parseFeedDate('Wed, 20 Aug 2026 10:00:00 +0200')).toBe(
      Date.parse('Wed, 20 Aug 2026 10:00:00 +0200'),
    );
  });

  // Guessing an offset is silently wrong for every reader in another zone.
  it('returns undefined for a timezone-less timestamp', () => {
    expect(parseFeedDate('2026-08-20T10:00:00')).toBeUndefined();
    expect(parseFeedDate('not a date')).toBeUndefined();
  });
});

describe('sharedFeed', () => {
  it('fetches one URL once however many callers ask', async () => {
    const feed = mockFetchResult(ATOM, 200, 'application/atom+xml');
    const { ctx, calls } = context([page([])], { 'https://example.com/atom.xml': feed });
    const [a, b] = await Promise.all([
      sharedFeed(ctx, 'https://example.com/atom.xml'),
      sharedFeed(ctx, 'https://example.com/atom.xml'),
    ]);
    expect(calls).toEqual(['https://example.com/atom.xml']);
    expect(a?.entries).toHaveLength(1);
    expect(b).toBe(a);
  });

  it('refuses a URL the safety gate rejects', async () => {
    const { ctx, calls } = context([page([])]);
    expect(await sharedFeed(ctx, 'http://127.0.0.1/feed')).toBeUndefined();
    expect(calls).toEqual([]);
  });

  it('sharedFeeds keeps only the feeds that fetched and parsed', async () => {
    const { ctx } = context([page([{ rel: 'alternate', type: 'application/atom+xml', href: '/atom.xml' }])], {
      'https://example.com/atom.xml': mockFetchResult(ATOM, 200, 'application/atom+xml'),
    });
    const docs = await sharedFeeds(ctx);
    expect(docs.map((d) => d.url)).toEqual(['https://example.com/atom.xml']);
  });
});
