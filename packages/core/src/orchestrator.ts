import type { Dispatcher } from "undici";
import type {
  CheckStatus,
  PageOverride,
  PageType,
  ScanReport,
  ScanConditions,
} from "./types";
import {
  getScoreTier,
  READINESS_WEIGHTS,
  ORIGIN_EVIDENCE_VERSION,
  TAG_SKIPPED_NO_EVIDENCE,
  TAG_SKIPPED_PAGE_TYPE,
} from "./constants";
import { logger } from "./logger";
import { createFetcher, splitCredentials } from "./fetcher";
import {
  OriginCache,
  defaultOriginCache,
  computeOriginCacheKey,
  shouldBypassOriginCache,
} from "./origin-cache";
import {
  parseHtml,
  extractJsonLd,
  extractMicrodata,
  extractRdfa,
  extractMetaTags,
  extractHeadLinks,
  detectPageType,
} from "./parser";
import type { CheckContext, PageContext } from "./check-context";
import { defaultConfig, filterConfig } from "./audit-config";
import { planAudits, runAudits } from "./audit-runner";
import type { AuditTraceHandler } from "./audit-runner";
import { ProgressTracker } from "./progress";
import type { ScanEvent } from "./progress";
import { runA11yForHtml } from "./audits/operability-safety/runner";
import { A11Y_RULES } from "./audits/operability-safety";
import { extractProductFieldVerification } from "./product-fields";
import { generateScanSummary } from "./summary";
import {
  isInformative,
  gatedMassShare,
  GATED_MASS_UNSCORED_THRESHOLD,
} from "./scorer";
import { detectWafProtection } from "./waf-detector";
import { buildScanEvidence, unjudgeableReason } from "./scan-evidence";

import type { FetchOptions, FetchResult } from "./fetcher";

export interface ScanOptions {
  onEvent?: (event: ScanEvent) => void;
  pages?: PageOverride[] | null;
  /** Explicitly declared page type for the target URL. */
  pageType?: PageType;
  signal?: AbortSignal;
  /**
   * Restrict the scan to these category ids. Unknown ids simply match nothing —
   * validate them at the entry point so the operator hears about a typo.
   */
  categories?: string[];
  /**
   * Include audits whose tier is `experimental`. Off by default, per
   * docs/evidence/policy.md: an experimental check is behind a flag and never
   * scored.
   */
  includeExperimental?: boolean;
  /**
   * Called once per registered audit with what it did — including the ones
   * that were skipped or failed. Use it to trace a verdict back to the
   * evidence it was drawn from; see {@link AuditTrace}.
   */
  onAuditTrace?: AuditTraceHandler;
  /**
   * Skip audits the scan could not feed, instead of running them blind.
   *
   * On by default. An audit whose required evidence the scan never obtained
   * reports `na` tagged `skipped:no-evidence`, with the reason attached, and
   * is never constructed. Set it to `false` to bypass only the per-audit
   * `requires` checks. The unread-scan guard remains unconditional, so a scan
   * that read no attributable site response still runs no audit.
   */
  enforceEvidenceGate?: boolean;
  /**
   * undici dispatcher for every request this scan makes.
   */
  dispatcher?: Dispatcher;
  /**
   * How many requests this scan may have in flight at once.
   */
  maxConcurrent?: number;
  /**
   * Extra HTTP request headers to pass on all fetches.
   */
  headers?: Record<string, string>;
  /**
   * Explicitly bypass the shared origin evidence cache for this scan.
   */
  bypassOriginCache?: boolean;
  /**
   * Optional custom OriginCache instance (defaults to defaultOriginCache).
   */
  originCache?: OriginCache;
  /**
   * A `robots.txt` response the caller already has, used instead of fetching
   * it again.
   */
  robotsTxt?: FetchResult;
}

