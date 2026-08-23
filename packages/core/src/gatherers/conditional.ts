import { createHash } from 'node:crypto';
import type { FetchOptions, FetchResult } from '../fetcher';
import { isSafeUrl } from '../fetcher';

/**
 * The conditional-request probe, once per URL per scan.
 *
 * An agent that polls a sitemap or a feed for changes pays for the whole
 * document on every poll unless the origin answers `If-None-Match` or
 * `If-Modified-Since` with a 304. Whether it does is not visible from one
 * request, so this gatherer makes up to four and reports what happened.
 */

export interface RevalidationResult {
  url: string;
  status: number;
  etag: string;
  lastModified: string;
  cacheControl: string;
  /** Decoded body length of the first GET — what one poll costs today. */
  bytes: number;
  /** The second GET returned the same body. */
  bodyStable: boolean;
  /** ...and the same `ETag`. A changing validator over a stable body is a bug. */
  etagStable: boolean;
  /** `undefined` when no `ETag` was emitted, so nothing could be asked. */
  honoursIfNoneMatch: boolean | undefined;
  /** `undefined` when no `Last-Modified` was emitted. */
  honoursIfModifiedSince: boolean | undefined;
  /** Requests actually sent, so a caller can report the probe's own cost. */
  requests: number;
}

/** The slice of CheckContext this gatherer needs, kept structural to avoid a cycle. */
interface RevalidationContext {
  fetch: (options: FetchOptions) => Promise<FetchResult>;
}

const hash = (body: string) => createHash('sha256').update(body).digest('hex');

const cache = new WeakMap<object, Map<string, Promise<RevalidationResult | undefined>>>();

function cacheFor(ctx: object): Map<string, Promise<RevalidationResult | undefined>> {
  let map = cache.get(ctx);
  if (!map) {
    map = new Map();
    cache.set(ctx, map);
  }
  return map;
}

async function probe(
  ctx: RevalidationContext,
  url: string,
  signal: AbortSignal | undefined,
): Promise<RevalidationResult | undefined> {
  if (!(await isSafeUrl(url))) return undefined;

  const first = await ctx.fetch({ url, followRedirects: true, signal });
  if (first.status < 200 || first.status >= 300) return undefined;

  const etag = first.headers['etag'] ?? '';
  const lastModified = first.headers['last-modified'] ?? '';
  let requests = 1;

  // The second GET is identical to the first, including how it negotiates
  // encoding, so a differing ETag is the origin's instability and not ours.
  const second = await ctx.fetch({ url, followRedirects: true, signal });
  requests += 1;
  const bodyStable = hash(first.body) === hash(second.body);
  const etagStable = (second.headers['etag'] ?? '') === etag;

  let honoursIfNoneMatch: boolean | undefined;
  if (etag !== '') {
    const conditional = await ctx.fetch({
      url,
      followRedirects: true,
      headers: { 'If-None-Match': etag },
      signal,
    });
    requests += 1;
    honoursIfNoneMatch = conditional.status === 304;
  }

  let honoursIfModifiedSince: boolean | undefined;
  if (lastModified !== '') {
    const conditional = await ctx.fetch({
      url,
      followRedirects: true,
      headers: { 'If-Modified-Since': lastModified },
      signal,
    });
    requests += 1;
    honoursIfModifiedSince = conditional.status === 304;
  }

  return {
    url,
    status: first.status,
    etag,
    lastModified,
    cacheControl: first.headers['cache-control'] ?? '',
    bytes: first.body.length,
    bodyStable,
    etagStable,
    honoursIfNoneMatch,
    honoursIfModifiedSince,
    requests,
  };
}

/**
 * Probe one URL's revalidation behaviour, memoised for the life of one scan.
 *
 * Costs at most four requests per URL, and only for URLs the site itself
 * advertises as discovery surfaces.
 */
export function sharedRevalidation(
  ctx: RevalidationContext,
  url: string,
  opts: { signal?: AbortSignal } = {},
): Promise<RevalidationResult | undefined> {
  const map = cacheFor(ctx);
  let pending = map.get(url);
  if (!pending) {
    pending = probe(ctx, url, opts.signal);
    map.set(url, pending);
  }
  return pending;
}
