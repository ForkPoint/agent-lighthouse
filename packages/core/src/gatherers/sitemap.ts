import { cacheOwner } from "./cache-owner";
import * as cheerio from "cheerio";
import type { FetchOptions, FetchResult } from "../fetcher";
import { isSafeUrl } from "../fetcher";
import { parseRobotsFile } from "./robots";

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
  /** Sitemap files that answered 200 and parsed as a urlset or sitemapindex. */
  readableFiles: string[];
  /** Sitemap files that answered 200 but were neither. A soft-404 lands here. */
  malformedFiles: string[];
}

/** How many child sitemaps a `<sitemapindex>` may expand to. */
const DEFAULT_MAX_CHILDREN = 10;
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
  const shape =
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?$/;
  if (!shape.test(value)) return false;
  // The shape admits 2026-13-01; only a real parse rejects it.
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  // Round-trip the date part so an out-of-range month or day is caught rather
  // than silently rolled forward.
  return (
    parsed.toISOString().slice(0, 10) === value.slice(0, 10) ||
    value.length > 10
  );
}

/**
 * Same site host or subdomain — a sitemap index may not hand us another
 * origin's URLs.
 *
 * A parent domain is not the same site. On a shared suffix such as
 * `github.io` or `myshopify.com` the parent belongs to a different party, so
 * `foo.github.io` may not pull in a sitemap from `github.io`.
 */
function sameHost(candidate: string, reference: string): boolean {
  try {
    const candHost = new URL(candidate).hostname
      .toLowerCase()
      .replace(/^www\./, "");
    const refHost = new URL(reference).hostname
      .toLowerCase()
      .replace(/^www\./, "");
    return candHost === refHost || candHost.endsWith(`.${refHost}`);
  } catch {
    return false;
  }
}

interface ParsedSitemap {
  kind: "urlset" | "sitemapindex" | "none";
  entries: SitemapEntry[];
  children: string[];
}

function parseSitemap(result: FetchResult | undefined): ParsedSitemap {
  const empty: ParsedSitemap = { kind: "none", entries: [], children: [] };
  if (!result || result.status !== 200 || !result.body.trim()) return empty;

  const $ = cheerio.load(result.body, { xmlMode: true });
  if ($("sitemapindex").length > 0) {
    const children: string[] = [];
    $("sitemapindex > sitemap > loc").each((_, el) => {
      const loc = $(el).text().trim();
      if (loc) children.push(loc);
    });
    return { kind: "sitemapindex", entries: [], children };
  }
  if ($("urlset").length > 0) {
    const entries: SitemapEntry[] = [];
    $("urlset > url").each((_, el) => {
      const loc = $(el).find("loc").first().text().trim();
      if (!loc) return;
      const lastmod = $(el).find("lastmod").first().text().trim();
      entries.push(lastmod ? { loc, lastmod } : { loc });
    });
    return { kind: "urlset", entries, children: [] };
  }
  return empty;
}

/**
 * Walk a site's sitemap roots and collect their `<url>` rows.
 *
 * Every root in `roots` is read: a robots.txt that declares three sitemaps
 * has three, and stopping at the first would judge a third of the site as
 * the whole. `fallbackRoots` are the conventional paths, probed in order only
 * when no declared root parsed, and the first one that does ends the probe.
 *
 * Recursion stops after one level of `<sitemapindex>`: the depth of a nested
 * index is chosen by the site being scanned, so following it arbitrarily is an
 * unbounded walk driven by untrusted input. Every child URL is `isSafeUrl`- and
 * same-host-gated before it is fetched, for the same reason.
 */
export async function collectSitemapEntries(
  fetch: (options: FetchOptions) => Promise<FetchResult>,
  roots: string[],
  opts: {
    maxChildren?: number;
    maxEntries?: number;
    signal?: AbortSignal;
    fallbackRoots?: string[];
  } = {},
): Promise<SitemapTree> {
  const maxChildren = opts.maxChildren ?? DEFAULT_MAX_CHILDREN;
  const maxEntries = opts.maxEntries ?? DEFAULT_MAX_ENTRIES;

  const entries: SitemapEntry[] = [];
  const childSitemaps: string[] = [];
  const readableFiles: string[] = [];
  const malformedFiles: string[] = [];
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
    const result = await fetch({ url, signal: opts.signal });
    const parsed = parseSitemap(result);
    // A file that answered 200 with a body and still did not parse is
    // present and broken. That is a finding, not an absence, so it is kept
    // apart from a 404 for `readSitemap` to name.
    if (parsed.kind !== "none") readableFiles.push(url);
    else if (result.status === 200 && result.body.trim()) {
      malformedFiles.push(url);
    }
    return parsed;
  };

  /** Read one root and its children. True when the root was a sitemap. */
  const walkRoot = async (root: string): Promise<boolean> => {
    const parsed = await load(root);
    if (!parsed || parsed.kind === "none") return false;

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
    return true;
  };

  let found = false;
  for (const root of roots) {
    if (entries.length >= maxEntries) break;
    if (await walkRoot(root)) found = true;
  }

  // The conventional paths are guesses, so the first one that answers is
  // taken as the site's sitemap and the rest are left alone.
  if (!found) {
    for (const root of opts.fallbackRoots ?? []) {
      if (await walkRoot(root)) break;
    }
  }

  return {
    entries,
    childSitemaps,
    malformedLastmod,
    truncated,
    readableFiles,
    malformedFiles,
  };
}

