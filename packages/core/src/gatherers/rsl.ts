import type { CheckContext } from '../check-context';
import type { FetchResult } from '../fetcher';
import { isSafeUrl } from '../fetcher';

const rslProbeCache = new WeakMap<object, Map<string, Promise<FetchResult | undefined>>>();

export function probeRsl(
  ctx: { fetch: CheckContext['fetch'] },
  url: string,
  options: { method?: 'GET' | 'HEAD'; followRedirects?: boolean } = {},
): Promise<FetchResult | undefined> {
  let cache = rslProbeCache.get(ctx);
  if (!cache) {
    cache = new Map();
    rslProbeCache.set(ctx, cache);
  }
  const key = `${options.method ?? 'GET'}|${options.followRedirects ?? false}|${url}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = (async () => {
      if (!(await isSafeUrl(url))) return undefined;
      try {
        return await ctx.fetch({
          url,
          method: options.method ?? 'GET',
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
