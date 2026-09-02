import type { CheckContext } from "../check-context";
import type { FetchResult } from "../fetcher";
import { isSafeUrl } from "../fetcher";

const authorProbeCache = new WeakMap<
  object,
  Map<string, Promise<FetchResult | undefined>>
>();

export function probeAuthorUrl(
  ctx: { fetch: CheckContext["fetch"] },
  url: string,
  options: {
    method?: "GET" | "HEAD";
    followRedirects?: boolean;
    headers?: Record<string, string>;
  } = {},
): Promise<FetchResult | undefined> {
  let cache = authorProbeCache.get(ctx);
  if (!cache) {
    cache = new Map();
    authorProbeCache.set(ctx, cache);
  }
  const key = `${options.method ?? "GET"}|${options.followRedirects ?? false}|${url}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = (async () => {
      if (!(await isSafeUrl(url))) return undefined;
      try {
        return await ctx.fetch({
          url,
          method: options.method ?? "GET",
          followRedirects: options.followRedirects ?? false,
          ...(options.headers ? { headers: options.headers } : {}),
        });
      } catch {
        return undefined;
      }
    })();
    cache.set(key, hit);
  }
  return hit;
}
