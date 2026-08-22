import * as cheerio from 'cheerio';
import type { FetchOptions, FetchResult } from '../fetcher';
import { isSafeUrl } from '../fetcher';
import { parseRobotsFile } from './robots';

/** One `<url>` row of a sitemap. */
export interface SitemapEntry {
  loc: string;
  lastmod?: string;
}

/** The result of walking a site's advertised sitemap roots. */
export interface SitemapTree {
  entries: SitemapEntry[];
  /** Child sitemaps actually fetched, in order. Empty for a flat sitemap. */
  childSitemaps: string[];
  /** How many `<lastmod>` values failed the W3C Datetime shape. */
  malformedLastmod: number;
  /** True when a cap stopped the walk, so `entries` is not the whole tree. */
  truncated: boolean;
}

/** How many child sitemaps a `<sitemapindex>` may expand to. */
const DEFAULT_MAX_CHILDREN = 5;
/** How many `<url>` rows to collect in total across the whole tree. */
const DEFAULT_MAX_ENTRIES = 500;

/**
 * Does this value parse as a W3C Datetime, the format the sitemap protocol
 * requires of `<lastmod>`?
 *
 * Accepts the date-only `YYYY-MM-DD` form and the full RFC 3339 timestamp.
 * Deliberately strict about the shape before handing anything to `Date`, which
 * would happily accept `1755859200` (epoch seconds, a common CMS bug) and
 * every prose string a locale parser recognises.
 */
export function isW3CDateTime(value: string): boolean {
  const shape = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?$/;
  if (!shape.test(value)) return false;
  // The shape admits 2026-13-01; only a real parse rejects it.
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  // Round-trip the date part so an out-of-range month or day is caught rather
  // than silently rolled forward.
  return parsed.toISOString().slice(0, 10) === value.slice(0, 10) || value.length > 10;
}

/** Same host, exactly — a sitemap index may not hand us another origin's URLs. */
function sameHost(candidate: string, reference: string): boolean {
  try {
    return new URL(candidate).host === new URL(reference).host;
  } catch {
    return false;
  }
}

interface ParsedSitemap {
  kind: 'urlset' | 'sitemapindex' | 'none';
  entries: SitemapEntry[];
  children: string[];
}

function parseSitemap(result: FetchResult | undefined): ParsedSitemap {
  const empty: ParsedSitemap = { kind: 'none', entries: [], children: [] };
  if (!result || result.status !== 200 || !result.body.trim()) return empty;

  const $ = cheerio.load(result.body, { xmlMode: true });
  if ($('sitemapindex').length > 0) {
    const children: string[] = [];
    $('sitemapindex > sitemap > loc').each((_, el) => {
      const loc = $(el).text().trim();
      if (loc) children.push(loc);
    });
    return { kind: 'sitemapindex', entries: [], children };
  }
  if ($('urlset').length > 0) {
    const entries: SitemapEntry[] = [];
    $('urlset > url').each((_, el) => {
      const loc = $(el).find('loc').first().text().trim();
      if (!loc) return;
      const lastmod = $(el).find('lastmod').first().text().trim();
      entries.push(lastmod ? { loc, lastmod } : { loc });
    });
    return { kind: 'urlset', entries, children: [] };
  }
  return empty;
}

/**
 * Walk a site's sitemap roots and collect their `<url>` rows.
 *
 * Recursion stops after one level of `<sitemapindex>`: the depth of a nested
 * index is chosen by the site being scanned, so following it arbitrarily is an
 * unbounded walk driven by untrusted input. Every child URL is `isSafeUrl`- and
 * same-host-gated before it is fetched, for the same reason.
 */
