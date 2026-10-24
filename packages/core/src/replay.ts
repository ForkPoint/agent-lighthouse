import {
  createFetcherWith,
  ReplayedFailure,
  type Fetcher,
  type HttpExchange,
  type Transport,
  type TransportResponse,
} from "./fetcher";
import type { HostLookup } from "./scan-environment";

/**
 * A scan's network, rebuilt from its captured exchanges. Pass `fetcher` and
 * `lookup` to `runScan`, with the capture's `scanId` and a `now` that returns
 * its scan time, and the scan reads the captures instead of the network.
 */
export interface Replay {
  /** Answers each request with its captured response. Sends nothing. */
  fetcher: Fetcher;
  /**
   * Resolves the hosts the capture sent requests to, to a public address,
   * and no other host. A URL the live scan refused as unsafe, or never
   * requested, is refused again.
   */
  lookup: HostLookup;
  /** Requests the scan made that the capture holds no exchange for, in order. */
  misses(): string[];
}

/** The address the replay resolves a captured host to (TEST-NET-1, RFC 5737). */
const REPLAY_ADDRESS = "192.0.2.1";

/**
 * Request headers that differ between two sends of the same request, such
 * as a fresh signature, or that the capture does not keep.
 */
const VOLATILE_HEADERS = new Set([
  "authorization",
  "proxy-authorization",
  "signature",
  "signature-input",
]);

function exactKey(
  method: string,
  url: string,
  headers: Record<string, string>,
  body: string | undefined,
): string {
  const fields = Object.entries(headers)
    .map(([name, value]) => [name.toLowerCase(), value] as const)
    .filter(([name]) => !VOLATILE_HEADERS.has(name))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([name, value]) => `${name}:${value}`);
  return JSON.stringify([method, url, fields, body ?? null]);
}

function headerValue(
  headers: Record<string, string>,
  wanted: string,
): string | undefined {
  for (const [name, value] of Object.entries(headers))
    if (name.toLowerCase() === wanted) return value;
  return undefined;
}

function looseKey(
  method: string,
  url: string,
  headers: Record<string, string>,
): string {
  return JSON.stringify([
    method,
    url,
    headerValue(headers, "user-agent") ?? null,
    headerValue(headers, "accept") ?? null,
  ]);
}

function hostnameOf(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^\[|\]$/g, "").toLowerCase();
  } catch {
    return undefined;
  }
}

function bodyOf(
  bytes: Uint8Array,
  failure: ReplayedFailure | undefined,
): TransportResponse["body"] {
  return {
    async *[Symbol.asyncIterator]() {
      if (bytes.byteLength > 0) yield bytes;
      if (failure) throw failure;
    },
    dump: async () => undefined,
  };
}

/**
 * Build a {@link Replay} from the exchanges a scan's `onExchange` recorded.
 *
 * A request matches the first unused exchange with the same method, URL,
 * request headers and body, ignoring headers that change on every send,
 * such as a request signature. Failing that, it takes the first unused one
 * with the same method, URL, User-Agent and Accept. A request with no match
 * fails, as an unanswered request does, and is listed by `misses()`.
 * Each exchange answers once, so a replay serves one scan.
 */
export function createReplay(exchanges: readonly HttpExchange[]): Replay {
  const exact = new Map<string, HttpExchange[]>();
  const loose = new Map<string, HttpExchange[]>();
  const hosts = new Set<string>();
  for (const exchange of exchanges) {
    const { method, url, headers, body } = exchange.request;
    const add = (map: Map<string, HttpExchange[]>, key: string) => {
      const queue = map.get(key);
      if (queue) queue.push(exchange);
      else map.set(key, [exchange]);
    };
    add(exact, exactKey(method, url, headers, body));
    add(loose, looseKey(method, url, headers));
    const host = hostnameOf(url);
    if (host) hosts.add(host);
  }
  const used = new Set<HttpExchange>();
  const missed: string[] = [];
  const take = (queue: HttpExchange[] | undefined) => {
    const found = queue?.find((exchange) => !used.has(exchange));
    if (found) used.add(found);
    return found;
  };

  const transport: Transport = async (url, init) => {
    init.signal.throwIfAborted();
    const exchange =
      take(exact.get(exactKey(init.method, url, init.headers, init.body))) ??
      take(loose.get(looseKey(init.method, url, init.headers)));
    if (!exchange) {
      missed.push(`${init.method} ${url}`);
      throw new ReplayedFailure(`Not in the capture: ${init.method} ${url}`, {
        ttfbMs: 0,
        totalMs: 0,
      });
    }
    const timing = { ttfbMs: exchange.ttfbMs, totalMs: exchange.totalMs };
    const failure =
      exchange.error !== undefined
        ? new ReplayedFailure(exchange.error, timing)
        : undefined;
    if (!exchange.response)
      throw (
        failure ?? new ReplayedFailure("The capture holds no response", timing)
      );
    return {
      statusCode: exchange.response.status,
      headers: exchange.response.headers,
      body: bodyOf(exchange.response.body, failure),
      timing,
    };
  };

  return {
    fetcher: createFetcherWith({}, transport),
    lookup: async (hostname) => {
      if (hosts.has(hostname.toLowerCase())) return { address: REPLAY_ADDRESS };
      throw Object.assign(new Error(`getaddrinfo ENOTFOUND ${hostname}`), {
        code: "ENOTFOUND",
      });
    },
    misses: () => [...missed],
  };
}
