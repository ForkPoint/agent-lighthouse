import { SCAN_TIMEOUT_MS } from "./constants";
import { HostStopReason } from "./contracts";

/** Atomic admission identity and active-request limit for one fetcher. */
export interface RequestAdmission {
  owner: object;
  maxConcurrent?: number;
}

export interface RequestScheduler {
  acquireRequest?(
    url: string,
    admission: RequestAdmission,
    signal?: AbortSignal,
  ): Promise<() => void>;
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
  /** The oldest request in flight to the host, or `null`. */
  activeUrl: string | null;
  activeSince: number | null;
  /** Requests in flight to the host. */
  activeRequests: number;
  /** Requests the host may have in flight now: 1 unless auto-throttle raised it. */
  hostLimit: number;
  waiting: number;
}

/**
 * Adaptive per-host concurrency. A host starts at one request in flight. The
 * limit grows by one after a full window of healthy answers and halves on
 * strain, between 1 and `maxPerHost`. Strain is a 5xx answer, a request that
 * ended without an answer, such as a timeout or reset, or a request that took
 * longer than `slowMs` from admission to release. `gapMs` still separates each
 * release from the next admission to the host, and 403, 429 and 503 keep their
 * stop and cooldown rules.
 */
export interface AutoThrottleOptions {
  /** The most requests one host may have in flight. */
  maxPerHost: number;
  /** A request held longer than this counts as strain. Default 5000 ms. */
  slowMs?: number;
}

export interface RequestSchedulerOptions {
  /** Global active-request ceiling across all owners. Default unlimited. */
  maxConcurrent?: number;
  /** Pause between the end of one request to a host and the next. Default 0. */
  gapMs?: number;
  /**
   * Let a responsive host take more than one request at a time. Off by
   * default: without it, each host has one request in flight.
   */
  autoThrottle?: AutoThrottleOptions;
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
  acquireRequest(
    url: string,
    admission: RequestAdmission,
    signal?: AbortSignal,
  ): Promise<() => void>;
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
 * time, `gapMs` apart, unless `autoThrottle` lets a responsive host take
 * more. It stops a host on HTTP 429, on a 403 to the
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

  function limit(name: string, value: number | undefined): number {
    if (value === undefined) return Infinity;
    if (!Number.isSafeInteger(value) || value < 1)
      throw new RangeError(`${name} must be a positive safe integer`);
    return value;
  }
  const globalLimit = limit("maxConcurrent", options.maxConcurrent);
  const maxPerHost = options.autoThrottle
    ? limit("autoThrottle.maxPerHost", options.autoThrottle.maxPerHost)
    : 1;
  const slowMs = nonNegative(
    "autoThrottle.slowMs",
    options.autoThrottle?.slowMs ?? 5000,
  );
  const legacyOwner = {};
  interface Pending {
    url: string;
    owner: object;
    ownerLimit: number;
    resolve: (release: () => void) => void;
    reject: (error: unknown) => void;
    cleanup: () => void;
  }
  interface Lease {
    url: string;
    since: number;
    status: number | null;
  }
  interface Site extends RequestQueueSnapshot {
    pending: Pending[];
    leases: Lease[];
    /** Healthy releases since the host limit last changed. */
    healthy: number;
    lastOwner: object | null;
    turn: number;
  }
  const owners = new Map<object, number>();
  const ownerLimits = new WeakMap<object, number>();
  let active = 0;
  let turn = 0;
  let wake: ReturnType<typeof setTimeout> | undefined;
  const sites = new Map<string, Site>();