/**
 * Take an even-strided sample of `n` entries.
 *
 * Deterministic rather than random: two audits sampling the same tree must
 * probe the same URLs, or a finding from one cannot be lined up against a
 * finding from the other.
 */
export function sampleEntries(
  entries: SitemapEntry[],
  n: number,
): SitemapEntry[] {
  if (n <= 0) return [];
  if (entries.length <= n) return [...entries];
  const stride = entries.length / n;
  const out: SitemapEntry[] = [];
  for (let i = 0; i < n; i += 1) out.push(entries[Math.floor(i * stride)]!);
  return out;
}

/** Where a sitemap file is looked for when robots.txt declares none. */
const FALLBACK_SITEMAP_PATHS = [
  "/sitemap.xml",
  "/sitemap-index.xml",
  "/sitemap_index.xml",
];

/**
 * The sitemap roots a site advertises, and the conventional paths to probe
 * when it advertises none that answer.
 */
function siteRoots(ctx: SitemapContext): {
  declared: string[];
  fallbacks: string[];
} {
  const robots = ctx.rootFiles["/robots.txt"];
  const declared =
    robots && robots.status === 200
      ? parseRobotsFile(robots.body).sitemaps
      : [];
  let baseHost: string;
  try {
    baseHost = new URL(ctx.baseUrl).hostname
      .toLowerCase()
      .replace(/^www\./, "");
  } catch {
    return { declared: [], fallbacks: [] };
  }

  const onSite = (raws: string[]): string[] => {
    const out: string[] = [];
    for (const raw of raws) {
      let url: URL;
      try {
        url = new URL(raw, ctx.baseUrl);
      } catch {
        continue;
      }
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      // An off-site sitemap is not this site's to walk, and following it
      // would turn a site-scoped scan into a crawl of somebody else's host.
      if (host !== baseHost && !host.endsWith(`.${baseHost}`)) continue;
      const href = url.toString();
      if (!out.includes(href)) out.push(href);
    }
    return out;
  };

  return {
    declared: onSite(declared),
    fallbacks: onSite(FALLBACK_SITEMAP_PATHS.map((p) => `${ctx.baseUrl}${p}`)),
  };
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
  const cached = treeCache.get(cacheOwner(ctx));
  if (cached) return cached;
  const { declared, fallbacks } = siteRoots(ctx);
  const walk = collectSitemapEntries(ctx.fetch, declared, {
    fallbackRoots: fallbacks,
  });
  treeCache.set(cacheOwner(ctx), walk);
  return walk;
}

export const NO_SITEMAP = "No readable sitemap found.";

export type SitemapReadResult =
  | { kind: "absent"; reason: string }
  | { kind: "empty"; reason: string; result?: FetchResult }
  | { kind: "malformed"; reason: string; result?: FetchResult }
  | {
      kind: "readable";
      tree: SitemapTree;
      result?: FetchResult;
      defects: string[];
    };

const readResultCache = new WeakMap<object, Promise<SitemapReadResult>>();

/** The conventional sitemap file the orchestrator fetched, if it answered 200. */
function servedSitemapFile(ctx: SitemapContext): FetchResult | undefined {
  for (const path of FALLBACK_SITEMAP_PATHS) {
    const file = ctx.rootFiles[path];
    if (file && file.status === 200) return file;
  }
  return undefined;
}

/**
 * Perform a four-way read of the site's sitemap.
 *
 * Returns ABSENT when no sitemap file is served, EMPTY when a sitemap has no
 * entries, MALFORMED when a sitemap file exists but has invalid XML structure,
 * or READABLE with the parsed tree.
 *
 * Absent means absent. The verdict follows the walk, which read every file
 * robots.txt declared and probed the conventional paths, not one root file:
 * a site whose only sitemap is a broken `/sitemap-index.xml`, or a broken
 * file named in robots.txt, is told it is broken, not that it has none.
 */
export async function readSitemap(
  ctx: SitemapContext,
): Promise<SitemapReadResult> {
  const cached = readResultCache.get(cacheOwner(ctx));
  if (cached) return cached;

  const promise = (async (): Promise<SitemapReadResult> => {
    const sitemapFile = servedSitemapFile(ctx);
    const tree = await siteSitemapTree(ctx);

    if (tree.entries.length === 0 && tree.childSitemaps.length === 0) {
      if (tree.readableFiles.length > 0) {
        return { kind: "empty", reason: NO_SITEMAP, result: sitemapFile };
      }
      if (tree.malformedFiles.length > 0) {
        return {
          kind: "malformed",
          reason:
            "Sitemap file found but does not contain valid <urlset> or <sitemapindex>.",
          result: sitemapFile,
        };
      }
      return { kind: "absent", reason: NO_SITEMAP };
    }

    const defects: string[] = [];
    if (tree.malformedLastmod > 0) {
      defects.push(
        `${tree.malformedLastmod} <lastmod> date(s) fail W3C Datetime shape.`,
      );
    }

    return { kind: "readable", tree, result: sitemapFile, defects };
  })();

  readResultCache.set(cacheOwner(ctx), promise);
  return promise;
}
