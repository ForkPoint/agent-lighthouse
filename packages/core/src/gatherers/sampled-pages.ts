import type { FetchOptions, FetchResult } from "../fetcher";
import { isSafeUrl } from "../fetcher";

/** The slice of CheckContext this gatherer needs, kept structural to avoid a cycle. */
interface FetchingContext {
  fetch: (options: FetchOptions) => Promise<FetchResult>;
}

const pageCache = new WeakMap<
  object,
  Map<string, Promise<FetchResult | undefined>>
>();

/**
 * Fetch a URL a sitemap listed, at most once per scan.
 *
 * Several audits sample the same sitemap, so without this the same document is
 * pulled once per audit. Keyed on the CheckContext object, so one scan shares
 * its documents and two scans share nothing. Returns undefined for a URL that
 * fails the SSRF gate or does not answer 200.
 */
export function fetchSampledPage(
  ctx: FetchingContext,
  url: string,
): Promise<FetchResult | undefined> {
  let perScan = pageCache.get(ctx);
  if (!perScan) {
    perScan = new Map();
    pageCache.set(ctx, perScan);
  }
  const cached = perScan.get(url);
  if (cached) return cached;

  const pending = (async () => {
    if (!(await isSafeUrl(url))) return undefined;
    const result = await ctx.fetch({ url });
    return result.status === 200 ? result : undefined;
  })();
  perScan.set(url, pending);
  return pending;
}
