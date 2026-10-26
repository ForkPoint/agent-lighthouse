import type { RequestScheduler } from "./request-scheduler";
import { request, Agent, type Dispatcher } from "undici";
import dns from "node:dns/promises";
import {
  BASELINE_UA,
  SCANNER_USER_AGENT,
  REQUEST_TIMEOUT_MS,
  MAX_RESPONSE_BODY_BYTES,
} from "./constants";
import { isPrivateIp } from "./url-utils";
import { LogField, logger } from "./logger";
import { scanLookup } from "./scan-environment";

const log = logger.child({ [LogField.Component]: "fetcher" });
import { RedirectCookieJar } from "./redirect-cookies";
import { HttpMethod, RedirectFailure } from "./types";

/**
 * Whether a URL is http(s) and resolves to a public address. Inside a scan
 * that set a resolver (see `ScanOptions.lookup`), the name resolves through
 * it instead of the system's.
 */
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
    const lookup = scanLookup();
    const { address } = lookup
      ? await lookup(hostname)
      : await dns.lookup(hostname);
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

/**
 * How many hops a redirect chain may take before we give up. The Fetch
 * standard follows 20, and so do browsers; some storefronts need 6 or more
 * to set a locale cookie and land on the homepage.
 */
export const MAX_REDIRECTS = 20;
/** Statuses that carry a Location a client is expected to follow. */
const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);

export interface FetchOptions {
  url: string;
  timeout?: number;
  followRedirects?: boolean;
  acceptHeader?: string;
  method?: HttpMethod;
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
  /**
   * External abort (e.g. the per-scan deadline). Combined with the per-request
   * timeout. Callers forward an optional scan signal, so `undefined` is allowed.
   */
  signal?: AbortSignal | undefined;
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

/** What one fetcher did; see `createFetcher().summary()`. */
export interface FetcherSummary {
  /** Requests that got an answer or failed. */
  requests: number;
  /** Answered requests by status class, such as `2xx`. */
  statuses: Record<string, number>;
  /** Failed requests by error code, such as `UND_ERR_CONNECT_TIMEOUT`. */
  failures: Record<string, number>;
  /** Requests not yet answered, with how long each has waited. */
  open: Array<{ url: string; ms: number }>;
  /**
   * Exchanges whose `onExchange` call threw. Present only when some did:
   * those requests kept their results, but the capture lacks them, so a
   * replay of it is incomplete.
   */
  captureErrors?: number;
}

/**
 * One HTTP request the fetcher sent, or tried to send, and what came back.
 * A `fetch` that follows redirects sends one request per hop, and each hop
 * is its own exchange. A request the scheduler refused is an exchange with
 * an `error` and no `response`.
 */
export interface HttpExchange {
  /** Which `fetch` call sent it, counted per fetcher from 1. Hops share it. */
  fetchId: number;
  /** 0 for the first request of a fetch, then one more per redirect hop. */
  hop: number;
  /**
   * When the request left, after any wait for the scheduler, as ISO 8601.
   * For a request the scheduler refused, when the fetcher asked for it.
   */
  startedAt: string;
  request: {
    url: string;
    method: HttpMethod;
    /** As sent. `Authorization` and `Proxy-Authorization` values are replaced by `[redacted]`. */
    headers: Record<string, string>;
    body?: string;
  };
  response?: {
    status: number;
    /** As received: a field sent on several lines keeps one entry per line. */
    headers: Record<string, string | string[]>;
    /**
     * The bytes the fetcher read. Empty when it discarded the body unread:
     * a redirect hop, an OPTIONS response, or a refused redirect. When the
     * body failed mid-stream, the bytes that arrived before the `error`.
     */
    body: Uint8Array;
    /** Whether the fetcher read the body to its end or to the size limit. */
    bodyRead: boolean;
    /** The read stopped at the fetcher's size limit; the body may go on. */
    truncated: boolean;
  };
  /** Why no complete response was read, as the FetchResult reports it. */
  error?: string;
  /**
   * The fetch's clocks when this exchange ended, as `FetchResult` reports
   * them: milliseconds since the fetch started, scheduler waits excluded.
   * On the last exchange of a fetch they equal the result's.
   */
  ttfbMs: number;
  totalMs: number;
}

/** What `createFetcher` returns, and what `ScanOptions.fetcher` accepts. */
export interface Fetcher {
  fetch(options: FetchOptions): Promise<FetchResult>;
  summary(): FetcherSummary;
}

export interface FetcherOptions {
  /** Shared request pacing across scans, including redirect hops. */
  requestScheduler?: RequestScheduler;
  /**
   * Called once per request, redirect hops included, after its response
   * body is read or discarded, or after it failed. The record holds the
   * bytes the fetcher judged, so a caller can store the scan's evidence and
   * replay it later with `createReplay`.
   */
  onExchange?: (exchange: HttpExchange) => void;
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

/**
 * Raw bytes a text response may read; see the decode in `issue`. The extra 3
 * bytes cover a leading BOM, which TextDecoder strips without yielding a unit.
 */
const TEXT_READ_CAP_BYTES = 3 * MAX_RESPONSE_BODY_BYTES + 3;

/**
 * Reads at most `cap` bytes of a response body, then stops. Leaving the loop
 * early destroys the stream, which aborts the rest of the download, so an
 * endless or huge body never sits in memory whole. `truncated` means the
 * read stopped at `cap`: the body may have ended there or gone on.
 *
 * When the stream fails, `onPartial` gets the bytes that arrived before the
 * error is rethrown.
 */
async function readCapped(
  body: AsyncIterable<Uint8Array>,
  cap: number,
  onPartial?: (bytes: Uint8Array) => void,
): Promise<{ bytes: Uint8Array; truncated: boolean }> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for await (const chunk of body) {
      const room = cap - size;
      chunks.push(chunk.byteLength > room ? chunk.subarray(0, room) : chunk);
      size += Math.min(chunk.byteLength, room);
      if (size >= cap) break;
    }
  } catch (error) {
    onPartial?.(new Uint8Array(Buffer.concat(chunks, size)));
    throw error;
  }
  return {
    bytes: new Uint8Array(Buffer.concat(chunks, size)),
    truncated: size >= cap,
  };
}

