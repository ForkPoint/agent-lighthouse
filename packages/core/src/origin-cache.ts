import type { FetchResult } from "./fetcher";
import {
  ORIGIN_EVIDENCE_VERSION,
  DEFAULT_ORIGIN_CACHE_TTL_MS,
} from "./constants";
export interface OriginCacheOptions {
  bypassOriginCache?: boolean;
  headers?: Record<string, string>;
}

export interface OriginEvidence {
  origin: string;
  version: string;
  readAt: string; // ISO timestamp
  rootFiles: Record<string, FetchResult>;
  originHomepage?: FetchResult;
}

/**
 * Derives a canonical anonymous origin cache key.
 * Strips any userinfo/credentials from the URL so credentials never leak into cache keys.
 */
export function computeOriginCacheKey(
  url: string,
  version: string = ORIGIN_EVIDENCE_VERSION,
): string {
  try {
    const parsed = new URL(url);
    parsed.username = "";
    parsed.password = "";
    return `${parsed.origin}|${version}`;
  } catch {
    return `${url}|${version}`;
  }
}

/**
 * Determines whether the scan must bypass the shared origin cache.
 * Authenticated scans (URL credentials, Authorization header, cookies) or explicit bypass flags bypass the shared cache.
 */
export function shouldBypassOriginCache(
  url: string,
  options?: OriginCacheOptions,
): boolean {
  if (options?.bypassOriginCache) return true;
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password) return true;
  } catch {
    // ignore
  }
  if (options?.headers) {
    const headerKeys = Object.keys(options.headers).map((k) => k.toLowerCase());
    if (
      headerKeys.includes("authorization") ||
      headerKeys.includes("cookie") ||
      headerKeys.includes("proxy-authorization")
    ) {
      return true;
    }
  }
  return false;
}

export class OriginCache {
  private cache = new Map<
    string,
    { evidence: OriginEvidence; expiresAt: number }
  >();
  private ttlMs: number;

  constructor(ttlMs: number = DEFAULT_ORIGIN_CACHE_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  get(key: string): OriginEvidence | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.evidence;
  }

  set(key: string, evidence: OriginEvidence, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs ?? this.ttlMs);
    this.cache.set(key, { evidence, expiresAt });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

export const defaultOriginCache = new OriginCache();