  function siteFor(url: string): Site {
    const key = schedulerHostKey(url);
    let site = sites.get(key);
    if (!site) {
      site = {
        pending: [],
        leases: [],
        healthy: 0,
        lastOwner: null,
        turn: turn++,
        host: key,
        readyAt: 0,
        stopped: false,
        stopReason: null,
        unavailable: 0,
        lastStatus: null,
        activeUrl: null,
        activeSince: null,
        activeRequests: 0,
        hostLimit: 1,
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

  function syncActive(site: Site): void {
    site.activeRequests = site.leases.length;
    site.activeUrl = site.leases[0]?.url ?? null;
    site.activeSince = site.leases[0]?.since ?? null;
  }

  // Additive increase, multiplicative decrease, as TCP congestion control.
  // Without auto-throttle `maxPerHost` is 1, so the limit never moves.
  function adapt(site: Site, lease: Lease, now: number): void {
    if (maxPerHost === 1) return;
    const strained =
      lease.status === null ||
      lease.status >= 500 ||
      now - lease.since > slowMs;
    if (strained) {
      site.hostLimit = Math.max(1, Math.floor(site.hostLimit / 2));
      site.healthy = 0;
      return;
    }
    site.healthy += 1;
    if (site.healthy >= site.hostLimit) {
      site.hostLimit = Math.min(maxPerHost, site.hostLimit + 1);
      site.healthy = 0;
    }
  }

  function stop(site: Site, reason: HostStopReason): void {
    if (site.stopped) return;
    site.stopped = true;
    site.stopReason = reason;
  }

  // A bounded frontier contains at most one candidate per known host. Rebuild
  // only on queue/state/capacity changes, with a single wake for future work.
  // Each pass admits at most one request per host, so hosts take turns; passes
  // repeat until one admits nothing, so a host with several free slots fills
  // them all when its gap ends rather than one per event.
  function dispatch(): void {
    if (wake !== undefined) clearTimeout(wake);
    wake = undefined;
    let next = Infinity;
    for (let admitted = true; admitted;) {
      admitted = false;
      const frontier = [...sites.values()].filter(
        (site) => site.pending.length,
      );
      frontier.sort((a, b) => a.readyAt - b.readyAt || a.turn - b.turn);
      for (const site of frontier) {
        if (site.stopped) {
          for (const entry of site.pending.splice(0)) {
            entry.cleanup();
            entry.reject(new HostStoppedError(site.host, site.stopReason));
          }
          site.waiting = 0;
          continue;
        }
        if (site.leases.length >= site.hostLimit || active >= globalLimit)
          continue;
        // The last admitted owner's new backlog takes the last owner turn.
        const previousOwner = site.pending.filter(
          (item) => item.owner === site.lastOwner,
        );
        site.pending = site.pending.filter(
          (item) => item.owner !== site.lastOwner,
        );
        site.pending.push(...previousOwner);
        // Only each owner's first request may compete: preserve owner FIFO.
        const seen = new Set<object>();
        const eligible = site.pending.filter((entry) => {
          if (seen.has(entry.owner)) return false;
          seen.add(entry.owner);
          return (owners.get(entry.owner) ?? 0) < entry.ownerLimit;
        });
        const entry = eligible[0];
        if (!entry) continue;
        if (site.readyAt > Date.now()) {
          next = Math.min(next, site.readyAt);
          continue;
        }
        site.pending.splice(site.pending.indexOf(entry), 1);
        // Rotate the admitted owner's backlog behind the other owner turns.
        const sameOwner = site.pending.filter(
          (item) => item.owner === entry.owner,
        );
        site.pending = site.pending.filter(
          (item) => item.owner !== entry.owner,
        );
        site.pending.push(...sameOwner);
        site.waiting = site.pending.length;
        entry.cleanup();
        active += 1;
        owners.set(entry.owner, (owners.get(entry.owner) ?? 0) + 1);
        const lease: Lease = {
          url: entry.url,
          since: Date.now(),
          status: null,
        };
        site.leases.push(lease);
        syncActive(site);
        site.lastOwner = entry.owner;
        site.turn = turn++;
        admitted = true;
        let released = false;
        entry.resolve(() => {
          if (released) return;
          released = true;
          active -= 1;
          const count = (owners.get(entry.owner) ?? 1) - 1;
          if (count) owners.set(entry.owner, count);
          else owners.delete(entry.owner);
          const now = Date.now();
          site.leases.splice(site.leases.indexOf(lease), 1);
          syncActive(site);
          adapt(site, lease, now);
          site.readyAt = Math.max(site.readyAt, now + gapMs);
          dispatch();
        });
      }
    }
    if (next !== Infinity)
      wake = setTimeout(
        dispatch,
        Math.min(2_147_483_647, Math.max(0, next - Date.now())),
      );
  }

  function acquireRequest(
    url: string,
    admission: RequestAdmission,
    signal?: AbortSignal,
  ): Promise<() => void> {
    const ownerLimit = limit(
      "admission.maxConcurrent",
      admission.maxConcurrent,
    );
    if (typeof admission.owner !== "object" || admission.owner === null)
      throw new TypeError("admission.owner must be a stable object");
    const existingLimit = ownerLimits.get(admission.owner);
    if (existingLimit !== undefined && existingLimit !== ownerLimit)
      throw new RangeError(
        "admission.maxConcurrent must stay constant for an owner",
      );
    ownerLimits.set(admission.owner, ownerLimit);
    const site = siteFor(url);
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(
          signal.reason instanceof Error
            ? signal.reason
            : new Error("Request cancelled"),
        );
        return;
      }
      const abort = () => {
        const index = site.pending.indexOf(entry);
        if (index < 0) return;
        site.pending.splice(index, 1);
        site.waiting = site.pending.length;
        entry.cleanup();
        reject(
          signal?.reason instanceof Error
            ? signal.reason
            : new Error("Request cancelled"),
        );
        dispatch();
      };
      const entry: Pending = {
        url,
        owner: admission.owner,
        ownerLimit,
        resolve,
        reject,
        cleanup: () => signal?.removeEventListener("abort", abort),
      };
      site.pending.push(entry);
      site.waiting = site.pending.length;
      signal?.addEventListener("abort", abort, { once: true });
      dispatch();
    });
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
    dispatch();
  }

  if (options.state) importState(options.state);

  return {
    snapshot() {
      return [...sites.values()].map(
        ({
          pending: _pending,
          leases: _leases,
          healthy: _healthy,
          lastOwner: _owner,
          turn: _turn,
          ...state
        }) => ({
          ...state,
        }),
      );
    },
    exportState() {
      return [...sites.values()].map(stateOf);
    },
    importState,
    acquireRequest,
    acquire(url, signal) {
      return acquireRequest(url, { owner: legacyOwner }, signal);
    },
    answered(url) {
      return (sites.get(schedulerHostKey(url))?.lastStatus ?? null) !== null;
    },
    observe(url, status, retryAfter, request) {
      const site = siteFor(url);
      site.lastStatus = status;
      const lease = site.leases.find(
        (held) => held.url === url && held.status === null,
      );
      if (lease) lease.status = status;
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
      try {
        onChange?.(stateOf(site));
      } finally {
        dispatch();
      }
    },
  };
}
