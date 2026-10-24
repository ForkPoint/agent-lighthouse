import type { RequestScheduler } from "./request-scheduler";
import { randomUUID } from "node:crypto";
import { DomWorkLimitError } from "./dom-work";
import { SnapshotScanOptionsSchema, snapshotUrlKey } from "./schemas";
import type { BrowserSnapshots, ScanPageIdentity } from "./contracts";
import { parsePageContext } from "./page-context";
import { assessBrowserSnapshots } from "./browser-snapshots";
import type { Dispatcher } from "undici";
import type { PageOverride, ScanReport, ScanConditions } from "./types";
import {
  getScoreTier,
  READINESS_WEIGHTS,
  ORIGIN_EVIDENCE_VERSION,
  SCAN_TIMEOUT_MS,
  TAG_SKIPPED_NO_EVIDENCE,
  TAG_SKIPPED_PAGE_TYPE,
  TAG_SKIPPED_SCAN_BUDGET,
} from "./constants";
import {
  LogField,
  logger,
  setLogContextFields,
  withLogContext,
  type LoggerLike,
} from "./logger";

const log = logger.child({ [LogField.Component]: "orchestrator" });
import { createFetcher, isSafeUrl, splitCredentials } from "./fetcher";
import type { Fetcher, HttpExchange } from "./fetcher";
import {
  scanNow,
  seededRandom,
  withScanEnvironment,
  type HostLookup,
} from "./scan-environment";
import { UnreachableHosts, isConnectFailure } from "./unreachable-hosts";
import { gatewayTarget } from "./gateway";
import {
  OriginCache,
  defaultOriginCache,
  computeOriginCacheKey,
  shouldBypassOriginCache,
} from "./origin-cache";
import { declaredPageClassification } from "./parser";
import type {
  CheckContext,
  DomPageContext,
  PageContext,
} from "./check-context";
import { defaultConfig, filterConfig } from "./audit-config";
import {
  planAudits,
  runAudits,
  budgetReason,
  compareCodePoints,
  formatBudget,
} from "./audit-runner";
import type { AuditTraceHandler } from "./audit-runner";
import { ProgressTracker, PhaseId } from "./progress";
import type { ScanEvent } from "./progress";
import { runA11yForHtml } from "./audits/operability-safety/runner";
import { A11Y_RULES } from "./audits/operability-safety";
import { extractProductFieldVerification } from "./product-fields";
import { generateScanSummary } from "./summary";
import { sitemapSiteRoot } from "./gatherers/sitemap";
import {
  isInformative,
  isObsolete,
  gatedMassShare,
  skippedMassShare,
  GATED_MASS_UNSCORED_THRESHOLD,
} from "./scorer";
import { detectWafProtection } from "./waf-detector";
import { buildScanEvidence, unjudgeableReason } from "./scan-evidence";

import type { FetchOptions, FetchResult } from "./fetcher";
import {
  AttemptOutcome,
  AuditTier,
  CheckStatus,
  ClassificationConfidence,
  EvidenceKey,
  PageType,
  PageTypeSource,
  ScoreDisplayMode,
} from "./types";

/**
 * Every option may be passed as `undefined`, which means the same as omitting
 * it: callers forward optional CLI flags and parsed MCP arguments as they are.
 */
export interface ScanOptions {
  /** Versioned, untrusted DOM snapshots associated with the target or declared pages. */
  snapshots?: BrowserSnapshots | undefined;
  onEvent?: ((event: ScanEvent) => void) | undefined;
  pages?: PageOverride[] | null | undefined;
  /** Explicitly declared page type for the target URL. */
  pageType?: PageType | undefined;
  /**
   * The caller's cancellation. Aborting it makes `runScan` throw; the scan
   * budget below never does.
   */
  signal?: AbortSignal | undefined;
  /**
   * Wall-clock budget for the whole scan, in milliseconds. Defaults to
   * {@link SCAN_TIMEOUT_MS}. When it runs out the scan finishes with what it
   * has: requests in flight abort, no further request is sent, and every
   * audit not yet started, or still running when it went, reports `na`
   * tagged `skipped:scan-budget`. `conditions.budget` on the report records
   * it. `0` disables the budget.
   */
  timeoutMs?: number | undefined;
  /**
   * Restrict the scan to these category ids. Unknown ids simply match nothing —
   * validate them at the entry point so the operator hears about a typo.
   */
  categories?: string[] | undefined;
  /**
   * Include audits whose tier is `experimental`. Off by default, per
   * docs/evidence/policy.md: an experimental check is behind a flag and never
   * scored.
   */
  includeExperimental?: boolean | undefined;
  /**
   * Called once per registered audit with what it did — including the ones
   * that were skipped or failed. Use it to trace a verdict back to the
   * evidence it was drawn from; see {@link AuditTrace}.
   */
  onAuditTrace?: AuditTraceHandler | undefined;
  /**
   * Where this scan logs. Any logger with pino's methods works, pino itself
   * included; every line of the scan goes to it, with `site`, `scan` and
   * `component` fields. Omitted, the scan logs to the built-in logger.
   */
  logger?: LoggerLike | undefined;
  /**
   * The id this scan reports as `scanId` and logs as `scan`. Omitted, the
   * scan makes a random UUID, so a log line and its report share one id.
   */
  scanId?: string | undefined;
  /**
   * Skip audits the scan could not feed, instead of running them blind.
   *
   * On by default. An audit whose required evidence the scan never obtained
   * reports `na` tagged `skipped:no-evidence`, with the reason attached, and
   * is never constructed. Set it to `false` to bypass only the per-audit
   * `requires` checks. The unread-scan guard remains unconditional, so a scan
   * that read no attributable site response still runs no audit.
   */
  enforceEvidenceGate?: boolean | undefined;
  /**
   * undici dispatcher for every request this scan makes.
   */
  dispatcher?: Dispatcher | undefined;
  /**
   * How many requests this scan may have in flight at once.
   */
  maxConcurrent?: number | undefined;
  /** Shared pacing for each network request, including redirects. */
  requestScheduler?: RequestScheduler | undefined;
  /**
   * Called once per request the scan sends, redirect hops included, with
   * what came back; see {@link HttpExchange}. Store the exchanges to replay
   * the scan later with `createReplay`.
   */
  onExchange?: ((exchange: HttpExchange) => void) | undefined;
  /**
   * The fetcher every request goes through, in place of the one the scan
   * builds. `createReplay` makes one that reads captured exchanges. With a
   * fetcher given, `dispatcher`, `maxConcurrent`, `requestScheduler`,
   * `headers` and `onExchange` do not apply, and the shared origin evidence
   * cache is bypassed, so cached evidence from another scan cannot stand in
   * for what the fetcher returns.
   */
  fetcher?: Fetcher | undefined;
  /**
   * Resolves host names for the scan's address checks, in place of the
   * system resolver. `createReplay` makes one that knows the captured hosts.
   */
  lookup?: HostLookup | undefined;
  /**
   * The scan's clock, in epoch milliseconds: `scannedAt`, `durationMs`, the
   * origin read time and every date an audit compares against. A replay
   * passes a clock fixed at the capture's scan time. Omitted, `Date.now`.
   */
  now?: (() => number) | undefined;
  /**
   * Extra HTTP request headers to pass on all fetches.
   */
  headers?: Record<string, string> | undefined;
  /**
   * Explicitly bypass the shared origin evidence cache for this scan.
   */
  bypassOriginCache?: boolean | undefined;
  /**
   * Optional custom OriginCache instance (defaults to defaultOriginCache).
   */
  originCache?: OriginCache | undefined;
  /**
   * A `robots.txt` response the caller already has, used instead of fetching
   * it again.
   */
  robotsTxt?: FetchResult | undefined;
  /**
   * The target's own response, as the caller already fetched it, used instead
   * of fetching the target again. It must be a real HTTP response for `url`:
   * its status, headers and redirect chain are read as the scan's own. One
   * whose `url` names another page is ignored. Every other request, gateway
   * pages included, is sent as usual.
   */
  targetPage?: FetchResult | undefined;
  /**
   * The page detection the caller started this scan from. Copied to
   * `report.pageIdentity` as a record; it does not set the page type, so a
   * detected type keeps its detected source.
   */
  pageIdentity?: ScanPageIdentity | undefined;
}

