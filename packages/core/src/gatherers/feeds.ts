import * as cheerio from 'cheerio';
import type { FetchOptions, FetchResult } from '../fetcher';
import { isSafeUrl } from '../fetcher';
import { linksWithRel } from './structured-fields';

/**
 * Feed discovery and parsing, once per scan.
 *
 * Four Wave C audits ask the same feed the same structural questions — what are
 * its entries, what does each one claim as its identity, when was it built, and
 * what does it link to. Written here so they cannot answer them differently,
 * and cached per scan so four audits cost one fetch.
 */

/** Feed media types, MIME parameters stripped. */
const FEED_TYPES = new Set([
  'application/rss+xml',
  'application/atom+xml',
  'application/feed+json',
  'application/rdf+xml',
]);

/** Paths a feed conventionally lives at when nothing advertises it. */
const CONVENTIONAL_PATHS = ['/feed', '/feed.xml', '/rss.xml', '/atom.xml', '/index.xml'];

/** Entries parsed per feed. The newest twenty is what every consumer reads. */
const MAX_ENTRIES = 50;

export interface FeedEntry {
  /** `atom:id`, RSS `<guid>` or JSON Feed `id`. Empty when the entry has none. */
  id: string;
  /** RSS `isPermaLink`, which defaults to true. Always false for Atom, whose id is an IRI. */
  idIsPermalink: boolean;
  /** Resolved absolute item link, empty when absent or unresolvable. */
  link: string;
  /** Epoch ms in UTC. `undefined` when absent, unparseable, or carrying no timezone. */
  updated: number | undefined;
  title: string;
  summaryPresent: boolean;
  /** `atom:content/@src`, empty when absent. */
  contentSrc: string;
  /** `atom:content/@type`, empty when absent. */
  contentType: string;
  /** How many `atom:id` elements the entry carried. RFC 4287 allows exactly one. */
  idCount: number;
  /** How many `atom:updated` elements the entry carried. */
  updatedCount: number;
}

export interface FeedDocument {
  url: string;
  /** Response `Content-Type`, parameters included. */
  contentType: string;
  /** What the document actually is, decided by its root element. */
  declaredType: 'rss' | 'atom' | 'json' | 'unknown';
  status: number;
  /** A byte-order mark or whitespace before the first element. Both break strict parsers. */
  bomOrLeadingSpace: boolean;
  parsed: boolean;
  /** `rel=self`, header first then document. Empty when absent. */
  selfLink: string;
  /** Every `rel=self` href exactly as declared, unresolved. WebSub allows exactly one. */
  selfLinksRaw: string[];
  /** `rel=hub`, header first then document. */
  hubLinks: string[];
  /** Every `rel=hub` href exactly as declared, unresolved. */
  hubLinksRaw: string[];
  /** Whether the self/hub links came from the response headers rather than the body. */
  linksFromHeader: boolean;
  /** `<lastBuildDate>` or feed-level `<updated>`, epoch ms. */
  lastBuild: number | undefined;
  entries: FeedEntry[];
}

/** The slice of CheckContext this gatherer needs, kept structural to avoid a cycle. */
interface FeedContext {
  fetch: (options: FetchOptions) => Promise<FetchResult>;
  baseUrl: string;
  pages: Array<{ url: string; headLinks: Array<{ rel: string; type: string; href: string }> }>;
}

/**
 * A date in UTC, or `undefined` when it does not carry a timezone.
 *
 * A timezone-less timestamp cannot be compared against one that has a
 * timezone without guessing which offset the publisher meant, and every guess
 * is silently wrong for some readers. The freshness audit would rather have no
 * number than a number that is wrong by up to a day.
 */