/** The response shape the fetcher reads; undici's `request` returns it. */
export interface TransportResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: AsyncIterable<Uint8Array> & { dump(): Promise<unknown> };
  /** A replayed response carries the clocks its capture reported. */
  timing?: { ttfbMs: number; totalMs: number };
}

/** Sends one request. The default is undici's `request`. */
export type Transport = (
  url: string,
  init: {
    method: HttpMethod;
    headers: Record<string, string>;
    body?: string;
    signal: AbortSignal;
    dispatcher: Dispatcher;
  },
) => Promise<TransportResponse>;

/** A replayed failure, with the clocks its capture reported. */
export class ReplayedFailure extends Error {
  readonly timing: { ttfbMs: number; totalMs: number };
  constructor(message: string, timing: { ttfbMs: number; totalMs: number }) {
    super(message);
    this.name = "ReplayedFailure";
    this.timing = timing;
  }
}

const REDACTED_HEADERS = new Set(["authorization", "proxy-authorization"]);

function capturedHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers))
    out[name] = REDACTED_HEADERS.has(name.toLowerCase()) ? "[redacted]" : value;
  return out;
}

function receivedHeaders(
  headers: TransportResponse["headers"],
): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [name, value] of Object.entries(headers))
    if (value !== undefined)
      out[name] = Array.isArray(value) ? [...value] : value;
  return out;
}

/**
 * Whether a User-Agent speaks for this client. The browser baseline counts:
 * a host that refuses a mainstream browser refuses the client, not one
 * crawler token, so the scheduler stops it as it would on a 403 to the
 * scanner's own User-Agent.
 */
function isOwnAgent(userAgent: string): boolean {
  return userAgent === SCANNER_USER_AGENT || userAgent === BASELINE_UA;
}

const undiciTransport: Transport = (url, init) => request(url, init);

export function createFetcher(fetcherOptions: FetcherOptions = {}): Fetcher {
  return createFetcherWith(fetcherOptions, undiciTransport);
}