// Cap how many pages get the jsdom-based a11y pass. Accessibility issues are
// template-wide, so the first few pages are representative; this bounds the
// per-scan cost so one heavy site can't dominate the worker. 0 disables the
// a11y pass entirely (audits degrade to "not applicable").
const A11Y_MAX_PAGES = Math.max(
  0,
  Number(process.env["SCANNER_A11Y_MAX_PAGES"] ?? 3),
);

/**
 * Statuses that mean "too many requests" and earn one retry. 428 is what some
 * apex redirectors answer once a burst from one IP passes their limit, with an
 * empty body; a request a few seconds later passes.
 */
const THROTTLE_STATUSES = new Set([428, 429]);

/** How long to wait before the single throttle retry when no `Retry-After` says. */
const RATE_LIMIT_BACKOFF_MS = 5_000;
/** A `Retry-After` longer than this is the site telling us to come back later. */
const MAX_RETRY_AFTER_MS = 30_000;

/** The result a request gets once the budget is gone: nothing was sent. */
function unsentResult(url: string, error: string): FetchResult {
  return {
    url,
    finalUrl: url,
    status: 0,
    headers: {},
    body: "",
    ttfbMs: 0,
    totalMs: 0,
    contentType: "",
    contentLength: 0,
    error,
  };
}

/**
 * Fetch a page, retrying once on a throttle (HTTP 429, or 428 from a burst limit).
 */
async function fetchPageWithRetry(
  fetcher: { fetch: (options: FetchOptions) => Promise<FetchResult> },
  url: string,
  fetchSignal?: AbortSignal,
  cancel?: AbortSignal,
): Promise<FetchResult> {
  const first = await fetcher.fetch({ url, signal: fetchSignal });
  if (!THROTTLE_STATUSES.has(first.status)) return first;

  const header = Number(first.headers["retry-after"]);
  const waitMs =
    Number.isFinite(header) && header > 0
      ? Math.min(header * 1000, MAX_RETRY_AFTER_MS)
      : RATE_LIMIT_BACKOFF_MS;

  log.debug(
    { [LogField.Url]: url, [LogField.HttpStatus]: first.status, waitMs },
    "Page throttled; retrying once",
  );
  // The wait ends early when either signal fires, and is skipped when one
  // already has: an aborted signal never dispatches `abort` again, and the
  // budget usually goes during the first fetch of a throttled origin.
  if (!fetchSignal?.aborted)
    await new Promise<void>((resolve) => {
      const timer = setTimeout(done, waitMs);
      function done(): void {
        clearTimeout(timer);
        fetchSignal?.removeEventListener("abort", done);
        resolve();
      }
      fetchSignal?.addEventListener("abort", done, { once: true });
    });
  // Only the caller's cancellation ends the scan. When the budget is gone
  // the 429 stands as observed: the site throttled the scan, and a made-up
  // status 0 would report it as unreachable instead.
  cancel?.throwIfAborted();
  if (fetchSignal?.aborted) return first;

  return fetcher.fetch({ url, signal: fetchSignal });
}

// ── Main Scan ──────────────────────────────────────────────────

/**
 * The caller's target response, when it is a response for `url`. URLs compare
 * without credentials, fragment or trailing slash, as snapshots associate. A
 * response for another page is ignored, and the target is fetched as usual:
 * reading it as the target would judge the wrong page.
 */
function reusableTargetPage(
  url: string,
  page: FetchResult | undefined,
): FetchResult | undefined {
  if (!page) return undefined;
  try {
    if (snapshotUrlKey(page.url) === snapshotUrlKey(url)) return page;
  } catch {
    // An unparseable URL is never the target.
  }
  log.debug(
    { [LogField.Url]: splitCredentials(url).url, given: page.url },
    "Ignoring a target response for another URL",
  );
  return undefined;
}