// Cap how many pages get the jsdom-based a11y pass. Accessibility issues are
// template-wide, so the first few pages are representative; this bounds the
// per-scan cost so one heavy site can't dominate the worker. 0 disables the
// a11y pass entirely (audits degrade to "not applicable").
const A11Y_MAX_PAGES = Math.max(
  0,
  Number(process.env.SCANNER_A11Y_MAX_PAGES ?? 3),
);

/** How long to wait before the single 429 retry when no `Retry-After` says. */
const RATE_LIMIT_BACKOFF_MS = 5_000;
/** A `Retry-After` longer than this is the site telling us to come back later. */
const MAX_RETRY_AFTER_MS = 30_000;

/**
 * Fetch a page, retrying once on HTTP 429.
 */
async function fetchPageWithRetry(
  fetcher: { fetch: (options: FetchOptions) => Promise<FetchResult> },
  url: string,
  signal?: AbortSignal,
): Promise<FetchResult> {
  const first = await fetcher.fetch({ url, signal });
  if (first.status !== 429) return first;

  const header = Number(first.headers["retry-after"]);
  const waitMs =
    Number.isFinite(header) && header > 0
      ? Math.min(header * 1000, MAX_RETRY_AFTER_MS)
      : RATE_LIMIT_BACKOFF_MS;

  logger.debug(
    { url, waitMs },
    `[orchestrator] Page answered 429; retrying once in ${waitMs}ms`,
  );
  await new Promise((resolve) => setTimeout(resolve, waitMs));
  signal?.throwIfAborted();

  return fetcher.fetch({ url, signal });
}

// ── Main Scan ──────────────────────────────────────────────────