export async function collectSitemapEntries(
  fetch: (options: FetchOptions) => Promise<FetchResult>,
  roots: string[],
  opts: { maxChildren?: number; maxEntries?: number; signal?: AbortSignal } = {},
): Promise<SitemapTree> {
  const maxChildren = opts.maxChildren ?? DEFAULT_MAX_CHILDREN;
  const maxEntries = opts.maxEntries ?? DEFAULT_MAX_ENTRIES;

  const entries: SitemapEntry[] = [];
  const childSitemaps: string[] = [];
  const fetched = new Set<string>();
  let malformedLastmod = 0;
  let truncated = false;

  const take = (found: SitemapEntry[]) => {
    for (const entry of found) {
      if (entries.length >= maxEntries) {
        truncated = true;
        return;
      }
      if (entry.lastmod && !isW3CDateTime(entry.lastmod)) malformedLastmod += 1;
      entries.push(entry);
    }
  };

  const load = async (url: string): Promise<ParsedSitemap | undefined> => {
    if (fetched.has(url)) return undefined;
    fetched.add(url);
    if (!(await isSafeUrl(url))) return undefined;
    return parseSitemap(await fetch({ url, signal: opts.signal }));
  };

  for (const root of roots) {
    const parsed = await load(root);
    if (!parsed) continue;

    take(parsed.entries);

    for (const child of parsed.children) {
      if (childSitemaps.length >= maxChildren) {
        truncated = true;
        break;
      }
      if (!sameHost(child, root)) continue;
      const childParsed = await load(child);
      if (!childParsed) continue;
      childSitemaps.push(child);
      // One level only: a `sitemapindex` found here is not expanded.
      take(childParsed.entries);
    }
  }

  return { entries, childSitemaps, malformedLastmod, truncated };
}

/**
 * Take an even-strided sample of `n` entries.
 *
 * Deterministic rather than random: two audits sampling the same tree must
 * probe the same URLs, or a finding from one cannot be lined up against a
 * finding from the other.
 */
export function sampleEntries(entries: SitemapEntry[], n: number): SitemapEntry[] {
  if (n <= 0) return [];
  if (entries.length <= n) return [...entries];
  const stride = entries.length / n;
  const out: SitemapEntry[] = [];
  for (let i = 0; i < n; i += 1) out.push(entries[Math.floor(i * stride)]!);
  return out;
}

/** The sitemap roots a site advertises, plus the two conventional paths. */
function siteRoots(ctx: SitemapContext): string[] {
  const robots = ctx.rootFiles['/robots.txt'];
  const declared = robots && robots.status === 200 ? parseRobotsFile(robots.body).sitemaps : [];
  let baseHost: string;
  try {
    baseHost = new URL(ctx.baseUrl).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return [];
  }

  const out: string[] = [];
  for (const raw of [...declared, `${ctx.baseUrl}/sitemap.xml`, `${ctx.baseUrl}/sitemap_index.xml`]) {
    let url: URL;
    try {
      url = new URL(raw, ctx.baseUrl);
    } catch {
      continue;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    // An off-site sitemap is not this site's to walk, and following it would
    // turn a site-scoped scan into a crawl of somebody else's host.
    if (host !== baseHost && !host.endsWith(`.${baseHost}`)) continue;
    const href = url.toString();
    if (!out.includes(href)) out.push(href);
  }
  return out;
}

/** The slice of CheckContext this gatherer needs, kept structural to avoid a cycle. */
interface SitemapContext {
  rootFiles: Record<string, FetchResult>;
  baseUrl: string;
  fetch: (options: FetchOptions) => Promise<FetchResult>;
}

const treeCache = new WeakMap<object, Promise<SitemapTree>>();

/**
 * The site's sitemap tree, walked once per scan.
 *
 * Three audits need the same tree, and a sitemap index expands to several
 * requests. Keyed on the CheckContext object, so every audit in one scan shares
 * one walk and two scans never share anything.
 */
export function siteSitemapTree(ctx: SitemapContext): Promise<SitemapTree> {
  const cached = treeCache.get(ctx);
  if (cached) return cached;
  const walk = collectSitemapEntries(ctx.fetch, siteRoots(ctx));
  treeCache.set(ctx, walk);
  return walk;
}
