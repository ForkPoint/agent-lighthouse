import type { CheckContext } from '../check-context';
import type { FetchResult } from '../fetcher';
import { isSafeUrl } from '../fetcher';

const securityProbeCache = new WeakMap<object, Map<string, Promise<FetchResult | undefined>>>();

export function probeSecurityUrl(
  ctx: { fetch: CheckContext['fetch'] },
  url: string,
  options: {
    method?: 'GET' | 'POST' | 'HEAD' | 'OPTIONS';
    followRedirects?: boolean;
    userAgent?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {},
): Promise<FetchResult | undefined> {
  let cache = securityProbeCache.get(ctx);
  if (!cache) {
    cache = new Map();
    securityProbeCache.set(ctx, cache);
  }
  const key = `${options.method ?? 'GET'}|${options.userAgent ?? ''}|${JSON.stringify(options.headers ?? {})}|${url}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = (async () => {
      if (!(await isSafeUrl(url))) return undefined;
      try {
        return await ctx.fetch({
          url,
          method: options.method ?? 'GET',
          followRedirects: options.followRedirects ?? false,
          ...(options.userAgent ? { userAgent: options.userAgent } : {}),
          ...(options.headers ? { headers: options.headers } : {}),
          ...(options.body ? { body: options.body } : {}),
        });
      } catch {
        return undefined;
      }
    })();
    cache.set(key, hit);
  }
  return hit;
}