/** A URL without its fragment and trailing slash, to tell two URLs of one page. */
function samePageKey(pageUrl: string): string {
  return pageUrl.replace(/#.*$/, "").replace(/\/$/, "");
}

/**
 * The URL that answered a page request, when redirects moved it to another
 * page. Credentials never reach the report, on either side of the comparison.
 */
function redirectedTo(requested: string, finalUrl: string): string | undefined {
  if (!finalUrl) return undefined;
  const answered = splitCredentials(finalUrl).url;
  return samePageKey(answered) === samePageKey(splitCredentials(requested).url)
    ? undefined
    : answered;
}

export async function runScan(
  url: string,
  options?: ScanOptions,
): Promise<ScanReport> {
  const input = SnapshotScanOptionsSchema.parse(options ?? {});
  if (input.snapshots) {
    const allowed = new Set(
      [url, ...(input.pages ?? []).map((page) => page.url)].map(snapshotUrlKey),
    );
    for (const page of input.snapshots.pages) {
      if (!allowed.has(snapshotUrlKey(page.requestedUrl)))
        throw new Error(
          `Snapshot requestedUrl is not the scan target or a supplied page: ${page.requestedUrl}`,
        );
    }
    // Use validated, copied values throughout the scan; caller mutations cannot change evidence.
    options = { ...options, snapshots: input.snapshots };
  }
  const limitMs = options?.timeoutMs ?? SCAN_TIMEOUT_MS;
  // A negative or NaN budget would silently mean "no budget" and then fail
  // the report schema, which wants `limitMs` non-negative. Refuse it here.
  if (!Number.isFinite(limitMs) || limitMs < 0)
    throw new RangeError(
      `timeoutMs must be a non-negative number of milliseconds, got ${String(options?.timeoutMs)}`,
    );
  // Every line logged during this scan names it, so lines from scans that
  // run side by side can be told apart.
  const scanId = options?.scanId ?? randomUUID();
  // Probe tokens and other per-scan values come from the scan id, so a
  // replay with the same id sends the same requests.
  const environment = {
    random: seededRandom(scanId),
    ...(options?.now !== undefined && { now: options.now }),
    ...(options?.lookup !== undefined && { lookup: options.lookup }),
  };
  return withScanEnvironment(environment, () =>
    withLogContext(
      { [LogField.Site]: logSite(url), [LogField.Scan]: scanId },
      async () => {
        const started = performance.now();
        log.debug({ [LogField.Url]: url, budgetMs: limitMs }, "Scan started");
        const budget = new AbortController();
        const timer =
          limitMs > 0
            ? setTimeout(() => {
                const message = `The scan budget of ${formatBudget(limitMs)} ran out.`;
                log.warn({ budgetMs: limitMs }, message);
                budget.abort(new Error(message));
              }, limitMs)
            : undefined;
        try {
          const report = await scanWithinBudget(url, options, {
            signal: budget.signal,
            limitMs,
            scanId,
          });
          log.info(
            {
              [LogField.DurationMs]: Math.round(performance.now() - started),
              score: report.overallScore,
              pages: report.pagesScanned.length,
              budgetExhausted: budget.signal.aborted,
              unscoredReason: report.scanValidity?.unscoredReason,
            },
            "Scan finished",
          );
          return report;
        } catch (error) {
          log.debug(
            {
              [LogField.DurationMs]: Math.round(performance.now() - started),
              [LogField.Error]: error,
            },
            "Scan threw",
          );
          throw error;
        } finally {
          if (timer !== undefined) clearTimeout(timer);
        }
      },
      options?.logger,
    ),
  );
}

/** The host a log line names for a scan, without credentials. */
function logSite(url: string): string {
  try {
    return new URL(splitCredentials(url).url).host;
  } catch {
    return url;
  }
}

async function scanWithinBudget(
  url: string,
  options: ScanOptions | undefined,
  budget: { signal: AbortSignal; limitMs: number; scanId: string },
): Promise<ScanReport> {
  const onEvent = options?.onEvent;
  const pageOverrides = options?.pages;
  const signal = options?.signal;
  // Every request answers to the caller's signal and to the budget. Only the
  // caller's signal ends the scan; the budget ends the fetching.
  const fetchSignal = signal
    ? AbortSignal.any([signal, budget.signal])
    : budget.signal;

  const tracker = new ProgressTracker((event) => {
    // Lines written from here on carry the phase they belong to.
    if (event.type === "phase:start")
      setLogContextFields({ [LogField.Phase]: event.phase });
    if (event.type === "phase:done")
      log.debug(
        {
          phase: event.phase,
          [LogField.DurationMs]: Math.round(event.durationMs),
        },
        "Phase done",
      );
    onEvent?.(event);
  });
  const start = scanNow();
  const fetcher =
    options?.fetcher ??
    createFetcher({
      ...(options?.requestScheduler !== undefined && {
        requestScheduler: options.requestScheduler,
      }),
      ...(options?.onExchange !== undefined && {
        onExchange: options.onExchange,
      }),
      ...(options?.dispatcher !== undefined && {
        dispatcher: options.dispatcher,
      }),
      ...(options?.maxConcurrent !== undefined && {
        maxConcurrent: options.maxConcurrent,
      }),
      ...(options?.headers !== undefined && { headers: options.headers }),
    });

  const baseUrl = new URL(url).origin;
  const domain = new URL(url).hostname;
  const displayUrl = splitCredentials(url).url;

  // Normalize user-supplied page overrides: resolve, dedupe (trailing-slash
  // insensitive), and drop any that collide with the scanned page.
  const targetKey = new URL(url).href.replace(/\/$/, "");
  const overrideTypeByKey = new Map<string, PageType>();
  const overrideUrls: string[] = [];
  for (const ov of pageOverrides ?? []) {
    let resolved: string;
    try {
      resolved = new URL(ov.url).href;
    } catch {
      continue;
    }
    const key = resolved.replace(/\/$/, "");
    if (key === targetKey) {
      overrideTypeByKey.set(key, ov.pageType);
      continue;
    }
    if (overrideTypeByKey.has(key)) continue;
    overrideTypeByKey.set(key, ov.pageType);
    overrideUrls.push(resolved);
  }

  // ── Phase 1: Root-level file checks & Origin Evidence (parallel) ───────────────
  signal?.throwIfAborted();
  tracker.scanStart(displayUrl);

  const rootFilePaths = [
    "/robots.txt",
    "/llms.txt",
    "/llms-full.txt",
    "/agents.md",
    "/sitemap.xml",
    "/sitemap-index.xml",
    "/rss.xml",
    "/feed.xml",
    "/openapi.json",
    "/openapi.yaml",
    "/.well-known/api-catalog",
    "/.well-known/ai-catalog.json",
    "/.well-known/ard.json",
    "/.well-known/mcp/servers.json",
    "/.well-known/ucp",
    "/.well-known/agents.json",
    "/.well-known/agent-card.json",
    "/.well-known/agent.json",
    "/.well-known/ai-plugin.json",
    "/.well-known/security.txt",
    "/.well-known/tdmrep.json",
    "/navigation.json",
    "/about/",
    "/about-us/",
    "/about",
    "/pages/about",
    "/pages/about-us",
    "/pages/our-story",
    "/our-story",
  ];

  const originCache = options?.originCache ?? defaultOriginCache;
  const bypassCache =
    shouldBypassOriginCache(url, options) ||
    !!options?.robotsTxt ||
    options?.fetcher !== undefined;
  const originCacheKey = computeOriginCacheKey(
    url,
    ORIGIN_EVIDENCE_VERSION,
    options?.headers,
  );

  let cachedEvidence = !bypassCache
    ? originCache.get(originCacheKey)
    : undefined;
  let rootFiles: Record<string, FetchResult>;
  let originHomepageResult: FetchResult | undefined;
  let originCached = false;
  let originReadAt: string;
  // True when this scan read the origin itself and owes the cache a write.
  let originFresh = false;
  const reused = reusableTargetPage(url, options?.targetPage);
  let earlyPage: Promise<FetchResult> | undefined;

  if (cachedEvidence) {
    rootFiles = cachedEvidence.rootFiles;
    originHomepageResult = cachedEvidence.originHomepage;
    originCached = true;
    originReadAt = cachedEvidence.readAt;
    tracker.phaseStart(PhaseId.FetchRoot, 0);
    tracker.phaseDone();
    log.debug({ origin: baseUrl }, "Reusing cached origin evidence");
  } else {
    tracker.phaseStart(PhaseId.FetchRoot, rootFilePaths.length);

    // robots.txt goes first, alone, and the other root files wait for it.
    // undici does not cancel a request that is waiting for a connection, so
    // on an origin that accepts none, 25 more files sent together each waited
    // out the connect timeout in turn: 90 s before the homepage fetch, which
    // then failed too. One connect failure can be a one-off under load, so
    // robots.txt is tried a second time before the origin is given up on. A
    // TLS error, a reset or any HTTP status shows the host is there.
    const robotsUrl = `${baseUrl}/robots.txt`;
    let robots =
      options?.robotsTxt ??
      (await fetcher.fetch({ url: robotsUrl, signal: fetchSignal }));
    if (isConnectFailure(robots))
      robots = await fetcher.fetch({ url: robotsUrl, signal: fetchSignal });
    tracker.unitDone("/robots.txt");
    const refused = isConnectFailure(robots)
      ? `${new URL(baseUrl).host} did not accept a connection: ${robots.error}`
      : undefined;
    if (refused) log.debug({ reason: refused }, "Root files not sent");

    // The scanned page is the main evidence, so it is asked for next, before
    // the other root files. Most sites have few of those files, and a run of
    // 404s from one client is what firewall scanner rules look for; a host
    // that closes on them should close after the page is in hand. With a
    // per-host queue, requests leave in the order they are made.
    if (!reused) {
      earlyPage = fetchPageWithRetry(fetcher, url, fetchSignal, signal);
      // Awaited in phase 2; this keeps a cancellation during the root files
      // from surfacing as an unhandled rejection first.
      earlyPage.catch(() => {});
    }

    const rootResults = await Promise.all(
      rootFilePaths.map((path) => {
        if (path === "/robots.txt") return Promise.resolve(robots);
        const fileUrl = `${baseUrl}${path}`;
        if (refused) {
          tracker.unitDone(path);
          return Promise.resolve(unsentResult(fileUrl, refused));
        }
        return fetcher
          .fetch({ url: fileUrl, signal: fetchSignal })
          .then((result) => {
            tracker.unitDone(path);
            return result;
          });
      }),
    );

    rootFiles = {};
    rootFilePaths.forEach((path, i) => {
      rootFiles[path] = rootResults[i]!;
    });

    // A homepage scan is about to fetch the origin homepage as its page, so
    // it is not fetched twice here; the page result fills the slot below.
    const isHomepageScan = url === `${baseUrl}/` || url === baseUrl;
    originHomepageResult = isHomepageScan
      ? undefined
      : await fetchPageWithRetry(fetcher, `${baseUrl}/`, fetchSignal, signal);

    originReadAt = new Date(scanNow()).toISOString();
    originFresh = true;

    tracker.phaseDone();
  }

  // ── Phase 2: Page-level checks (parallel per page) ───────────
  signal?.throwIfAborted();

  tracker.phaseStart(PhaseId.FetchPages, 1 + overrideUrls.length);
  const pageResult =
    reused ??
    (await (earlyPage ??
      fetchPageWithRetry(fetcher, url, fetchSignal, signal)));
  tracker.unitDone(displayUrl);

  if (!originHomepageResult && (url === `${baseUrl}/` || url === baseUrl)) {
    originHomepageResult = pageResult;
  }

  // The cache is written only now, after a homepage scan has filled the
  // origin homepage slot from its own page fetch. Written earlier, a homepage
  // scan stored `undefined` and every later scan of the origin inherited it,
  // so the evidence depended on which URL happened to be scanned first.
  if (originFresh && !bypassCache) {
    originCache.set(originCacheKey, {
      origin: baseUrl,
      version: ORIGIN_EVIDENCE_VERSION,
      readAt: originReadAt,
      rootFiles,
      ...(originHomepageResult !== undefined && {
        originHomepage: originHomepageResult,
      }),
    });
  }

  // Parse the requested page once, here, so the gateway check below and
  // Phase 2b share one DOM instead of parsing a large page twice.
  const firstForcedType =
    options?.pageType ?? overrideTypeByKey.get(displayUrl.replace(/\/$/, ""));
  let firstParse:
    { page: DomPageContext } | { error: DomWorkLimitError } | undefined;
  if (pageResult.status === 200 && pageResult.body) {
    try {
      firstParse = {
        page: parsePageContext(displayUrl, pageResult.body, firstForcedType),
      };
    } catch (error) {
      if (!(error instanceof DomWorkLimitError)) throw error;
      firstParse = { error };
    }
  }

  // A gateway page (no readable text, a same-origin meta refresh or canonical
  // to the real homepage) is kept as scanned, and its target is read as one
  // more page, so the scan judges the site behind it. One hop, never a chain.
  const gatewayUrls: string[] = [];
  const gatewayCandidate =
    firstParse && "page" in firstParse
      ? gatewayTarget(firstParse.page, pageResult.finalUrl || url)
      : undefined;
  // gatewayTarget skips a target that names the page it landed on. A target
  // that names the requested URL, or any hop of the redirect that led here,
  // only leads back to this page: a www shell whose canonical names the apex
  // was read twice.
  const seenUrls = new Set(
    [
      url,
      displayUrl,
      pageResult.finalUrl,
      ...(pageResult.redirectChain ?? []).flatMap((hop) => [hop.from, hop.to]),
    ]
      .filter(Boolean)
      .map(samePageKey),
  );
  if (
    gatewayCandidate !== undefined &&
    !seenUrls.has(samePageKey(gatewayCandidate)) &&
    !overrideTypeByKey.has(gatewayCandidate.replace(/\/$/, "")) &&
    (await isSafeUrl(gatewayCandidate))
  ) {
    log.debug(
      { from: displayUrl, to: gatewayCandidate },
      "Requested page is a gateway; reading its target",
    );
    gatewayUrls.push(gatewayCandidate);
    tracker.setPhaseTotal(2 + overrideUrls.length);
  }

  const extraUrls = [...gatewayUrls, ...overrideUrls];
  const extraResults = await Promise.all(
    extraUrls.map((pageUrl) =>
      fetcher.fetch({ url: pageUrl, signal: fetchSignal }).then((result) => {
        tracker.unitDone(pageUrl);
        return result;
      }),
    ),
  );
  tracker.phaseDone();

  const allPageResults = [pageResult, ...extraResults];
  const allPageUrls = [displayUrl, ...extraUrls];

  // ── Phase 2b: Parse pages + bounded jsdom a11y pass ─────────
  tracker.phaseStart(
    PhaseId.Analyze,
    allPageResults.filter((r) => r.status === 200 && r.body).length,
  );

  const pageAnalysisErrors: Record<string, string> = {};
  const pages: PageContext[] = allPageResults
    .map((r, i) => ({ result: r, url: allPageUrls[i]!, index: i }))
    .filter((p) => p.result.status === 200 && p.result.body)
    .flatMap((p) => {
      const isFirstPage = p.index === 0;
      if (isFirstPage && firstParse) {
        if ("error" in firstParse) {
          // A local work limit is not a refused HTTP request or missing site markup.
          pageAnalysisErrors[p.url] = firstParse.error.message;
          tracker.unitFail(p.url, firstParse.error.message);
          return [];
        }
        tracker.unitDone(p.url);
        return [{ ...firstParse.page, fetchResult: p.result }];
      }
      const forcedType =
        (isFirstPage && options?.pageType ? options.pageType : undefined) ??
        overrideTypeByKey.get(p.url.replace(/\/$/, ""));
      try {
        const parsed = parsePageContext(p.url, p.result.body, forcedType);
        tracker.unitDone(p.url);
        return [{ ...parsed, fetchResult: p.result }];
      } catch (error) {
        if (!(error instanceof DomWorkLimitError)) throw error;
        // A local work limit is not a refused HTTP request or missing site markup.
        pageAnalysisErrors[p.url] = error.message;
        tracker.unitFail(p.url, error.message);
        return [];
      }
    });

  // Run bounded jsdom a11y pass on up to A11Y_MAX_PAGES pages
  if (A11Y_MAX_PAGES > 0 && pages.length > 0) {
    const a11yPages = pages.slice(0, A11Y_MAX_PAGES);
    await Promise.all(
      a11yPages.map(async (page) => {
        try {
          page.a11yResults = await runA11yForHtml(
            page.fetchResult.body,
            page.url,
            A11Y_RULES,
            fetchSignal,
          );
        } catch {
          // jsdom failed on this page — audits degrade to na
        }
      }),
    );
  }

  tracker.phaseDone();

  // ── Phase 3: Run audits against context ──────────────────────
  signal?.throwIfAborted();

  const wafProtection = detectWafProtection(
    url,
    pageResult,
    rootFiles,
    allPageResults.filter((result) => result.status === 200 && result.body)
      .length,
  );
  if (wafProtection)
    log.debug(
      {
        name: wafProtection.name,
        blocked: wafProtection.isBlocked,
        reason: wafProtection.reason,
        [LogField.HttpStatus]: pageResult.status,
      },
      "Bot wall detected",
    );

  const evidence = buildScanEvidence({
    requestedUrl: url,
    homepageResult: pageResult,
    pages,
    rootFiles,
    wafProtection: wafProtection ?? null,
    ...(Object.keys(pageAnalysisErrors).length ? { pageAnalysisErrors } : {}),
  });

  const pageAttempts = allPageResults
    .map((result, index) => {
      const pageUrl = allPageUrls[index]!;
      const parsed = pages.find((p) => p.url === pageUrl);
      const forcedType =
        (index === 0 ? options?.pageType : undefined) ??
        overrideTypeByKey.get(pageUrl.replace(/\/$/, ""));
      const classification =
        parsed?.classification ??
        (forcedType
          ? declaredPageClassification(forcedType)
          : { type: PageType.General, source: PageTypeSource.Detected });
      const finalUrl = redirectedTo(pageUrl, result.finalUrl);
      return {
        url: pageUrl,
        pageType: classification.type,
        source: classification.source,
        outcome: parsed ? AttemptOutcome.Read : AttemptOutcome.Unread,
        status: result.status,
        ...(finalUrl && { finalUrl }),
      };
    })
    .sort((a, b) => compareCodePoints(a.url, b.url));

  // Requests the scan answered itself instead of sending; logged at the end.
  const notSent = { budget: 0, unreachable: 0 };
  const unreachableHosts = new UnreachableHosts([
    url,
    pageResult.finalUrl || url,
  ]);
  const siteRootUrl = sitemapSiteRoot(
    pages.find((page) => page.url === displayUrl),
  );
  const ctx: CheckContext = {
    ...(Object.keys(pageAnalysisErrors).length ? { pageAnalysisErrors } : {}),
    pageAttempts,
    targetUrl: displayUrl,
    rootFiles,
    pages,
    domain,
    baseUrl,
    ...(siteRootUrl !== undefined && { siteRootUrl }),
    // Once the budget is gone no request leaves: the audit reads an error
    // result at once, the same shape a refused connection gives it. A host
    // that refused a connection earlier in the scan gets the same treatment.
    fetch: async (options) => {
      if (budget.signal.aborted) {
        notSent.budget += 1;
        return unsentResult(options.url, budgetReason(budget.signal));
      }
      const refusal = unreachableHosts.refusal(options.url);
      if (refusal) {
        notSent.unreachable += 1;
        return unsentResult(options.url, refusal);
      }
      const result = await fetcher.fetch({ ...options, signal: fetchSignal });
      unreachableHosts.record(options.url, result);
      return result;
    },
    ...(wafProtection != null && { wafProtection }),
    evidence,
    originEvidence: {
      origin: baseUrl,
      version: ORIGIN_EVIDENCE_VERSION,
      readAt: originReadAt,
      cached: originCached,
      ...(originHomepageResult !== undefined && {
        originHomepage: originHomepageResult,
      }),
    },
  };

  const config = filterConfig(defaultConfig, {
    ...(options?.categories !== undefined && {
      categories: options.categories,
    }),
    includeExperimental: options?.includeExperimental ?? false,
  });

  const auditPlan = planAudits(ctx, config, {
    enforceEvidence: options?.enforceEvidenceGate ?? true,
  });
  tracker.phaseStart(
    PhaseId.Audits,
    auditPlan.runnable.length + auditPlan.skipped.length,
  );

  const {
    checks: allChecks,
    categories,
    overallScore,
  } = await runAudits(
    ctx,
    config,
    (event) => {
      if (event.type === "unit:done") tracker.unitDone(event.label);
      else tracker.unitFail(event.label, event.error);
    },
    auditPlan,
    options?.onAuditTrace,
    budget.signal,
  );
  tracker.phaseDone();
  // A caller cancelled during the audits phase gets the throw it asked for,
  // not a report whose running audits read cancelled requests as failures.
  signal?.throwIfAborted();
  // Read now, not at the end: a budget that runs out while the report is
  // being assembled cut nothing, and must not say it did.
  const budgetExhausted = budget.signal.aborted;

  const requests = fetcher.summary();
  const failed = Object.values(requests.failures).reduce((a, b) => a + b, 0);
  log.debug(
    {
      budgetExhausted,
      requests: requests.requests,
      statuses: requests.statuses,
      failures: requests.failures,
      notSentBudget: notSent.budget,
      notSentUnreachable: notSent.unreachable,
      open: requests.open.length,
    },
    "Audits finished",
  );
  // One line per scan for every failed request, grouped by error code. Each
  // failure has its own debug line; at warn they would bury the terminal.
  if (failed > 0)
    log.warn(
      { failed, requests: requests.requests, failures: requests.failures },
      "Some requests got no answer",
    );
  if (requests.open.length > 0)
    log.warn(
      {
        count: requests.open.length,
        oldest: requests.open
          .sort((a, b) => b.ms - a.ms)
          .slice(0, 5)
          .map((r) => `${r.url} (${r.ms} ms)`),
      },
      "Requests still open after the audits",
    );

  // ── Phase 4: Assemble report ─────────────────────────────────
  tracker.phaseStart(PhaseId.Report, 1);

  const durationMs = Math.round(scanNow() - start);

  // Informative checks carry no score and no fix worth surfacing, so they are
  // advisory-only: they never become recommendations, top fails or top passes.
  // `na` is not a finding: an audit that had nothing to assess has nothing to
  // recommend. `packages/report` has always filtered this way; core did not,
  // and the evidence gate multiplies the difference.
  const recommendations = allChecks
    .filter(
      (c) =>
        (c.status === CheckStatus.Fail || c.status === CheckStatus.Warn) &&
        !isInformative(c),
    )
    .slice()
    .sort((a: { priority: string }, b: { priority: string }) => {
      const order: Record<string, number> = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
      };
      return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
    });

  // Extract Top 10 Fails (already sorted by priority in recommendations)
  const topFails = recommendations.slice(0, 10);

  // Extract Top 10 Passes (sorted by the weight stamped on each check)
  const topPasses = allChecks
    .filter((c) => c.status === CheckStatus.Pass && !isInformative(c))
    .slice()
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
    .slice(0, 10);

  // Informative checks carry no meaningful score, so they must not drag the
  // readiness averages (and therefore readinessScore) around.
  const readinessVitals = calculateReadinessVitals(
    allChecks.filter((c) => !isInformative(c)),
  );
  const readinessScore = Math.round(
    readinessVitals.commerce * READINESS_WEIGHTS.commerce +
      readinessVitals.content * READINESS_WEIGHTS.content +
      readinessVitals.botAccessibility * READINESS_WEIGHTS.botAccessibility +
      readinessVitals.technical * READINESS_WEIGHTS.technical,
  );

  // A number is a claim about the site. Two things make one meaningless: a scan
  // that never reached the site (§7.1), and a scan the gate stripped so far
  // that the remaining mass is not the registry any more (§7.2). Both report
  // no score rather than a low one.
  // The budget is a third: a scan cut before it assessed most of the
  // registry is a reading of the clock, not of the site.
  const gatedShare = gatedMassShare(allChecks);
  const escalated = gatedShare > GATED_MASS_UNSCORED_THRESHOLD;
  // The budget's cut counts with the gate's: 30% gated and 30% cut is 60%
  // of the registry unread, whichever reason each part carries.
  const budgetShare = skippedMassShare(allChecks, TAG_SKIPPED_SCAN_BUDGET);
  const unassessedShare = gatedShare + budgetShare;
  const cut =
    !escalated &&
    budgetShare > 0 &&
    unassessedShare > GATED_MASS_UNSCORED_THRESHOLD;
  const budgetSentence = budgetExhausted ? budgetReason(budget.signal) : "";
  const unscoredReason = !evidence.judgeable
    ? budgetExhausted
      ? `${budgetSentence} ${unjudgeableReason(evidence)}`
      : unjudgeableReason(evidence)
    : escalated
      ? `The scan could not feed ${Math.round(gatedShare * 100)}% of the registry's evidence mass, ` +
        "so what remains is not a reading of this site."
      : cut
        ? `${budgetSentence} ${Math.round(unassessedShare * 100)}% of the registry's evidence mass was never assessed, ` +
          "so what remains is not a reading of this site."
        : undefined;
  const scored = unscoredReason === undefined;

  // ── Conditions Calculation (Phase 6: Law 8) ──────────────────
  const allScoredAudits = Object.values(config.audits)
    .flat()
    .filter((a) => a.meta.tier === AuditTier.Scored);

  let registryMass = 0;
  let pageMass = 0;
  let originMass = 0;

  for (const reg of allScoredAudits) {
    const weight = reg.meta.weight;
    registryMass += weight;
    const isPageScoped =
      reg.meta.requires?.includes(EvidenceKey.RenderedBody) ||
      reg.meta.requires?.includes(EvidenceKey.SampleAdequate) ||
      // Read both spellings: a custom audit may still use legacy `pageTypes`.
      Boolean((reg.meta.applicablePageTypes ?? reg.meta.pageTypes)?.length);
    if (isPageScoped) {
      pageMass += weight;
    } else {
      originMass += weight;
    }
  }

  const assessedMass = allChecks
    .filter((c) => c.status !== CheckStatus.NotApplicable && !isInformative(c))
    .reduce((sum, c) => sum + (c.weight ?? 0), 0);

  const gatedMass = allChecks
    .filter(
      (c) => !isInformative(c) && c.tags?.includes(TAG_SKIPPED_NO_EVIDENCE),
    )
    .reduce((sum, c) => sum + (c.weight ?? 0), 0);

  let informativeCount = 0;
  let gatedCount = 0;
  const unscoredReasons: Record<string, number> = {};

  for (const check of allChecks) {
    if (isInformative(check)) {
      informativeCount++;
      // Obsolete checks are informative too; their own key lets a reader of
      // the JSON tell "not scored yet" from "retired, never will be".
      const reason = isObsolete(check)
        ? AuditTier.Obsolete
        : ScoreDisplayMode.Informative;
      unscoredReasons[reason] = (unscoredReasons[reason] ?? 0) + 1;
    } else if (check.status === CheckStatus.NotApplicable) {
      if (check.tags?.includes(TAG_SKIPPED_NO_EVIDENCE)) {
        gatedCount++;
        unscoredReasons["skipped-no-evidence"] =
          (unscoredReasons["skipped-no-evidence"] ?? 0) + 1;
      } else if (check.tags?.includes(TAG_SKIPPED_PAGE_TYPE)) {
        unscoredReasons["skipped-page-type"] =
          (unscoredReasons["skipped-page-type"] ?? 0) + 1;
      } else if (check.tags?.includes(TAG_SKIPPED_SCAN_BUDGET)) {
        unscoredReasons["skipped-scan-budget"] =
          (unscoredReasons["skipped-scan-budget"] ?? 0) + 1;
      } else {
        unscoredReasons["not-applicable"] =
          (unscoredReasons["not-applicable"] ?? 0) + 1;
      }
    }
  }

  const totalUnscored =
    informativeCount +
    allChecks.filter(
      (c) => c.status === CheckStatus.NotApplicable && !isInformative(c),
    ).length;

  const declaredOverrideType =
    options?.pageType ?? overrideTypeByKey.get(targetKey);

  // `pages` holds only the pages that answered 200, so its first entry is
  // not always the target: with the target down and an override up, it is
  // the override. The conditions block names the target, so its page type
  // must come from the target's own entry or from the explicit fallback.
  const primaryPage = pages.find((p) => p.url === displayUrl);
  const pageTypeCondition =
    primaryPage?.classification ??
    (declaredOverrideType
      ? declaredPageClassification(declaredOverrideType)
      : {
          type: PageType.General,
          source: PageTypeSource.Detected,
          confidence: ClassificationConfidence.Unknown,
          signals: ["page-unread"],
        });

  const originCondition = {
    origin: baseUrl,
    version: ORIGIN_EVIDENCE_VERSION,
    readAt: originReadAt,
    cached: originCached,
  };

  const conditions: ScanConditions = {
    url: displayUrl,
    pageType: pageTypeCondition,
    origin: originCondition,
    coverage: {
      registryMass: Number(registryMass.toFixed(1)),
      assessedMass: Number(assessedMass.toFixed(1)),
      pageMass: Number(pageMass.toFixed(1)),
      originMass: Number(originMass.toFixed(1)),
      gatedMass: Number(gatedMass.toFixed(1)),
    },
    unscored: {
      totalCount: totalUnscored,
      informativeCount,
      gatedCount,
      reasons: unscoredReasons,
    },
    // Counted over every check, advisory ones included: the reasons map
    // files an informative stub under `informative`, but the budget cut it
    // all the same.
    budget: {
      limitMs: budget.limitMs,
      elapsedMs: durationMs,
      exhausted: budgetExhausted,
      skippedCount: allChecks.filter((c) =>
        c.tags?.includes(TAG_SKIPPED_SCAN_BUDGET),
      ).length,
    },
  };

  const productFields = [...overrideTypeByKey.values()].includes(
    PageType.Product,
  )
    ? extractProductFieldVerification(pages)
    : undefined;
  const report: ScanReport = {
    scanId: budget.scanId,
    url: displayUrl,
    domain,
    overallScore: scored ? overallScore : null,
    scoreTier: scored ? getScoreTier(overallScore) : null,
    scanValidity: {
      judgeable: evidence.judgeable,
      evidence: evidence.met,
      reasons: evidence.reasons,
      ...(unscoredReason ? { unscoredReason } : {}),
    },
    summary: "", // Set below
    categories,
    topPasses,
    topFails,
    recommendations,
    pageAttempts,
    pagesScanned: pages.map((p) => ({
      url: p.url,
      pageType: p.pageType,
      ...(p.classification !== undefined && {
        classification: p.classification,
      }),
    })),
    scannedAt: new Date(scanNow()).toISOString(),
    durationMs,
    readinessScore,
    readinessVitals,
    ...(wafProtection != null && { wafProtection }),
    // Field-level verification is only trustworthy when the user explicitly
    // supplied the product page. Without a product override we don't guess from
    // other scanned pages — leave it unset so the report marks it skipped.
    ...(productFields !== undefined && { productFields }),
    originEvidence: originCondition,
    conditions,
    ...(options?.pageIdentity !== undefined && {
      pageIdentity: options.pageIdentity,
    }),
  };

  // Snapshot execution has its own contexts, caches, evidence gates and denominator.
  // It occurs after crawler assembly and cannot alter any crawler report fields.
  if (options?.snapshots) {
    report.browserAssessment = await assessBrowserSnapshots(
      options.snapshots,
      config,
      {
        ...options,
        pages: [
          ...(options.pageType
            ? [{ url: displayUrl, pageType: options.pageType }]
            : []),
          ...(options.pages ?? []).filter(
            (page) =>
              !options.pageType ||
              snapshotUrlKey(page.url) !== snapshotUrlKey(displayUrl),
          ),
        ],
      },
      signal,
    );
  }
  report.summary = generateScanSummary(report);
  tracker.unitDone();
  tracker.phaseDone();
  tracker.scanDone(report.overallScore);

  return report;
}

