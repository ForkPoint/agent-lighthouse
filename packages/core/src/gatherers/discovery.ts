import { cacheOwner } from "./cache-owner";
import type { CheckContext } from "../check-context";
import type { FetchResult } from "../fetcher";
import { isSafeUrl } from "../fetcher";

export interface DiscoveryContext {
  fetch: CheckContext["fetch"];
}

const probeUrlCache = new WeakMap<
  object,
  Map<string, Promise<FetchResult | undefined>>
>();

/**
 * Perform a shared probe of a discovery URL (GET/HEAD), cached per scan.
 */
export function sharedProbeUrl(
  ctx: DiscoveryContext,
  url: string,
  options: {
    method?: "GET" | "HEAD" | "OPTIONS";
    followRedirects?: boolean;
    headers?: Record<string, string>;
  } = {},
): Promise<FetchResult | undefined> {
  let cache = probeUrlCache.get(cacheOwner(ctx));
  if (!cache) {
    cache = new Map();
    probeUrlCache.set(cacheOwner(ctx), cache);
  }
  const cacheKey = `${options.method ?? "GET"}|${options.followRedirects ?? false}|${url}`;
  let hit = cache.get(cacheKey);
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
    cache.set(cacheKey, hit);
  }
  return hit;
}

export async function checkEndpointStatus(
  ctx: DiscoveryContext,
  url: string,
): Promise<{ url: string; status: number }> {
  if (!(await isSafeUrl(url))) return { url, status: 0 };
  let result = await sharedProbeUrl(ctx, url, { method: "HEAD" });
  if (!result || result.status >= 400) {
    result = await sharedProbeUrl(ctx, url, { method: "GET" });
  }
  if (
    !result ||
    (result.status >= 400 && (url.includes("/mcp") || url.includes("/api/")))
  ) {
    try {
      result = await ctx.fetch({
        url,
        method: "POST",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "AgentLighthouse", version: "1.0.0" },
          },
        }),
      });
    } catch {
      // ignore
    }
  }
  return { url, status: result?.status ?? 0 };
}
