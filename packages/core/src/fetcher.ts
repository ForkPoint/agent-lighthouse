import { request, Agent, interceptors } from 'undici';
import dns from 'node:dns/promises';
import {
  SCANNER_USER_AGENT,
  REQUEST_TIMEOUT_MS,
  MAX_RESPONSE_BODY_BYTES,
} from './constants';
import { isPrivateIp } from './url-utils';
import { logger } from './logger';

const redirectAgent = new Agent().compose(interceptors.redirect({ maxRedirections: 5 }));

export interface FetchOptions {
  url: string;
  timeout?: number;
  followRedirects?: boolean;
  acceptHeader?: string;
  method?: 'GET' | 'POST' | 'OPTIONS' | 'HEAD';
  body?: string;
  contentType?: string;
  /** Override the User-Agent header (e.g. to probe a site as a specific AI bot). */
  userAgent?: string;
  /** External abort (e.g. the per-scan deadline). Combined with the per-request timeout. */
  signal?: AbortSignal;
}

export interface FetchResult {
  url: string;
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  body: string;
  ttfbMs: number;
  totalMs: number;
  contentType: string;
  contentLength: number;
  error?: string;
}

/**
 * Split HTTP basic-auth credentials out of a URL's userinfo (`user:pass@host`)
 * into an `Authorization: Basic` header, returning a credential-free URL.
 *
 * undici (like the WHATWG `fetch` spec) does NOT turn URL userinfo into an auth
 * header — it silently drops it, so auth-gated staging targets return 401 and we
 * end up scanning login/error pages. We convert it explicitly. Returning a
 * cleaned URL also keeps credentials out of logs and the stored FetchResult.
 *
 * The `@` fast-path avoids re-serializing the URL in the common (no-credentials)
 * case, which would otherwise normalize it (e.g. append a trailing slash).
 */
export function splitCredentials(rawUrl: string): { url: string; authHeader?: string } {
  if (!rawUrl.includes('@')) return { url: rawUrl };
  try {
    const parsed = new URL(rawUrl);
    if (!parsed.username && !parsed.password) return { url: rawUrl };
    // Basic auth is base64 of the *decoded* user:pass (userinfo is percent-encoded).
    const raw = `${decodeURIComponent(parsed.username)}:${decodeURIComponent(parsed.password)}`;
    const authHeader = `Basic ${Buffer.from(raw).toString('base64')}`;
    parsed.username = '';
    parsed.password = '';
    return { url: parsed.href, authHeader };
  } catch {
    // Malformed URL — let request() surface the error.
    return { url: rawUrl };
  }
}

/**
 * Extract a stable error code from a thrown value. undici surfaces the real
 * reason for a `TypeError: fetch failed` / generic error under `err.cause.code`
 * (e.g. ENOTFOUND, ECONNREFUSED, UND_ERR_CONNECT_TIMEOUT, CERT_HAS_EXPIRED);
 * without it the logs just say "fetch failed" and are undiagnosable.
 */
function errorCode(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const e = err as { code?: unknown; cause?: { code?: unknown } };
  const code = e.cause?.code ?? e.code;
  return typeof code === 'string' ? code : undefined;
}

/**
 * Validates that a URL is safe to fetch (http/https scheme, non-private IP).
 * Use before fetching any URL extracted from scanned site content.
 */
export async function isSafeUrl(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return false;
    if (isPrivateIp(hostname)) return false;
    const { address } = await dns.lookup(hostname);
    return !isPrivateIp(address);
  } catch {
    return false;
  }
}

export function createFetcher() {
  async function fetch(options: FetchOptions): Promise<FetchResult> {
    const {
      url,
      timeout = REQUEST_TIMEOUT_MS,
      acceptHeader = '*/*',
      method = 'GET',
      body: requestBody,
      contentType,
      userAgent,
      signal: externalSignal,
    } = options;

    // Per-request timeout, plus the caller's deadline if supplied — whichever
    // fires first aborts the request.
    const timeoutSignal = AbortSignal.timeout(timeout);
    const signal = externalSignal
      ? AbortSignal.any([timeoutSignal, externalSignal])
      : timeoutSignal;

    // Pull any `user:pass@` out of the URL into an Authorization header, and use
    // the credential-free URL for the request, logs, and returned result.
    const { url: targetUrl, authHeader } = splitCredentials(url);

    const start = performance.now();
    let ttfbMs = 0;

    try {
      const reqHeaders: Record<string, string> = {
        'User-Agent': userAgent ?? SCANNER_USER_AGENT,
        Accept: acceptHeader,
      };

      if (authHeader) {
        reqHeaders['Authorization'] = authHeader;
      }

      if (method === 'POST' && contentType) {
        reqHeaders['Content-Type'] = contentType;
      }

      logger.debug({ url: targetUrl, method }, `[fetcher] Starting fetch: ${method} ${targetUrl}`);

      const response = await request(targetUrl, {
        method,
        headers: reqHeaders,
        body: requestBody,
        signal,
        dispatcher: redirectAgent,
      });

      ttfbMs = performance.now() - start;

      let body = '';
      if (method !== 'OPTIONS') {
        body = await response.body.text();
      } else {
        // For OPTIONS requests, consume and discard the body
        await response.body.dump();
      }
      const totalMs = performance.now() - start;

      logger.debug(
        { url: targetUrl, status: response.statusCode, totalMs: Math.round(totalMs) },
        `[fetcher] Fetch complete: ${targetUrl} (${response.statusCode}) in ${Math.round(totalMs)}ms`,
      );

      const truncatedBody =
        body.length > MAX_RESPONSE_BODY_BYTES ? body.slice(0, MAX_RESPONSE_BODY_BYTES) : body;

      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(response.headers)) {
        if (typeof value === 'string') {
          headers[key.toLowerCase()] = value;
        }
      }

      return {
        url: targetUrl,
        finalUrl: targetUrl, // undici doesn't expose final URL after redirects easily
        status: response.statusCode,
        headers,
        body: truncatedBody,
        ttfbMs: Math.round(ttfbMs),
        totalMs: Math.round(totalMs),
        contentType: headers['content-type'] ?? '',
        contentLength: truncatedBody.length,
      };
    } catch (err) {
      const totalMs = performance.now() - start;
      const message = err instanceof Error ? err.message : 'Unknown fetch error';
      // Surface undici's underlying cause (ENOTFOUND, ECONNREFUSED, timeout, TLS…)
      // so an opaque "fetch failed" becomes diagnosable in the logs.
      const code = errorCode(err);
      const detail = code ? `${message} (${code})` : message;

      logger.error(
        { url: targetUrl, err, code, totalMs: Math.round(totalMs) },
        `[fetcher] Fetch error: ${targetUrl} - ${detail}`,
      );

      return {
        url: targetUrl,
        finalUrl: targetUrl,
        status: 0,
        headers: {},
        body: '',
        ttfbMs: Math.round(ttfbMs || totalMs),
        totalMs: Math.round(totalMs),
        contentType: '',
        contentLength: 0,
        error: detail,
      };
    }
  }

  return { fetch };
}
