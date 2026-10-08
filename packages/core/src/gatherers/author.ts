import { cacheOwner } from "./cache-owner";
import type { CheckContext } from "../check-context";
import type { FetchResult } from "../fetcher";
import { isSafeUrl } from "../fetcher";
import { HttpMethod } from "../types";

const authorProbeCache = new WeakMap<
  object,
  Map<string, Promise<FetchResult | undefined>>
>();

export function probeAuthorUrl(
  ctx: { fetch: CheckContext["fetch"] },
  url: string,
  options: {
    method?: HttpMethod;
    followRedirects?: boolean;
    headers?: Record<string, string>;
  } = {},
): Promise<FetchResult | undefined> {
  let cache = authorProbeCache.get(cacheOwner(ctx));
  if (!cache) {
    cache = new Map();
    authorProbeCache.set(cacheOwner(ctx), cache);
  }
  const key = `${options.method ?? "GET"}|${options.followRedirects ?? false}|${url}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = (async () => {
      if (!(await isSafeUrl(url))) return undefined;
      try {
        return await ctx.fetch({
          url,
          method: options.method ?? HttpMethod.Get,
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