/**
 * Readiness vitals average only the *applicable* checks. `na` checks carry a
 * stub score of 0, so counting them deflated every vital on sites where a whole
 * area does not apply (a blog has no commerce pages, yet scored 0% Commerce).
 *
 * A vital with no applicable checks reads as 0, i.e. "no data". That is the
 * neutral value the rest of the pipeline already substitutes for absent vitals
 * (`report.readinessVitals ?? { commerce: 0, ... }` in the report view-model and
 * in generateScanSummary), so 0 keeps one meaning across the codebase. 100 was
 * rejected: readinessScore is a weighted sum of the four vitals, and awarding a
 * full 100 for zero evidence would inflate the headline score of any site that
 * simply has nothing to measure.
 */
/**
 * The audit ids each id-driven vital averages, in v2 `category/slug` form.
 *
 * Exported so a test can prove every id still resolves to a registered audit:
 * a rename that misses this list would silently empty a vital.
 */
export const READINESS_VITAL_IDS = {
  /** v1 3.8, 3.14, 3.21, 3.22, 3.23, 3.24 after the v2 rename. */
  commerce: [
    "structured-data/service-schema",
    "agentic-commerce/offer-schema",
    "agentic-commerce/product-identifiers",
    "structured-data/advanced-product-details",
    // 3.23 (product-reviews) folded into 3.13 (review-schema) in Plan 4.
    "structured-data/review-schema",
    "agentic-commerce/product-transaction-certainty",
  ],
  /** The v1 content list, minus sunsets, with merged ids mapped to survivors. */
  content: [
    "machine-discovery/llms-txt-exists",
    "machine-discovery/llms-txt-structure",
    "machine-discovery/llms-txt-link-descriptions",
    "machine-discovery/llms-txt-links-valid",
    "machine-discovery/llms-full-txt",
    "machine-discovery/sitemap-exists",
    "machine-discovery/discovery-index-coverage",
    "machine-discovery/sitemap-absolute-urls",
    "machine-discovery/sitemap-lastmod",
    "answer-readiness/faq-sections",
    "answer-readiness/question-headings",
    "answer-readiness/first-paragraph-answers",
    "answer-readiness/direct-definitions",
    "answer-readiness/comparison-tables",
    // 9.6 (numbered-steps) folded into 6.8 (semantic-lists) in Plan 4.
    "content-extraction/semantic-lists",
    "answer-readiness/specific-numbers",
    "answer-readiness/dates-on-content",
    "answer-readiness/content-without-clickthrough",
    "answer-readiness/meta-description",
    "answer-readiness/brand-name",
    "answer-readiness/trust-signals",
    "answer-readiness/review-signals",
  ],
} as const;

function calculateReadinessVitals(
  checks: Array<{
    id: string;
    category: string;
    score: number;
    status: CheckStatus;
  }>,
): {
  commerce: number;
  content: number;
  botAccessibility: number;
  technical: number;
} {
  const applicable = checks.filter(
    (c) => c.status !== CheckStatus.NotApplicable,
  );

  const average = (matching: Array<{ score: number }>) => {
    if (matching.length === 0) return 0;
    return Math.round(
      (matching.reduce((sum, c) => sum + c.score, 0) / matching.length) * 100,
    );
  };

  const getScore = (ids: readonly string[]) =>
    average(applicable.filter((c) => ids.includes(c.id)));

  const getCategoryScore = (category: string) =>
    average(applicable.filter((c) => c.category === category));

  return {
    commerce: getScore(READINESS_VITAL_IDS.commerce),
    content: getScore(READINESS_VITAL_IDS.content),
    botAccessibility: getCategoryScore("access-crawl-control"),
    technical: getCategoryScore("content-extraction"),
  };
}