export function parseFeedDate(raw: string): number | undefined {
  const value = raw.trim();
  if (value === '') return undefined;
  const isoWithZone = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i;
  const rfc822WithZone = /(GMT|UT|[A-Z]{3}|[+-]\d{4})$/;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoWithZone.test(value) && !rfc822WithZone.test(value) && !dateOnly.test(value)) {
    return undefined;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** Resolve `href` against `base`, or return an empty string. */
function resolve(href: string, base: string): string {
  if (!href) return '';
  try {
    return new URL(href, base).toString();
  } catch {
    return '';
  }
}

/**
 * Every feed URL this site advertises, plus the conventional paths.
 *
 * Same host only: a `<link rel="alternate">` pointing at another origin is
 * someone else's feed, and auditing it would report their defects as this
 * site's.
 */
export function discoverFeedUrls(ctx: FeedContext): string[] {
  const urls: string[] = [];
  const host = (() => {
    try {
      return new URL(ctx.baseUrl).host;
    } catch {
      return '';
    }
  })();

  for (const page of ctx.pages) {
    for (const link of page.headLinks) {
      const rels = link.rel.toLowerCase().trim().split(/\s+/);
      if (!rels.includes('alternate')) continue;
      const type = link.type.split(';')[0]!.trim().toLowerCase();
      if (!FEED_TYPES.has(type) || !link.href) continue;
      const resolved = resolve(link.href, page.url);
      if (resolved) urls.push(resolved);
    }
  }
  for (const path of CONVENTIONAL_PATHS) urls.push(resolve(path, ctx.baseUrl));

  const seen = new Set<string>();
  return urls.filter((url) => {
    if (url === '' || seen.has(url)) return false;
    try {
      if (new URL(url).host !== host) return false;
    } catch {
      return false;
    }
    seen.add(url);
    return true;
  });
}

/** Read `rel=self` and `rel=hub` out of the response headers. */
function headerLinks(result: FetchResult): {
  self: string;
  hubs: string[];
  selfRaw: string[];
  hubsRaw: string[];
} {
  const header = result.headers['link'] ?? '';
  if (header === '') return { self: '', hubs: [], selfRaw: [], hubsRaw: [] };
  const selfRaw = linksWithRel(header, 'self').map((entry) => entry.href);
  const hubsRaw = linksWithRel(header, 'hub').map((entry) => entry.href);
  return {
    self: resolve(selfRaw[0] ?? '', result.url),
    hubs: hubsRaw.map((h) => resolve(h, result.url)),
    selfRaw,
    hubsRaw,
  };
}

/** Parse a JSON Feed document. */
function parseJsonFeed(url: string, result: FetchResult): FeedEntry[] {
  try {
    const doc = JSON.parse(result.body) as {
      items?: Array<Record<string, unknown>>;
    };
    return (doc.items ?? []).slice(0, MAX_ENTRIES).map((item) => ({
      id: typeof item['id'] === 'string' ? item['id'] : '',
      idIsPermalink: false,
      link: typeof item['url'] === 'string' ? resolve(item['url'], url) : '',
      updated: parseFeedDate(
        typeof item['date_modified'] === 'string'
          ? item['date_modified']
          : typeof item['date_published'] === 'string'
            ? item['date_published']
            : '',
      ),
      title: typeof item['title'] === 'string' ? item['title'] : '',
      summaryPresent: typeof item['summary'] === 'string' && item['summary'] !== '',
      contentSrc: '',
      contentType: '',
      idCount: typeof item['id'] === 'string' ? 1 : 0,
      updatedCount: item['date_published'] === undefined && item['date_modified'] === undefined ? 0 : 1,
    }));
  } catch {
    return [];
  }
}

/** Parse an RSS, Atom or RDF document into the shape every audit reads. */
export function parseFeed(url: string, result: FetchResult): FeedDocument {
  const body = result.body ?? '';
  const bomOrLeadingSpace = /^[﻿\s]/.test(body) && body.trim() !== '';
  const header = headerLinks(result);
  const base: FeedDocument = {
    url,
    contentType: result.headers['content-type'] ?? result.contentType ?? '',
    declaredType: 'unknown',
    status: result.status,
    bomOrLeadingSpace,
    parsed: false,
    selfLink: header.self,
    selfLinksRaw: header.selfRaw,
    hubLinks: header.hubs,
    hubLinksRaw: header.hubsRaw,
    linksFromHeader: header.self !== '' || header.hubs.length > 0,
    lastBuild: undefined,
    entries: [],
  };

  const trimmed = body.trim();
  if (trimmed === '') return base;

  if (trimmed.startsWith('{')) {
    const entries = parseJsonFeed(url, result);
    return { ...base, declaredType: 'json', parsed: entries.length > 0, entries };
  }

  const $ = cheerio.load(trimmed, { xmlMode: true });
  const isAtom = $('feed').length > 0;
  const isRss = $('rss').length > 0 || $('rdf\\:RDF').length > 0 || $('channel').length > 0;
  if (!isAtom && !isRss) return base;

  // Header links win: WebSub gives the response headers discovery precedence,
  // and the document is read only when the headers carried nothing.
  if (base.selfLinksRaw.length === 0) {
    base.selfLinksRaw = $('link[rel="self"]')
      .toArray()
      .map((el) => $(el).attr('href') ?? '')
      .filter((href) => href !== '');
    base.selfLink = resolve(base.selfLinksRaw[0] ?? '', url);
  }
  if (base.hubLinksRaw.length === 0) {
    base.hubLinksRaw = $('link[rel="hub"]')
      .toArray()
      .map((el) => $(el).attr('href') ?? '')
      .filter((href) => href !== '');
    base.hubLinks = base.hubLinksRaw.map((href) => resolve(href, url)).filter((href) => href !== '');
  }

  if (isAtom) {
    const entries = $('entry')
      .toArray()
      .slice(0, MAX_ENTRIES)
      .map((el): FeedEntry => {
        const $entry = $(el);
        const content = $entry.children('content').first();
        const links = $entry.children('link').toArray();
        const alternate =
          links.find((l) => ($(l).attr('rel') ?? 'alternate') === 'alternate') ?? links[0];
        return {
          id: $entry.children('id').first().text().trim(),
          idIsPermalink: false,
          link: resolve(alternate ? ($(alternate).attr('href') ?? '') : '', url),
          updated: parseFeedDate(
            $entry.children('updated').first().text() || $entry.children('published').first().text(),
          ),
          title: $entry.children('title').first().text().trim(),
          summaryPresent: $entry.children('summary').first().length > 0,
          contentSrc: content.attr('src') ?? '',
          contentType: content.attr('type') ?? '',
          idCount: $entry.children('id').length,
          updatedCount: $entry.children('updated').length,
        };
      });
    return {
      ...base,
      declaredType: 'atom',
      parsed: true,
      lastBuild: parseFeedDate($('feed > updated').first().text()),
      entries,
    };
  }

  const entries = $('item')
    .toArray()
    .slice(0, MAX_ENTRIES)
    .map((el): FeedEntry => {
      const $item = $(el);
      const guid = $item.children('guid').first();
      const guidText = guid.text().trim();
      return {
        id: guidText,
        // RSS says isPermaLink defaults to true, which is why a guid that is not
        // a URL is a conformance defect rather than a style choice.
        idIsPermalink: guidText !== '' && (guid.attr('isPermaLink') ?? 'true') !== 'false',
        link: resolve($item.children('link').first().text().trim(), url),
        updated: parseFeedDate($item.children('pubDate').first().text()),
        title: $item.children('title').first().text().trim(),
        summaryPresent: $item.children('description').first().length > 0,
        contentSrc: '',
        contentType: '',
        idCount: $item.children('guid').length,
        updatedCount: $item.children('pubDate').length,
      };
    });

  return {
    ...base,
    declaredType: 'rss',
    parsed: true,
    lastBuild: parseFeedDate(
      $('channel > lastBuildDate').first().text() || $('channel > pubDate').first().text(),
    ),
    entries,
  };
}

const feedCache = new WeakMap<object, Map<string, Promise<FeedDocument | undefined>>>();

function cacheFor(ctx: object): Map<string, Promise<FeedDocument | undefined>> {
  let cache = feedCache.get(ctx);
  if (!cache) {
    cache = new Map();
    feedCache.set(ctx, cache);
  }
  return cache;
}

/**
 * Fetch and parse one feed, at most once per scan.
 *
 * Keyed on the CheckContext object, so one scan shares its feeds and two scans
 * share nothing. `isSafeUrl`-gated because feed URLs are read out of
 * site-controlled markup.
 */
export function sharedFeed(
  ctx: FeedContext,
  url: string,
  opts: { signal?: AbortSignal } = {},
): Promise<FeedDocument | undefined> {
  const cache = cacheFor(ctx);
  let pending = cache.get(url);
  if (!pending) {
    pending = (async () => {
      if (!(await isSafeUrl(url))) return undefined;
      const result = await ctx.fetch({
        url,
        followRedirects: true,
        acceptHeader: 'application/atom+xml, application/rss+xml, application/feed+json, */*',
        signal: opts.signal,
      });
      return parseFeed(url, result);
    })();
    cache.set(url, pending);
  }
  return pending;
}

/** Every discoverable feed that fetched and parsed, newest-entry data included. */
export async function sharedFeeds(
  ctx: FeedContext,
  opts: { signal?: AbortSignal; max?: number } = {},
): Promise<FeedDocument[]> {
  const urls = discoverFeedUrls(ctx).slice(0, opts.max ?? 4);
  const docs: FeedDocument[] = [];
  for (const url of urls) {
    const doc = await sharedFeed(ctx, url, opts);
    if (doc && doc.status >= 200 && doc.status < 300 && doc.parsed) docs.push(doc);
  }
  return docs;
}
