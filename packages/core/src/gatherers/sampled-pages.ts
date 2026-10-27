import { cacheOwner } from "./cache-owner";
import type { FetchOptions, FetchResult } from "#core/fetcher";
import { isSafeUrl } from "#core/fetcher";
import { LogField, withLogContext } from "#core/logger";

/** The slice of CheckContext this gatherer needs, kept structural to avoid a cycle. */
interface FetchingContext {
  fetch: (options: FetchOptions) => Promise<FetchResult>;
}

const pageCache = new WeakMap<
  object,
  Map<string, Promise<FetchResult | undefined>>
>();

/**
 * Fetch a URL a sitemap listed, at most once per scan, and return whatever
 * came back: a 200, another HTTP status, or a result with no HTTP response.
 * Undefined only for a URL that fails the SSRF gate.
 *
 * Several audits sample the same sitemap, so without this the same document is
 * pulled once per audit. Keyed on the CheckContext object, so one scan shares
 * its documents and two scans share nothing.
 */
export function fetchSampledPageResult(
  ctx: FetchingContext,
  url: string,
): Promise<FetchResult | undefined> {
  let perScan = pageCache.get(cacheOwner(ctx));
  if (!perScan) {
    perScan = new Map();
    pageCache.set(cacheOwner(ctx), perScan);
  }
  const cached = perScan.get(url);
  if (cached) return cached;

  const pending = withLogContext(
    { [LogField.Gatherer]: "sampled-pages" },
    async () => {
      if (!(await isSafeUrl(url))) return undefined;
      return ctx.fetch({ url });
    },
  );
  perScan.set(url, pending);
  return pending;
}

/**
 * {@link fetchSampledPageResult}, narrowed to a page that answered 200.
 * Undefined for any other outcome, so a caller that must tell a missing page
 * from an unread one uses the result form instead.
 */
export async function fetchSampledPage(
  ctx: FetchingContext,
  url: string,
): Promise<FetchResult | undefined> {
  const result = await fetchSampledPageResult(ctx, url);
  return result?.status === 200 ? result : undefined;
}
