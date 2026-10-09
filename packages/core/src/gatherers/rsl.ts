import { cacheOwner } from "./cache-owner";
import type { CheckContext } from "#core/check-context";
import type { FetchResult } from "#core/fetcher";
import { isSafeUrl } from "#core/fetcher";
import { HttpMethod } from "#core/types";

const rslProbeCache = new WeakMap<
  object,
  Map<string, Promise<FetchResult | undefined>>
>();

export function probeRsl(
  ctx: { fetch: CheckContext["fetch"] },
  url: string,
  options: { method?: HttpMethod; followRedirects?: boolean } = {},
): Promise<FetchResult | undefined> {
  let cache = rslProbeCache.get(cacheOwner(ctx));
  if (!cache) {
    cache = new Map();
    rslProbeCache.set(cacheOwner(ctx), cache);
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
        });
      } catch {
        return undefined;
      }
    })();
    cache.set(key, hit);
  }
  return hit;
}
