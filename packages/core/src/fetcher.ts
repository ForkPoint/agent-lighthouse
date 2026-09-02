import { request, Agent, type Dispatcher } from "undici";
import dns from "node:dns/promises";
import {
  SCANNER_USER_AGENT,
  REQUEST_TIMEOUT_MS,
  MAX_RESPONSE_BODY_BYTES,
} from "./constants";
import { isPrivateIp } from "./url-utils";
import { logger } from "./logger";

export async function isSafeUrl(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
      return false;
    const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1"
    )
      return false;
    if (isPrivateIp(hostname)) return false;
    const { address } = await dns.lookup(hostname);
    return !isPrivateIp(address);
  } catch {
    return false;
  }
}

/**
 * The default dispatcher. Redirects are walked by hand below rather than by
 * undici's interceptor, so every hop passes the isSafeUrl gate.
 */
const noRedirectAgent = new Agent();

/** How many hops a redirect chain may take before we give up. */
const MAX_REDIRECTS = 5;
/** Statuses that carry a Location a client is expected to follow. */
const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);

export interface FetchOptions {
  url: string;
  timeout?: number;
  followRedirects?: boolean;
  acceptHeader?: string;
  method?: "GET" | "POST" | "OPTIONS" | "HEAD" | "DELETE";
  body?: string;
  contentType?: string;
  /** Override the User-Agent header (e.g. to probe a site as a specific AI bot). */
  userAgent?: string;
  /**
   * Extra request headers (e.g. `MCP-Protocol-Version`). Applied before the
   * fetcher's own headers, so a caller can add headers but cannot clobber the
   * scanner User-Agent, the negotiated Accept, or credentials lifted out of the
   * URL's userinfo.
   */
  headers?: Record<string, string>;
  /** External abort (e.g. the per-scan deadline). Combined with the per-request timeout. */
  signal?: AbortSignal;
  /**
   * Read the response as bytes instead of text.
   *
   * `body` is a UTF-8 decoded string, which replaces every invalid sequence
   * with U+FFFD — fatal for an image, whose provenance metadata is binary. With
   * this flag the response arrives in `bytes` and `body` stays empty.
   */
  binary?: boolean;
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
  /** Raw response bytes. Present only when the request asked for `binary`. */
  bytes?: Uint8Array;
  /**
   * Every redirect hop the fetcher walked, in order. Absent when the caller
   * disabled redirects or the response was not a redirect.
   *
   * `finalUrl` alone cannot say whether a host change was permanent. A scan
   * has to tell a domain migration (301/308) from a temporary hop to somebody
   * else's domain, so the status of each hop is kept.
   */
  redirectChain?: Array<{ status: number; from: string; to: string }>;
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
export function splitCredentials(rawUrl: string): {
  url: string;
  authHeader?: string;
} {
  if (!rawUrl.includes("@")) return { url: rawUrl };
  try {
    const parsed = new URL(rawUrl);
    if (!parsed.username && !parsed.password) return { url: rawUrl };
    // Basic auth is base64 of the *decoded* user:pass (userinfo is percent-encoded).
    const raw = `${decodeURIComponent(parsed.username)}:${decodeURIComponent(parsed.password)}`;
    const authHeader = `Basic ${Buffer.from(raw).toString("base64")}`;
    parsed.username = "";
    parsed.password = "";
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
  if (typeof err !== "object" || err === null) return undefined;
  const e = err as { code?: unknown; cause?: { code?: unknown } };
  const code = e.cause?.code ?? e.code;
  return typeof code === "string" ? code : undefined;
}

export interface FetcherOptions {
  /**
   * undici dispatcher for every request this fetcher makes.
   *
   * Omitted, requests go through a shared `new Agent()` whose per-origin
   * connection count is unlimited — right for a site owner scanning their own
   * site, who wants the scan over quickly. A caller scanning origins that did
   * not invite it passes a bounded agent (`new Agent({ connections: 2 })`) so
   * one scan cannot open 28 sockets at once against a stranger's WAF.
   */
  dispatcher?: Dispatcher;
  /**
   * How many requests this fetcher may have in flight at once.
   *
   * Omitted, there is no ceiling and every request is issued as it arrives.
   *
   * A bounded dispatcher alone is not enough for a caller that wants one, and
   * the difference is what the clocks measure. `Agent({ connections: 2 })`
   * accepts all 26 root-file requests the scan fires in one `Promise.all` and
   * queues 24 of them inside undici — but the per-request deadline and the
   * `ttfbMs` clock both start when `fetch()` is called, so an origin averaging
   * 800 ms per file would have its tail requests time out on the scanner's own
   * queue and be reported as unreachable. Waiting here instead holds a request
   * outside both clocks until it can actually be issued, so what they measure
   * is the origin.
   */
  maxConcurrent?: number;
  /**
   * Extra HTTP headers sent with every request from this fetcher.
   */
  headers?: Record<string, string>;
}

/**
 * A FIFO admission gate: at most `limit` holders at a time, in arrival order.
 *
 * Order matters. A `Promise.all` of 26 requests must not become a lottery in
 * which the last-queued file may be the first issued; the fetcher's callers
 * read the first response that arrives as the first request they made.
 */
function createGate(limit: number): { acquire: () => Promise<() => void> } {
  let inFlight = 0;
  const waiting: Array<() => void> = [];

  const release = (): void => {
    inFlight -= 1;
    const next = waiting.shift();
    if (next) next();
  };

  return {
    acquire: async () => {
      if (inFlight >= limit) {
        await new Promise<void>((resolve) => waiting.push(resolve));
      }
      inFlight += 1;
      return release;
    },
  };
}

/**
 * A dispatcher that opens at most `connections` sockets per origin.
 *
 * The scanner's own default has no such ceiling, and for a site owner scanning
 * their own site that is the right trade. A caller scanning origins that did
 * not invite it wants the ceiling, and this saves it from taking a direct
 * dependency on undici to express one line of politeness.
 */
export function boundedDispatcher(connections: number): Dispatcher {
  return new Agent({ connections });
}

/**
 * Set one request header, replacing any existing header of the same name in
 * any casing. The casing of `name` is what gets sent.
 */
export function setHeader(
  headers: Record<string, string>,
  name: string,
  value: string,
): void {
  const wanted = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key !== name && key.toLowerCase() === wanted) delete headers[key];
  }
  headers[name] = value;
}