export async function runScan(
  url: string,
  options?: ScanOptions,
): Promise<ScanReport> {
  const onEvent = options?.onEvent;
  const pageOverrides = options?.pages;
  const signal = options?.signal;

  const tracker = new ProgressTracker((event) => onEvent?.(event));
  const start = performance.now();
  const fetcher = createFetcher({
    dispatcher: options?.dispatcher,
    maxConcurrent: options?.maxConcurrent,
    headers: options?.headers,
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

  logger.debug({ url, domain }, "[orchestrator] Starting runScan");

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
    "/.well-known/mcp/servers.json",
    "/.well-known/ucp",
    "/.well-known/agents.json",
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
    shouldBypassOriginCache(url, options) || !!options?.robotsTxt;
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

  if (cachedEvidence) {
    rootFiles = cachedEvidence.rootFiles;
    originHomepageResult = cachedEvidence.originHomepage;
    originCached = true;
    originReadAt = cachedEvidence.readAt;
    tracker.phaseStart("fetch-root", 0);
    tracker.phaseDone();
    logger.debug(
      { origin: baseUrl },
      "[orchestrator] Phase 1 complete: Reusing cached origin evidence",
    );
  } else {
    logger.debug(
      { count: rootFilePaths.length },
      "[orchestrator] Phase 1: Fetching root files",
    );
    tracker.phaseStart("fetch-root", rootFilePaths.length);

    const prefetchedRobots = options?.robotsTxt;
    const rootResults = await Promise.all(
      rootFilePaths.map((path) => {
        if (path === "/robots.txt" && prefetchedRobots) {
          tracker.unitDone(path);
          return Promise.resolve(prefetchedRobots);
        }
        return fetcher
          .fetch({ url: `${baseUrl}${path}`, signal })
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
      : await fetchPageWithRetry(fetcher, `${baseUrl}/`, signal);

    originReadAt = new Date().toISOString();
    originFresh = true;

    tracker.phaseDone();
    logger.debug("[orchestrator] Phase 1 complete: Root files fetched");
  }

  // ── Phase 2: Page-level checks (parallel per page) ───────────
  signal?.throwIfAborted();
  logger.debug("[orchestrator] Phase 2: Fetching page");

  tracker.phaseStart("fetch-pages", 1 + overrideUrls.length);
  const pageResult = await fetchPageWithRetry(fetcher, url, signal);
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
      originHomepage: originHomepageResult,
    });
  }

  const extraResults = await Promise.all(
    overrideUrls.map((pageUrl) =>
      fetcher.fetch({ url: pageUrl, signal }).then((result) => {
        tracker.unitDone(pageUrl);
        return result;
      }),
    ),
  );
  tracker.phaseDone();

  const allPageResults = [pageResult, ...extraResults];
  const allPageUrls = [displayUrl, ...overrideUrls];

  // ── Phase 2b: Parse pages + bounded jsdom a11y pass ─────────
  tracker.phaseStart(
    "analyze",
    allPageResults.filter((r) => r.status === 200 && r.body).length,
  );

  const pages: PageContext[] = allPageResults
    .map((r, i) => ({ result: r, url: allPageUrls[i]!, index: i }))
    .filter((p) => p.result.status === 200 && p.result.body)
    .map((p) => {
      const $ = parseHtml(p.result.body);
      const jsonLd = extractJsonLd($);
      const structuredData = [
        ...jsonLd,
        ...extractMicrodata($),
        ...extractRdfa($),
      ];
      const meta = extractMetaTags($);
      const isFirstPage = p.index === 0;
      const forcedType =
        (isFirstPage && options?.pageType ? options.pageType : undefined) ??
        overrideTypeByKey.get(p.url.replace(/\/$/, ""));
      const pageTypeSource: "declared" | "detected" = forcedType
        ? "declared"
        : "detected";
      tracker.unitDone(p.url);
      return {
        url: p.url,
        pageType:
          forcedType ??
          detectPageType(p.url, $, structuredData, meta, isFirstPage),
        pageTypeSource,
        fetchResult: p.result,
        $,
        jsonLd,
        structuredData,
        meta,
        headLinks: extractHeadLinks($),
      };
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
          );
        } catch {
          // jsdom failed on this page — audits degrade to na
        }
      }),
    );
  }

  tracker.phaseDone();
  logger.debug(
    { pageCount: pages.length },
    "[orchestrator] Phase 2 complete: Pages parsed",
  );

  // ── Phase 3: Run audits against context ──────────────────────
  signal?.throwIfAborted();
  logger.debug("[orchestrator] Phase 3: Planning and running audits");

  const wafProtection = detectWafProtection(
    url,
    pageResult,
    rootFiles,
    pages.length,
  );

  const evidence = buildScanEvidence({
    requestedUrl: url,
    homepageResult: pageResult,
    pages,
    rootFiles,
    wafProtection: wafProtection ?? null,
  });

  const ctx: CheckContext = {
    rootFiles,
    pages,
    domain,
    baseUrl,
    fetch: (options) => fetcher.fetch({ ...options, signal }),
    wafProtection: wafProtection ?? undefined,
    evidence,
    originEvidence: {
      origin: baseUrl,
      version: ORIGIN_EVIDENCE_VERSION,
      readAt: originReadAt,
      cached: originCached,
      originHomepage: originHomepageResult,
    },
  };

  const config = filterConfig(defaultConfig, {
    categories: options?.categories,
    includeExperimental: options?.includeExperimental ?? false,
  });

  const auditPlan = planAudits(ctx, config, {
    enforceEvidence: options?.enforceEvidenceGate ?? true,
  });
  tracker.phaseStart("audits", auditPlan.runnable.length);

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
  );
  tracker.phaseDone();

  logger.debug("[orchestrator] Phase 3 complete: Audits finished");

  // ── Phase 4: Assemble report ─────────────────────────────────
  tracker.phaseStart("report", 1);
  logger.debug("[orchestrator] Phase 4: Building final report");

  const durationMs = Math.round(performance.now() - start);

  // Informative checks carry no score and no fix worth surfacing, so they are
  // advisory-only: they never become recommendations, top fails or top passes.
  // `na` is not a finding: an audit that had nothing to assess has nothing to
  // recommend. `packages/report` has always filtered this way; core did not,
  // and the evidence gate multiplies the difference.
  const recommendations = allChecks
    .filter(
      (c) => (c.status === "fail" || c.status === "warn") && !isInformative(c),
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
    .filter((c) => c.status === "pass" && !isInformative(c))
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
  const gatedShare = gatedMassShare(allChecks);
  const escalated = gatedShare > GATED_MASS_UNSCORED_THRESHOLD;
  const unscoredReason = !evidence.judgeable
    ? unjudgeableReason(evidence)
    : escalated
      ? `The scan could not feed ${Math.round(gatedShare * 100)}% of the registry's evidence mass, ` +
        "so what remains is not a reading of this site."
      : undefined;
  const scored = unscoredReason === undefined;

  // ── Conditions Calculation (Phase 6: Law 8) ──────────────────
  const allScoredAudits = Object.values(config.audits)
    .flat()
    .filter((a) => a.meta.tier === "scored");

  let registryMass = 0;
  let pageMass = 0;
  let originMass = 0;

  for (const reg of allScoredAudits) {
    const weight = reg.meta.weight;
    registryMass += weight;
    const isPageScoped =
      reg.meta.requires?.includes("rendered-body") ||
      reg.meta.requires?.includes("sample-adequate") ||
      Boolean(
        reg.meta.applicablePageTypes && reg.meta.applicablePageTypes.length > 0,
      );
    if (isPageScoped) {
      pageMass += weight;
    } else {
      originMass += weight;
    }
  }

  const assessedMass = allChecks
    .filter((c) => c.status !== "na" && !isInformative(c))
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
      unscoredReasons["informative"] =
        (unscoredReasons["informative"] ?? 0) + 1;
    } else if (check.status === "na") {
      if (check.tags?.includes(TAG_SKIPPED_NO_EVIDENCE)) {
        gatedCount++;
        unscoredReasons["skipped-no-evidence"] =
          (unscoredReasons["skipped-no-evidence"] ?? 0) + 1;
      } else if (check.tags?.includes(TAG_SKIPPED_PAGE_TYPE)) {
        unscoredReasons["skipped-page-type"] =
          (unscoredReasons["skipped-page-type"] ?? 0) + 1;
      } else {
        unscoredReasons["not-applicable"] =
          (unscoredReasons["not-applicable"] ?? 0) + 1;
      }
    }
  }

  const totalUnscored =
    informativeCount +
    allChecks.filter((c) => c.status === "na" && !isInformative(c)).length;

  const declaredOverrideType =
    options?.pageType ?? overrideTypeByKey.get(targetKey);

  // `pages` holds only the pages that answered 200, so its first entry is
  // not always the target: with the target down and an override up, it is
  // the override. The conditions block names the target, so its page type
  // must come from the target's own entry or from the explicit fallback.
  const primaryPage = pages.find((p) => p.url === displayUrl);
  const pageTypeCondition = primaryPage
    ? {
        type: primaryPage.pageType,
        source: primaryPage.pageTypeSource ?? ("detected" as const),
      }
    : {
        type: (declaredOverrideType ?? "homepage") as PageType,
        source: declaredOverrideType
          ? ("declared" as const)
          : ("detected" as const),
      };

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
  };

  const report: ScanReport = {
    scanId: "", // Set by the caller
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
    pagesScanned: pages.map((p) => ({ url: p.url, pageType: p.pageType })),
    scannedAt: new Date().toISOString(),
    durationMs,
    readinessScore,
    readinessVitals,
    wafProtection: wafProtection ?? undefined,
    // Field-level verification is only trustworthy when the user explicitly
    // supplied the product page. Without a product override we don't guess from
    // auto-discovered pages — leave it unset so the report marks it skipped.
    productFields: [...overrideTypeByKey.values()].includes("product")
      ? extractProductFieldVerification(pages)
      : undefined,
    originEvidence: originCondition,
    conditions,
  };

  report.summary = generateScanSummary(report);
  tracker.unitDone();
  tracker.phaseDone();
  tracker.scanDone(report.overallScore);
  logger.debug(
    { durationMs, score: overallScore },
    "[orchestrator] runScan complete",
  );

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
  const applicable = checks.filter((c) => c.status !== "na");

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
