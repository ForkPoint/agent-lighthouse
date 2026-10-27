import { setTimeout as pause } from "node:timers/promises";
import { SCAN_TIMEOUT_MS } from "./constants";
import { HostStopReason } from "./contracts";

export interface RequestScheduler {
  acquire(url: string, signal?: AbortSignal): Promise<() => void>;
  observe(
    url: string,
    status: number,
    retryAfter: string | string[] | undefined,
    /**
     * `ownAgent: false` marks a request sent with an AI crawler's
     * User-Agent, as crawler-parity checks do. A 403 to it is that check's
     * finding, not a refusal of the scanner, so it does not stop the host.
     * The scanner's own User-Agent and the browser baseline count as the
     * scanner's: a host that refuses either one refuses this client.
     */
    request?: { ownAgent: boolean },
  ): void;
}

// Defined with the report contracts, which carry it in `conditions.requestStop`.
export { HostStopReason };

/**
 * What the default scheduler keeps about one host between requests. It is
 * plain data, so a caller can store it and hand it to a later scheduler.
 */
export interface HostState {
  /** Lower case, no trailing dot, no `www.`: apex and www share one state. */
  host: string;
  /** Epoch milliseconds before which no request to the host leaves. */
  readyAt: number;
  /** Set once the host refused the scanner; no further request leaves. */
  stopped: boolean;
  stopReason: HostStopReason | null;
  /** HTTP 503 responses in a row, reset by any other status. */
  unavailable: number;
  /** The last HTTP status the host sent, or `null` before any. */
  lastStatus: number | null;
}

/** One host's queue right now, for a progress display. */
export interface RequestQueueSnapshot extends HostState {
  activeUrl: string | null;
  activeSince: number | null;
  waiting: number;
}

export interface RequestSchedulerOptions {
  /** Pause between the end of one request to a host and the next. Default 0. */
  gapMs?: number;
  /**
   * The longest `Retry-After` the scheduler waits out. A 503 that asks for
   * more stops the host instead, since the wait would outlast the scan.
   * Defaults to {@link SCAN_TIMEOUT_MS}, one whole scan budget.
   */
  maxRetryAfterMs?: number;
  /** How long to wait after a 503 that names no usable `Retry-After`. Default 60 s. */
  defaultRetryAfterMs?: number;
  /** Host state from an earlier scheduler, from {@link DefaultRequestScheduler.exportState}. */
  state?: readonly HostState[];
  /**
   * Called after each response, with what the scheduler now keeps about the
   * host: a stop, a cooldown, the 503 count and the last status. A caller
   * that persists host state saves it here, before the request is released.
   * The `gapMs` pause set on release is not reported: it lasts milliseconds,
   * and saving it would add a write per request for no gain.
   */
  onChange?: (state: HostState) => void;
}

export interface DefaultRequestScheduler extends RequestScheduler {
  /** Whether any request to this host's queue got an HTTP status. */
  answered(url: string): boolean;
  /** Every host's queue, as copies. */
  snapshot(): RequestQueueSnapshot[];
  /** Every host's state, as copies a later scheduler can import. */
  exportState(): HostState[];
  /**
   * Replace the stored state of the hosts named, keeping their queues. A
   * stopped host stays stopped and a cooldown keeps its remaining wait.
   */
  importState(state: readonly HostState[]): void;
}

/**
 * The message of a {@link HostStoppedError}. A fetch the scheduler held back
 * carries it as its `error`, so a reader can tell a request that was never
 * sent from one the site dropped.
 */
export const HOST_STOPPED_MESSAGE =
  "Site paused after HTTP 403, 429 or repeated 503; no further requests sent";

/** Thrown by `acquire` for a host the scheduler stopped. */
export class HostStoppedError extends Error {
  readonly host: string;
  readonly reason: HostStopReason | null;
  constructor(host: string, reason: HostStopReason | null) {
    super(HOST_STOPPED_MESSAGE);
    this.name = "HostStoppedError";
    this.host = host;
    this.reason = reason;
  }
}

/** The key a host's queue and state go by: apex and www share one. */
export function schedulerHostKey(url: string): string {
  return new URL(url).hostname
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^www\./, "");
}

function nonNegative(name: string, value: number): number {
  if (!Number.isFinite(value) || value < 0)
    throw new RangeError(`${name} must be a finite non-negative number`);
  return value;
}

/**
 * The epoch millisecond a `Retry-After` value names: delay-seconds or an
 * HTTP date. `undefined` when it names neither.
 */
function retryAfterAt(
  retryAfter: string | string[] | undefined,
  now: number,
): number | undefined {
  const raw = Array.isArray(retryAfter) ? retryAfter[0] : retryAfter;
  if (!raw?.trim()) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds))
    return seconds >= 0 ? now + seconds * 1000 : undefined;
  const date = Date.parse(raw);
  return Number.isFinite(date) ? date : undefined;
}

/**
 * The default {@link RequestScheduler}: one queue per host, one request at a
 * time, `gapMs` apart. It stops a host on HTTP 429, on a 403 to the
 * scanner's own User-Agent, and on two 503s in a row, and waits out the
 * `Retry-After` of a single 503. Queue time is not request time: the fetcher
 * starts its clocks only once the scheduler admits the request.
 */