/**
 * Merge header layers by case-insensitive name. A later layer wins over an
 * earlier one, and keeps its own casing.
 */
export function mergeHeaders(
  ...layers: Array<Record<string, string> | undefined>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const layer of layers) {
    if (!layer) continue;
    for (const [name, value] of Object.entries(layer)) {
      setHeader(out, name, value);
    }
  }
  return out;
}

export function createFetcher(fetcherOptions: FetcherOptions = {}) {
  const dispatcher = fetcherOptions.dispatcher ?? noRedirectAgent;
  const gate =
    fetcherOptions.maxConcurrent && fetcherOptions.maxConcurrent > 0
      ? createGate(Math.floor(fetcherOptions.maxConcurrent))
      : undefined;

  /**
   * Wait for a slot, then issue. Nothing inside `issue` starts until the
   * request is the scanner's turn to make, which is what keeps the wait out of
   * the deadline and out of `ttfbMs`.
   */
  async function fetch(options: FetchOptions): Promise<FetchResult> {
    if (!gate) return issue(options);
    const release = await gate.acquire();
    try {
      return await issue(options);
    } finally {
      release();
    }
  }

  async function issue(options: FetchOptions): Promise<FetchResult> {
    const {
      url,
      timeout = REQUEST_TIMEOUT_MS,
      acceptHeader = "*/*",
      method = "GET",
      body: requestBody,
      contentType,
      userAgent,
      headers: extraHeaders,
      followRedirects = true,
      signal: externalSignal,
      binary = false,
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
      // Header names are case-insensitive on the wire, so the layers merge
      // by name and not by exact key: a caller's `user-agent` is replaced by
      // the scanner's `User-Agent`, never sent beside it as a joined value.
      const reqHeaders = mergeHeaders(fetcherOptions.headers, extraHeaders, {
        "User-Agent": userAgent ?? SCANNER_USER_AGENT,
        Accept: acceptHeader,
      });

      if (authHeader) {
        setHeader(reqHeaders, "Authorization", authHeader);
      }

      if (method === "POST" && contentType) {
        setHeader(reqHeaders, "Content-Type", contentType);
      }

      logger.debug(
        { url: targetUrl, method },
        `[fetcher] Starting fetch: ${method} ${targetUrl}`,
      );

      let currentUrl = targetUrl;
      let currentMethod = method;
      let currentBody = requestBody;

      let response = await request(currentUrl, {
        method: currentMethod,
        headers: reqHeaders,
        body: currentBody,
        signal,
        dispatcher,
      });

      // Follow redirects here rather than handing the chain to undici's
      // interceptor. The isSafeUrl gate only ever saw the URL the caller
      // passed, so a public site could redirect the scanner into link-local or
      // RFC 1918 space. Walking the chain means every hop is checked, and it is
      // also the only way to report a truthful finalUrl.
      //
      // The gate is armed only when the starting URL is itself public: an
      // operator who deliberately points the scanner at a dev host gains
      // nothing from having its redirects refused.
      let gateArmed: boolean | undefined;
      let hops = 0;
      const redirectChain: Array<{ status: number; from: string; to: string }> =
        [];

      while (
        followRedirects &&
        REDIRECT_STATUS.has(response.statusCode) &&
        response.headers["location"] !== undefined &&
        hops < MAX_REDIRECTS
      ) {
        const rawLocation = response.headers["location"];
        const location = Array.isArray(rawLocation)
          ? rawLocation[0]
          : rawLocation;
        let next: string;
        try {
          next = new URL(String(location), currentUrl).href;
        } catch {
          // An unparseable Location is not a chain we can walk. Report the
          // redirect response itself, which is what the site actually sent.
          break;
        }

        gateArmed ??= await isSafeUrl(targetUrl);
        if (gateArmed && !(await isSafeUrl(next))) {
          await response.body.dump();
          logger.warn(
            { url: targetUrl, refused: next },
            `[fetcher] Refusing redirect out of public address space: ${targetUrl} -> ${next}`,
          );
          const refusedMs = performance.now() - start;
          return {
            url: targetUrl,
            finalUrl: currentUrl,
            status: 0,
            headers: {},
            body: "",
            ttfbMs: Math.round(refusedMs),
            totalMs: Math.round(refusedMs),
            contentType: "",
            contentLength: 0,
            error: "redirect-refused",
          };
        }

        await response.body.dump();

        // 303 always continues as a GET without a body; 301 and 302 do the same
        // for a POST, as every browser does. 307 and 308 keep both.
        if (
          response.statusCode === 303 ||
          (currentMethod === "POST" &&
            response.statusCode !== 307 &&
            response.statusCode !== 308)
        ) {
          currentMethod = "GET";
          currentBody = undefined;
        }

        redirectChain.push({
          status: response.statusCode,
          from: currentUrl,
          to: next,
        });
        currentUrl = next;
        hops += 1;

        response = await request(currentUrl, {
          method: currentMethod,
          headers: reqHeaders,
          body: currentBody,
          signal,
          dispatcher,
        });
      }

      ttfbMs = performance.now() - start;

      let body = "";
      let bytes: Uint8Array | undefined;
      if (currentMethod === "OPTIONS") {
        // For OPTIONS requests, consume and discard the body
        await response.body.dump();
      } else if (binary) {
        const buffer = new Uint8Array(await response.body.arrayBuffer());
        bytes =
          buffer.byteLength > MAX_RESPONSE_BODY_BYTES
            ? buffer.subarray(0, MAX_RESPONSE_BODY_BYTES)
            : buffer;
      } else {
        body = await response.body.text();
      }
      const totalMs = performance.now() - start;

      logger.debug(
        {
          url: targetUrl,
          finalUrl: currentUrl,
          status: response.statusCode,
          totalMs: Math.round(totalMs),
        },
        `[fetcher] Fetch complete: ${currentUrl} (${response.statusCode}) in ${Math.round(totalMs)}ms`,
      );

      const truncatedBody =
        body.length > MAX_RESPONSE_BODY_BYTES
          ? body.slice(0, MAX_RESPONSE_BODY_BYTES)
          : body;

      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(response.headers)) {
        const name = key.toLowerCase();
        if (typeof value === "string") {
          headers[name] = value;
        } else if (Array.isArray(value)) {
          // A field sent on several lines is one field value, combined with
          // ", " (RFC 9110 §5.3). Dropping the extra lines would hide, for
          // example, a second X-Robots-Tag naming a different crawler.
          // Set-Cookie is the standing exception: its values may contain
          // commas, so they are kept on separate lines.
          headers[name] = value.join(name === "set-cookie" ? "\n" : ", ");
        }
      }

      return {
        url: targetUrl,
        finalUrl: currentUrl,
        status: response.statusCode,
        headers,
        body: truncatedBody,
        ttfbMs: Math.round(ttfbMs),
        totalMs: Math.round(totalMs),
        contentType: headers["content-type"] ?? "",
        contentLength: bytes ? bytes.byteLength : truncatedBody.length,
        ...(bytes ? { bytes } : {}),
        ...(redirectChain.length > 0 ? { redirectChain } : {}),
      };
    } catch (err) {
      const totalMs = performance.now() - start;
      const message =
        err instanceof Error ? err.message : "Unknown fetch error";
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
        body: "",
        ttfbMs: Math.round(ttfbMs || totalMs),
        totalMs: Math.round(totalMs),
        contentType: "",
        contentLength: 0,
        error: detail,
      };
    }
  }

  return { fetch };
}