/** {@link createFetcher} over another transport; replay uses it. */
export function createFetcherWith(
  fetcherOptions: FetcherOptions,
  transport: Transport,
): Fetcher {
  const dispatcher = fetcherOptions.dispatcher ?? noRedirectAgent;
  const pending = new Set<{ url: string; since: number }>();
  const tally = createTally();
  const onExchange = fetcherOptions.onExchange;
  let fetchCount = 0;
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
    const entry = { url: options.url, since: performance.now() };
    pending.add(entry);
    try {
      if (!gate) return await issue(options);
      const release = await gate.acquire();
      try {
        return await issue(options);
      } finally {
        release();
      }
    } finally {
      pending.delete(entry);
    }
  }

  /**
   * What this fetcher did so far: requests answered by status class, failures
   * by error code, and the requests not yet answered with how long each has
   * waited. A request that never ends writes no "finished" line, so a scan
   * that ends with some still open names them from here.
   */
  function summary(): FetcherSummary {
    const now = performance.now();
    return {
      requests: tally.requests,
      statuses: { ...tally.statuses },
      failures: { ...tally.failures },
      open: [...pending].map((entry) => ({
        url: splitCredentials(entry.url).url,
        ms: Math.round(now - entry.since),
      })),
      ...(tally.captureErrors > 0 && { captureErrors: tally.captureErrors }),
    };
  }

  async function issue(options: FetchOptions): Promise<FetchResult> {
    const {
      url,
      timeout = REQUEST_TIMEOUT_MS,
      acceptHeader = "*/*",
      method = HttpMethod.Get,
      body: requestBody,
      contentType,
      userAgent,
      headers: extraHeaders,
      followRedirects = true,
      signal: externalSignal,
      binary = false,
    } = options;

    // Pull any `user:pass@` out of the URL into an Authorization header, and use
    // the credential-free URL for the request, logs, and returned result.
    const { url: targetUrl, authHeader } = splitCredentials(url);

    const fetchId = (fetchCount += 1);
    const start = performance.now();
    let queuedMs = 0;
    let release: (() => void) | undefined;
    let ttfbMs = 0;
    const elapsed = () => performance.now() - start - queuedMs;
    // The exchange of the request in flight, until it is reported.
    let open: HttpExchange | undefined;
    let replayedTiming: { ttfbMs: number; totalMs: number } | undefined;
    const report = (
      exchange: HttpExchange,
      ttfb: number,
      total: number,
    ): void => {
      open = undefined;
      if (!onExchange) return;
      exchange.ttfbMs = Math.round(ttfb);
      exchange.totalMs = Math.round(total);
      // A capture that fails, such as a full disk, must not change what the
      // site answered. The summary counts it, so the caller can mark the
      // capture incomplete.
      try {
        onExchange(exchange);
      } catch (error) {
        tally.captureErrors += 1;
        log.warn(
          {
            [LogField.Url]: exchange.request.url,
            [LogField.Error]: {
              message: error instanceof Error ? error.message : String(error),
            },
          },
          "Capture callback failed; the capture lacks this exchange",
        );
      }
    };
    const send = async (
      target: string,
      init: {
        method: HttpMethod;
        headers: Record<string, string>;
        body?: string;
      },
      hop: number,
    ): Promise<TransportResponse> => {
      const exchange: HttpExchange = {
        fetchId,
        hop,
        startedAt: new Date().toISOString(),
        request: {
          url: target,
          method: init.method,
          headers: capturedHeaders(init.headers),
          ...(init.body !== undefined && { body: init.body }),
        },
        ttfbMs: 0,
        totalMs: 0,
      };
      open = exchange;
      const queuedAt = performance.now();
      try {
        if (fetcherOptions.requestScheduler) {
          release = await fetcherOptions.requestScheduler.acquire(
            target,
            externalSignal,
          );
        }
      } finally {
        queuedMs += performance.now() - queuedAt;
      }
      externalSignal?.throwIfAborted();
      // The scheduler's wait is not part of the request.
      exchange.startedAt = new Date().toISOString();
      const timeoutSignal = AbortSignal.timeout(
        Math.max(0, Math.ceil(timeout - elapsed())),
      );
      const signal = externalSignal
        ? AbortSignal.any([timeoutSignal, externalSignal])
        : timeoutSignal;
      const response = await transport(target, {
        ...init,
        signal,
        dispatcher,
      });
      exchange.response = {
        status: response.statusCode,
        headers: receivedHeaders(response.headers),
        body: new Uint8Array(0),
        bodyRead: false,
        truncated: false,
      };
      fetcherOptions.requestScheduler?.observe(
        target,
        response.statusCode,
        response.headers["retry-after"],
        { ownAgent: isOwnAgent(init.headers["User-Agent"] ?? "") },
      );
      replayedTiming = response.timing;
      return response;
    };

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

      if (method === HttpMethod.Post && contentType) {
        setHeader(reqHeaders, "Content-Type", contentType);
      }

      const ua = reqHeaders["User-Agent"];
      log.trace(
        {
          [LogField.HttpMethod]: method,
          [LogField.Url]: targetUrl,
          [LogField.UserAgent]: ua,
        },
        "Request started",
      );

      let currentUrl = targetUrl;
      let currentMethod = method;
      let currentBody = requestBody;

      let response = await send(
        currentUrl,
        {
          method: currentMethod,
          headers: reqHeaders,
          ...(currentBody !== undefined && { body: currentBody }),
        },
        0,
      );

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
      // Cookies set along this chain are sent back on its later hops, as a
      // browser does; without them some sites redirect until the hop limit.
      const cookieJar = new RedirectCookieJar();
      // Compare the effective request, not the URL alone: a cookie or POST-to-GET
      // transition can make a same-URL redirect legitimate progress.
      const redirectState = (
        url: string,
        effectiveMethod: HttpMethod,
        headers: Record<string, string>,
      ) => {
        const normalized = new URL(url);
        normalized.hash = "";
        const cookie =
          Object.entries(headers).find(
            ([name]) => name.toLowerCase() === "cookie",
          )?.[1] ?? "";
        return JSON.stringify([
          normalized.href,
          effectiveMethod,
          cookie,
          cookieJar.stateKey(),
        ]);
      };
      const visited = new Set([
        redirectState(currentUrl, currentMethod, reqHeaders),
      ]);

      while (
        // This option is constant; response and hops bound the redirect loop.
        // oxlint-disable-next-line no-unmodified-loop-condition
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
          log.warn(
            { [LogField.Url]: targetUrl, redirectTo: next },
            "Refusing redirect out of public address space",
          );
          const refusedMs = replayedTiming?.totalMs ?? elapsed();
          if (open) report(open, refusedMs, refusedMs);
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
            error: RedirectFailure.Refused,
          };
        }

        await response.body.dump();
        release?.();
        release = undefined;
        cookieJar.store(response.headers["set-cookie"], currentUrl);

        // 303 always continues as a GET without a body; 301 and 302 do the same
        // for a POST, as every browser does. 307 and 308 keep both.
        if (
          response.statusCode === 303 ||
          (currentMethod === HttpMethod.Post &&
            response.statusCode !== 307 &&
            response.statusCode !== 308)
        ) {
          currentMethod = HttpMethod.Get;
          currentBody = undefined;
        }

        redirectChain.push({
          status: response.statusCode,
          from: currentUrl,
          to: next,
        });
        currentUrl = next;
        hops += 1;

        let hopHeaders = reqHeaders;
        const cookies = cookieJar.header(currentUrl);
        if (cookies) {
          hopHeaders = { ...reqHeaders };
          const callerCookie = Object.entries(reqHeaders).find(
            ([name]) => name.toLowerCase() === "cookie",
          )?.[1];
          setHeader(
            hopHeaders,
            "Cookie",
            callerCookie ? `${callerCookie}; ${cookies}` : cookies,
          );
        }

        const state = redirectState(currentUrl, currentMethod, hopHeaders);
        if (visited.has(state)) {
          // Freeze terminal timing before capture callbacks run. Replay reads
          // this same value from the last observed exchange.
          const loopMs = replayedTiming?.totalMs ?? elapsed();
          if (open) report(open, loopMs, loopMs);
          tally.failed(RedirectFailure.Loop);
          log.debug(
            {
              [LogField.HttpMethod]: method,
              [LogField.Url]: targetUrl,
              [LogField.Error]: {
                message: RedirectFailure.Loop,
                code: RedirectFailure.Loop,
              },
              [LogField.DurationMs]: Math.round(loopMs),
            },
            "Request failed",
          );
          return {
            url: targetUrl,
            finalUrl: redirectChain[redirectChain.length - 1]!.from,
            status: 0,
            headers: {},
            body: "",
            ttfbMs: Math.round(loopMs),
            totalMs: Math.round(loopMs),
            contentType: "",
            contentLength: 0,
            error: RedirectFailure.Loop,
            redirectChain,
          };
        }
        visited.add(state);
        if (open) report(open, elapsed(), elapsed());

        response = await send(
          currentUrl,
          {
            method: currentMethod,
            headers: hopHeaders,
            ...(currentBody !== undefined && { body: currentBody }),
          },
          hops,
        );
      }

      ttfbMs = replayedTiming?.ttfbMs ?? elapsed();

      let body = "";
      let bytes: Uint8Array | undefined;
      let read: { bytes: Uint8Array; truncated: boolean } | undefined;
      // Bytes that arrived before the body failed stay in the capture.
      const keepPartial = (partial: Uint8Array) => {
        if (open?.response) open.response.body = partial;
      };
      if (currentMethod === HttpMethod.Options) {
        // For OPTIONS requests, consume and discard the body
        await response.body.dump();
      } else if (binary) {
        read = await readCapped(
          response.body,
          MAX_RESPONSE_BODY_BYTES,
          keepPartial,
        );
        bytes = read.bytes;
      } else {
        // The body is cut to MAX_RESPONSE_BODY_BYTES UTF-16 units below. One
        // unit takes at most 3 UTF-8 bytes, so 3x that many bytes decode to the
        // same first units as the whole body would: the verdicts do not move,
        // and a body of any size costs at most this much to read.
        // TextDecoder strips a BOM and replaces invalid bytes as `text()` did.
        read = await readCapped(
          response.body,
          TEXT_READ_CAP_BYTES,
          keepPartial,
        );
        body = new TextDecoder().decode(read.bytes);
      }
      const totalMs = replayedTiming?.totalMs ?? elapsed();
      if (open) {
        const exchange: HttpExchange = open;
        if (exchange.response && read) {
          exchange.response.body = read.bytes;
          exchange.response.bodyRead = true;
          exchange.response.truncated = read.truncated;
        }
        report(exchange, ttfbMs, totalMs);
      }

      tally.answered(response.statusCode);
      log.trace(
        {
          [LogField.HttpMethod]: method,
          [LogField.Url]: targetUrl,
          ...(currentUrl !== targetUrl && { finalUrl: currentUrl }),
          [LogField.HttpStatus]: response.statusCode,
          [LogField.DurationMs]: Math.round(totalMs),
          ttfbMs: Math.round(ttfbMs),
          ...(hops > 0 && { hops }),
          [LogField.UserAgent]: ua,
        },
        "Request finished",
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
      const replayed = err instanceof ReplayedFailure ? err.timing : undefined;
      const totalMs = replayed?.totalMs ?? elapsed();
      const message =
        err instanceof Error ? err.message : "Unknown fetch error";
      // Surface undici's underlying cause (ENOTFOUND, ECONNREFUSED, timeout, TLS…)
      // so an opaque "fetch failed" becomes diagnosable in the logs.
      const code = errorCode(err);
      const detail = code ? `${message} (${code})` : message;
      const reportedTtfb = replayed?.ttfbMs ?? (ttfbMs || totalMs);

      if (open) {
        const exchange: HttpExchange = open;
        exchange.error = detail;
        report(exchange, reportedTtfb, totalMs);
      }

      // A failed fetch is a result, not a fault: the caller reads `error` and
      // decides. One line at warn names it; the object and its stack are
      // debug material, or every walled site prints a screen of frames.
      // A failed request is a result the audits read, not a scanner fault,
      // so it is a debug line; the scan logs one summary of all failures.
      tally.failed(code);
      log.debug(
        {
          [LogField.HttpMethod]: method,
          [LogField.Url]: targetUrl,
          [LogField.Error]: { message: detail, ...(code && { code }) },
          [LogField.DurationMs]: Math.round(totalMs),
        },
        "Request failed",
      );

      return {
        url: targetUrl,
        finalUrl: targetUrl,
        status: 0,
        headers: {},
        body: "",
        ttfbMs: Math.round(reportedTtfb),
        totalMs: Math.round(totalMs),
        contentType: "",
        contentLength: 0,
        error: detail,
      };
    } finally {
      release?.();
    }
  }

  return { fetch, summary };
}

/** Counts behind {@link FetcherSummary}, kept per fetcher. */
function createTally() {
  const tally = {
    requests: 0,
    statuses: {} as Record<string, number>,
    failures: {} as Record<string, number>,
    captureErrors: 0,
    answered(status: number): void {
      tally.requests += 1;
      const group = `${Math.floor(status / 100)}xx`;
      tally.statuses[group] = (tally.statuses[group] ?? 0) + 1;
    },
    failed(code: string | undefined): void {
      tally.requests += 1;
      const key = code ?? "other";
      tally.failures[key] = (tally.failures[key] ?? 0) + 1;
    },
  };
  return tally;
}
