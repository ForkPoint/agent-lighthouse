import { createHash } from "node:crypto";
import type { FetchResult } from "./fetcher";
import {
  ORIGIN_EVIDENCE_VERSION,
  DEFAULT_ORIGIN_CACHE_TTL_MS,
  DEFAULT_ORIGIN_CACHE_MAX_ENTRIES,
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

/** Headers that make a scan authenticated. They bypass the cache and never enter a key. */
const CREDENTIAL_HEADERS = new Set([
  "authorization",
  "cookie",
  "proxy-authorization",
]);

/**
 * A short fingerprint of the request headers that shape what an origin
 * answers, so a scan under one user agent never reads what another wrote.
 * Empty when no such header is set, so the plain key stays unchanged.
 */
function headerFingerprint(headers?: Record<string, string>): string {
  if (!headers) return "";
  const lines = Object.entries(headers)
    .map(([name, value]) => [name.toLowerCase(), value] as const)
    .filter(([name]) => !CREDENTIAL_HEADERS.has(name))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([name, value]) => `${name}:${value}`);
  if (lines.length === 0) return "";
  return createHash("sha256")
    .update(lines.join("\n"))
    .digest("hex")
    .slice(0, 16);
}

/**
 * Derives a canonical anonymous origin cache key.
 *
 * Strips any userinfo/credentials from the URL so credentials never leak into
 * cache keys. Request headers other than credentials are folded in as a
 * fingerprint: a scan that sets a bot user agent must not share a slot with
 * a default scan, since the origin may answer the two differently.
 */
export function computeOriginCacheKey(
  url: string,
  version: string = ORIGIN_EVIDENCE_VERSION,
  headers?: Record<string, string>,
): string {
  const fingerprint = headerFingerprint(headers);
  const suffix = fingerprint ? `|h:${fingerprint}` : "";
  try {
    const parsed = new URL(url);
    parsed.username = "";
    parsed.password = "";
    return `${parsed.origin}|${version}${suffix}`;
  } catch {
    return `${url}|${version}${suffix}`;
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
    if (headerKeys.some((k) => CREDENTIAL_HEADERS.has(k))) return true;
  }
  return false;
}

/**
 * A bounded, TTL-evicting store of origin evidence.
 *
 * Expired entries are swept on every write, and the oldest entry is dropped
 * when the store is full, so a process that scans many origins once each
 * cannot grow without limit. A read of an expired key evicts it as well.
 */
export class OriginCache {
  private cache = new Map<
    string,
    { evidence: OriginEvidence; expiresAt: number }
  >();
  private ttlMs: number;
  private maxEntries: number;

  constructor(
    ttlMs: number = DEFAULT_ORIGIN_CACHE_TTL_MS,
    maxEntries: number = DEFAULT_ORIGIN_CACHE_MAX_ENTRIES,
  ) {
    this.ttlMs = ttlMs;
    this.maxEntries = Math.max(1, maxEntries);
  }

  /** Drop every entry whose TTL has passed. */
  sweep(now: number = Date.now()): void {
    for (const [key, entry] of this.cache) {
      if (now >= entry.expiresAt) this.cache.delete(key);
    }
  }

  get(key: string): OriginEvidence | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.evidence;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  set(key: string, evidence: OriginEvidence, ttlMs?: number): void {
    const now = Date.now();
    this.sweep(now);
    // Re-inserting moves the key to the end, so insertion order is age.
    this.cache.delete(key);
    while (this.cache.size >= this.maxEntries) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
    const expiresAt = now + (ttlMs ?? this.ttlMs);
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
