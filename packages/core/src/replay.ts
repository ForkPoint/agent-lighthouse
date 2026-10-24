import {
  createFetcherWith,
  ReplayedFailure,
  type Fetcher,
  type HttpExchange,
  type Transport,
  type TransportResponse,
} from "./fetcher";
import { withScanEnvironment, type HostLookup } from "./scan-environment";

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
  /**
   * Requests the capture holds more than once with different answers, such
   * as a page fetched twice at once that the site served differently. The
   * replay answers them in the order the live scan started them, but a check
   * that starts its request earlier or later than it did live can get the
   * other answer. A replay that differs from its live scan only on these
   * requests is explained by them.
   */
  ambiguous(): string[];
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

function hostnameOf(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^\[|\]$/g, "").toLowerCase();
  } catch {
    return undefined;
  }
}

/** What a capture answered, for telling two answers apart. */
function answerOf(exchange: HttpExchange): string {
  const response = exchange.response;
  return JSON.stringify([
    exchange.error ?? null,
    response?.status ?? null,
    response ? Buffer.from(response.body).toString("base64") : null,
  ]);
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
    // A failed discard fails as it did live.
    dump: async () => {
      if (failure) throw failure;
    },
  };
}

/**
 * Build a {@link Replay} from the exchanges a scan's `onExchange` recorded.
 *
 * A request matches the first unused exchange with the same method, URL,
 * request headers and body, ignoring headers that change on every send,
 * such as a request signature. Matches go in the order the live scan
 * started its requests, not the order they finished. A request with no
 * match fails, as an unanswered request does, and is listed by `misses()`;
 * it never takes the answer to a different request. Each exchange answers
 * once, so a replay serves one scan.
 */
export function createReplay(exchanges: readonly HttpExchange[]): Replay {
  const exact = new Map<string, HttpExchange[]>();
  const hosts = new Set<string>();
  // The capture lists exchanges as they finish; a live scan started them in
  // fetch order, then hop order.
  const started = [...exchanges].sort(
    (a, b) => a.fetchId - b.fetchId || a.hop - b.hop,
  );
  for (const exchange of started) {
    const { method, url, headers, body } = exchange.request;
    const key = exactKey(method, url, headers, body);
    const queue = exact.get(key);
    if (queue) queue.push(exchange);
    else exact.set(key, [exchange]);
    const host = hostnameOf(url);
    if (host) hosts.add(host);
  }
  const ambiguous = [...exact.values()]
    .filter((queue) => new Set(queue.map(answerOf)).size > 1)
    .map(([first]) => `${first!.request.method} ${first!.request.url}`);
  const used = new Set<HttpExchange>();
  const missed: string[] = [];
  const take = (queue: HttpExchange[] | undefined) => {
    const found = queue?.find((exchange) => !used.has(exchange));
    if (found) used.add(found);
    return found;
  };

  const transport: Transport = async (url, init) => {
    init.signal.throwIfAborted();
    const exchange = take(
      exact.get(exactKey(init.method, url, init.headers, init.body)),
    );
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

  const lookup: HostLookup = async (hostname) => {
    if (hosts.has(hostname.toLowerCase())) return { address: REPLAY_ADDRESS };
    throw Object.assign(new Error(`getaddrinfo ENOTFOUND ${hostname}`), {
      code: "ENOTFOUND",
    });
  };
  const fetcher = createFetcherWith({}, transport);
  return {
    // Used on its own, outside a scan, the fetcher still resolves names
    // through the capture, so a redirect check makes no DNS lookup.
    fetcher: {
      fetch: (options) =>
        withScanEnvironment({ lookup }, () => fetcher.fetch(options)),
      summary: () => fetcher.summary(),
    },
    lookup,
    misses: () => [...missed],
    ambiguous: () => [...ambiguous],
  };
}