export function createRequestScheduler(
  options: RequestSchedulerOptions = {},
): DefaultRequestScheduler {
  const gapMs = nonNegative("gapMs", options.gapMs ?? 0);
  const maxRetryAfterMs = nonNegative(
    "maxRetryAfterMs",
    options.maxRetryAfterMs ?? SCAN_TIMEOUT_MS,
  );
  const defaultRetryAfterMs = nonNegative(
    "defaultRetryAfterMs",
    options.defaultRetryAfterMs ?? 60_000,
  );
  const onChange = options.onChange;

  interface Site extends RequestQueueSnapshot {
    tail: Promise<void>;
  }
  const sites = new Map<string, Site>();

  function siteFor(url: string): Site {
    const key = schedulerHostKey(url);
    let site = sites.get(key);
    if (!site) {
      site = {
        tail: Promise.resolve(),
        host: key,
        readyAt: 0,
        stopped: false,
        stopReason: null,
        unavailable: 0,
        lastStatus: null,
        activeUrl: null,
        activeSince: null,
        waiting: 0,
      };
      sites.set(key, site);
    }
    return site;
  }

  function stateOf(site: Site): HostState {
    return {
      host: site.host,
      readyAt: site.readyAt,
      stopped: site.stopped,
      stopReason: site.stopReason,
      unavailable: site.unavailable,
      lastStatus: site.lastStatus,
    };
  }

  function stop(site: Site, reason: HostStopReason): void {
    if (site.stopped) return;
    site.stopped = true;
    site.stopReason = reason;
  }

  function importState(state: readonly HostState[]): void {
    for (const entry of state) {
      const site = siteFor(`https://${entry.host}/`);
      site.readyAt = Math.max(site.readyAt, entry.readyAt);
      site.stopped ||= entry.stopped;
      site.stopReason ??= entry.stopReason;
      site.unavailable = entry.unavailable;
      site.lastStatus = entry.lastStatus;
    }
  }

  if (options.state) importState(options.state);

  return {
    snapshot() {
      return [...sites.values()].map(({ tail: _tail, ...state }) => ({
        ...state,
      }));
    },
    exportState() {
      return [...sites.values()].map(stateOf);
    },
    importState,
    async acquire(url, signal) {
      const site = siteFor(url);
      site.waiting += 1;
      const previous = site.tail;
      let unlock!: () => void;
      site.tail = new Promise<void>((resolve) => {
        unlock = resolve;
      });
      // Cancellation must not let a later waiter overtake an active request.
      let abort: (() => void) | undefined;
      try {
        await (signal
          ? Promise.race([
              previous,
              new Promise<never>((_, reject) => {
                abort = () =>
                  reject(
                    signal.reason instanceof Error
                      ? signal.reason
                      : new Error("Request cancelled"),
                  );
                signal.addEventListener("abort", abort, { once: true });
                if (signal.aborted) abort();
              }),
            ])
          : previous);
        signal?.throwIfAborted();
        // A response to another request can stop the host or extend its
        // cooldown during the wait, so check again after every pause.
        for (;;) {
          if (site.stopped)
            throw new HostStoppedError(site.host, site.stopReason);
          const wait = site.readyAt - Date.now();
          if (wait <= 0) break;
          await pause(wait, undefined, { signal });
          signal?.throwIfAborted();
        }
        site.activeUrl = url;
        site.activeSince = Date.now();
        let released = false;
        return () => {
          if (released) return;
          released = true;
          site.activeUrl = null;
          site.activeSince = null;
          site.readyAt = Math.max(site.readyAt, Date.now() + gapMs);
          unlock();
        };
      } catch (error) {
        void previous.then(unlock);
        throw error;
      } finally {
        site.waiting -= 1;
        if (abort) signal?.removeEventListener("abort", abort);
      }
    },
    answered(url) {
      return (sites.get(schedulerHostKey(url))?.lastStatus ?? null) !== null;
    },
    observe(url, status, retryAfter, request) {
      const site = siteFor(url);
      site.lastStatus = status;
      if (status === 429) stop(site, HostStopReason.TooManyRequests);
      else if (status === 403 && request?.ownAgent !== false)
        stop(site, HostStopReason.Forbidden);
      if (status !== 503) {
        site.unavailable = 0;
      } else {
        // One 503 is a pause worth waiting out. A second in a row means the
        // host keeps refusing, often a bot challenge; waiting again only
        // burns the scan budget and adds load.
        site.unavailable += 1;
        if (site.unavailable >= 2) {
          stop(site, HostStopReason.Unavailable);
        } else {
          const now = Date.now();
          const until =
            retryAfterAt(retryAfter, now) ?? now + defaultRetryAfterMs;
          if (until - now > maxRetryAfterMs)
            stop(site, HostStopReason.RetryAfterTooLong);
          else site.readyAt = Math.max(site.readyAt, until);
        }
      }
      onChange?.(stateOf(site));
    },
  };
}
