import type { CheckStatus, PageOverride, PageType, ScanReport } from './types';
import { getScoreTier, MAX_PAGES_PER_SCAN, READINESS_WEIGHTS } from './constants';
import { logger } from './logger';
import { createFetcher, splitCredentials } from './fetcher';
import {
  parseHtml,
  extractJsonLd,
  extractMicrodata,
  extractRdfa,
  extractMetaTags,
  extractHeadLinks,
  extractInternalLinks,
  extractNavLinks,
  detectPageType,
} from './parser';
import type { CheckContext, PageContext } from './check-context';
import { defaultConfig, filterConfig } from './audit-config';
import { planAudits, runAudits } from './audit-runner';
import type { AuditTraceHandler } from './audit-runner';
import { ProgressTracker } from './progress';
import type { ScanEvent } from './progress';
import { runA11yForHtml } from './audits/operability-safety/runner';
import { A11Y_RULES } from './audits/operability-safety';
import { extractProductFieldVerification } from './product-fields';
import { generateScanSummary } from './summary';
import { isInformative } from './scorer';
import { detectWafProtection } from './waf-detector';
import { buildScanEvidence } from './scan-evidence';

import type { FetchResult } from './fetcher';

export interface ScanOptions {
  onEvent?: (event: ScanEvent) => void;
  pages?: PageOverride[] | null;
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
}

// Cap how many pages get the jsdom-based a11y pass. Accessibility issues are
// template-wide, so the first few pages are representative; this bounds the
// per-scan cost so one heavy site can't dominate the worker. 0 disables the
// a11y pass entirely (audits degrade to "not applicable").
const A11Y_MAX_PAGES = Math.max(0, Number(process.env.SCANNER_A11Y_MAX_PAGES ?? 3));

// ── Page Discovery ─────────────────────────────────────────────

function discoverPages(
  homepageUrl: string,
  domain: string,
  rootFiles: Record<string, FetchResult>,
  homepage$: ReturnType<typeof parseHtml>,
  exclude: Set<string>,
  maxAdditional: number,
): string[] {
  const discovered = new Set<string>();

  // 1. Sitemap URLs
  const sitemapBody =
    rootFiles['/sitemap.xml']?.status === 200
      ? rootFiles['/sitemap.xml']!.body
      : rootFiles['/sitemap-index.xml']?.status === 200
        ? rootFiles['/sitemap-index.xml']!.body
        : '';

  if (sitemapBody) {
    const $sitemap = parseHtml(sitemapBody);
    $sitemap('loc').each((_, el) => {
      const loc = $sitemap(el).text().trim();
      if (loc && loc.includes(domain)) {
        discovered.add(loc);
      }
    });
  }

  // 2. llms.txt links
  if (rootFiles['/llms.txt']?.status === 200) {
    const llmsBody = rootFiles['/llms.txt']!.body;
    const linkRegex = /\[.*?\]\((https?:\/\/[^\s)]+)\)/g;
    let match;
    while ((match = linkRegex.exec(llmsBody)) !== null) {
      if (match[1]!.includes(domain)) {
        discovered.add(match[1]!);
      }
    }
  }

  // 3. Navigation links
  const navLinks = extractNavLinks(homepage$);
  for (const href of navLinks) {
    try {
      const resolved = new URL(href, homepageUrl).href;
      if (resolved.includes(domain)) {
        discovered.add(resolved);
      }
    } catch {
      // Skip invalid URLs
    }
  }

  // 4. Internal links from homepage
  const internalLinks = extractInternalLinks(homepage$, domain);
  for (const link of internalLinks) {
    discovered.add(link);
  }

  // Remove homepage itself
  const normalized = new URL(homepageUrl).href;
  discovered.delete(normalized);
  discovered.delete(normalized.replace(/\/$/, ''));
  discovered.delete(normalized.endsWith('/') ? normalized : normalized + '/');

  // Classify discovered URLs into buckets by likely page type (URL patterns only)
  const buckets: Record<'product' | 'category' | 'content' | 'other', string[]> = {
    product: [],
    category: [],
    content: [],
    other: [],
  };

  for (const url of discovered) {
    // Skip URLs the caller already supplies as explicit page overrides.
    if (exclude.has(url.replace(/\/$/, ''))) continue;
    const path = new URL(url).pathname.toLowerCase();
    if (/\/(product|products|p|item|dp)(\/|$)/.test(path)) {
      buckets.product.push(url);
    } else if (/\/(category|categories|c|collections?|shop|catalog|department)(\/|$)/.test(path)) {
      buckets.category.push(url);
    } else if (/\/(blog|posts|articles|news|guides)(\/|$)/.test(path)) {
      buckets.content.push(url);
    } else {
      buckets.other.push(url);
    }
  }

  // Select pages to maximize type diversity (fill 1 per bucket, then remaining)
  const selected: string[] = [];
  const used = new Set<string>();

  for (const key of ['product', 'category', 'content'] as const) {
    const first = buckets[key][0];
    if (first && selected.length < maxAdditional) {
      selected.push(first);
      used.add(first);
    }
  }

  // Fill remaining slots from all buckets (product → category → content → other)
  const fillOrder: Array<'product' | 'category' | 'content' | 'other'> = [
    'product',
    'category',
    'content',
    'other',
  ];
  for (const key of fillOrder) {
    for (const url of buckets[key]) {
      if (selected.length >= maxAdditional) break;
      if (!used.has(url)) {
        selected.push(url);
        used.add(url);
      }
    }
    if (selected.length >= maxAdditional) break;
  }

  return selected;
}

// ── Main Scan ──────────────────────────────────────────────────

export async function runScan(url: string, options?: ScanOptions): Promise<ScanReport> {
  const onEvent = options?.onEvent;
  const pageOverrides = options?.pages;
  const signal = options?.signal;

  const tracker = new ProgressTracker((event) => onEvent?.(event));
  const start = performance.now();
  const fetcher = createFetcher();

  const baseUrl = new URL(url).origin;
  const domain = new URL(url).hostname;
  // A basic-auth target (`user:pass@host`) is fetched with credentials (the
  // fetcher turns them into an Authorization header), but they must never be
  // stored or displayed. Use a credential-free URL everywhere the report echoes
  // the scanned URL back.
  const displayUrl = splitCredentials(url).url;

  // Normalize user-supplied page overrides: resolve, dedupe (trailing-slash
  // insensitive), and drop any that collide with the homepage. Their declared
  // pageType is forced onto the page context so type-gated audits run.
  const homeKey = new URL(url).href.replace(/\/$/, '');
  const overrideTypeByKey = new Map<string, PageType>();
  const overrideUrls: string[] = [];
  for (const ov of pageOverrides ?? []) {
    let resolved: string;
    try {
      resolved = new URL(ov.url).href;
    } catch {
      continue;
    }
    const key = resolved.replace(/\/$/, '');
    if (key === homeKey || overrideTypeByKey.has(key)) continue;
    overrideTypeByKey.set(key, ov.pageType);
    overrideUrls.push(resolved);
  }

  logger.debug({ url, domain }, '[orchestrator] Starting runScan');

  // ── Phase 1: Root-level file checks (parallel) ───────────────
  signal?.throwIfAborted();
  tracker.scanStart(displayUrl);

  const rootFilePaths = [
    '/robots.txt',
    '/llms.txt',
    '/llms-full.txt',
    '/agents.md',
    '/sitemap.xml',
    '/sitemap-index.xml',
    '/rss.xml',
    '/feed.xml',
    '/openapi.json',
    '/openapi.yaml',
    // RFC 9727 (June 2025): the only ratified, IANA-registered domain-level
    // API discovery mechanism. Read by agent-interfaces/openapi-exists.
    '/.well-known/api-catalog',
    '/.well-known/ai-catalog.json',
    '/.well-known/mcp/servers.json',
    '/.well-known/ucp',
    '/.well-known/agents.json',
    '/.well-known/ai-plugin.json',
    // '/.well-known/webmcp' was dropped 2026-08-22: the only reader was the
    // pre-rewrite webmcp-registered-tools audit, and the path is an invented
    // convention with no spec and no IANA registration. Real WebMCP tools are
    // registered at runtime, so there was nothing at the end of that request.
    '/.well-known/security.txt',
    '/.well-known/tdmrep.json',
    '/navigation.json',
    '/about/',
    '/about-us/',
    '/about',
    '/pages/about',
    '/pages/about-us',
    '/pages/our-story',
    '/our-story',
  ];

  logger.debug({ count: rootFilePaths.length }, '[orchestrator] Phase 1: Fetching root files');
  tracker.phaseStart('fetch-root', rootFilePaths.length);

  const rootResults = await Promise.all(
    rootFilePaths.map((path) =>
      fetcher.fetch({ url: `${baseUrl}${path}`, signal }).then((result) => {
        tracker.unitDone(path);
        return result;
      }),
    ),
  );

  const rootFiles: Record<string, FetchResult> = {};
  rootFilePaths.forEach((path, i) => {
    rootFiles[path] = rootResults[i]!;
  });

  tracker.phaseDone();
  logger.debug('[orchestrator] Phase 1 complete: Root files fetched');

  // ── Phase 2: Page-level checks (parallel per page) ───────────
  signal?.throwIfAborted();
  logger.debug('[orchestrator] Phase 2: Fetching pages');

  // Fetch homepage first. The phase starts with just the homepage as a unit;
  // discovery below corrects the total once the full page list is known.
  tracker.phaseStart('fetch-pages', 1);
  const homepageResult = await fetcher.fetch({ url, signal });
  tracker.unitDone(displayUrl);
  const homepage$ =
    homepageResult.status === 200 && homepageResult.body ? parseHtml(homepageResult.body) : null;

  // Reserve slots for overrides, then auto-discover the remainder. Override
  // URLs are excluded from discovery so they are not fetched twice.
  const discoverLimit = Math.max(0, MAX_PAGES_PER_SCAN - 1 - overrideUrls.length);
  const discoveredUrls = homepage$
    ? discoverPages(url, domain, rootFiles, homepage$, new Set(overrideTypeByKey.keys()), discoverLimit)
    : [];
  logger.debug(
    { overrides: overrideUrls.length, discovered: discoveredUrls.length },
    '[orchestrator] Page set: overrides + discovered URLs',
  );

  // Fetch overrides first (so they take priority), then discovered pages.
  const extraUrls = [...overrideUrls, ...discoveredUrls];
  tracker.setPhaseTotal(1 + extraUrls.length);

  const extraResults = await Promise.all(
    extraUrls.map((pageUrl) =>
      fetcher.fetch({ url: pageUrl, signal }).then((result) => {
        tracker.unitDone(pageUrl);
        return result;
      }),
    ),
  );
  tracker.phaseDone();

  // Build page contexts. The homepage keeps its credential-free URL so scanned
  // credentials never surface in the report's page list.
  const allPageResults = [homepageResult, ...extraResults];
  const allPageUrls = [displayUrl, ...extraUrls];

  // ── Phase 2b: Parse pages + bounded jsdom a11y pass ─────────
  tracker.phaseStart(
    'analyze',
    allPageResults.filter((r) => r.status === 200 && r.body).length,
  );

  const pages: PageContext[] = allPageResults
    .map((r, i) => ({ result: r, url: allPageUrls[i]!, index: i }))
    .filter((p) => p.result.status === 200 && p.result.body)
    .map((p) => {
      const $ = parseHtml(p.result.body);
      const jsonLd = extractJsonLd($);
      // Union of every structured-data format search engines read. Product
      // audits consume this; classification uses it too so microdata/RDFa
      // product pages are detected, not just JSON-LD ones.
      const structuredData = [...jsonLd, ...extractMicrodata($), ...extractRdfa($)];
      const meta = extractMetaTags($);
      const isFirstPage = p.index === 0;
      // User-supplied overrides keep their declared type; everything else is
      // classified heuristically.
      const forcedType = overrideTypeByKey.get(p.url.replace(/\/$/, ''));
      tracker.unitDone(p.url);
      return {
        url: p.url,
        pageType: forcedType ?? detectPageType(p.url, $, structuredData, meta, isFirstPage),
        fetchResult: p.result,
        $,
        jsonLd,
        structuredData,
        meta,
        headLinks: extractHeadLinks($),
      };
    });

  // Run the a11y rule engine (over jsdom) for the accessibility-tree audits,
  // capped to the first A11Y_MAX_PAGES pages. Concurrency is bounded inside the
  // runner; failures degrade to no a11yResults (audits → na).
  signal?.throwIfAborted();
  await Promise.all(
    pages.slice(0, A11Y_MAX_PAGES).map(async (p) => {
      p.a11yResults = await runA11yForHtml(p.fetchResult.body, p.url, A11Y_RULES);
    }),
  );

  tracker.phaseDone();
  logger.debug(
    { pagesAnalyzed: pages.length },
    '[orchestrator] Phase 2 complete: Page analysis complete',
  );

  // ── Phase 3: Run all audits ────────────────────────────────────
  signal?.throwIfAborted();
  logger.debug('[orchestrator] Phase 3: Running audits');

  const wafProtection = detectWafProtection(url, homepageResult, rootFiles, pages.length);

  const evidence = buildScanEvidence({
    requestedUrl: url,
    homepageResult,
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
  };

  const config = filterConfig(defaultConfig, {
    categories: options?.categories,
    includeExperimental: options?.includeExperimental ?? false,
  });

  const auditPlan = planAudits(ctx, config);
  tracker.phaseStart('audits', auditPlan.runnable.length);

  const {
    checks: allChecks,
    categories,
    overallScore,
  } = await runAudits(
    ctx,
    config,
    (event) => {
      if (event.type === 'unit:done') tracker.unitDone(event.label);
      else tracker.unitFail(event.label, event.error);
    },
    auditPlan,
    options?.onAuditTrace,
  );
  tracker.phaseDone();

  logger.debug('[orchestrator] Phase 3 complete: Audits finished');

  // ── Phase 4: Assemble report ─────────────────────────────────
  tracker.phaseStart('report', 1);
  logger.debug('[orchestrator] Phase 4: Building final report');

  const durationMs = Math.round(performance.now() - start);

  // Informative checks carry no score and no fix worth surfacing, so they are
  // advisory-only: they never become recommendations, top fails or top passes.
  const recommendations = allChecks
    .filter((c) => c.status !== 'pass' && !isInformative(c))
    .slice()
    .sort((a: { priority: string }, b: { priority: string }) => {
      const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
    });

  // Extract Top 10 Fails (already sorted by priority in recommendations)
  const topFails = recommendations.slice(0, 10);

  // Extract Top 10 Passes (sorted by the weight stamped on each check)
  const topPasses = allChecks
    .filter((c) => c.status === 'pass' && !isInformative(c))
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

  const report: ScanReport = {
    scanId: '', // Set by the caller
    url: displayUrl,
    domain,
    overallScore,
    scoreTier: getScoreTier(overallScore),
    summary: '', // Set below
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
    productFields: [...overrideTypeByKey.values()].includes('product')
      ? extractProductFieldVerification(pages)
      : undefined,
  };

  report.summary = generateScanSummary(report);
  tracker.unitDone();
  tracker.phaseDone();
  tracker.scanDone(overallScore);
  logger.debug({ durationMs, score: overallScore }, '[orchestrator] runScan complete');

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
    'structured-data/service-schema',
    'agentic-commerce/offer-schema',
    'agentic-commerce/product-identifiers',
    'structured-data/advanced-product-details',
    // 3.23 (product-reviews) folded into 3.13 (review-schema) in Plan 4.
    'structured-data/review-schema',
    'agentic-commerce/product-transaction-certainty',
  ],
  /** The v1 content list, minus sunsets, with merged ids mapped to survivors. */
  content: [
    'machine-discovery/llms-txt-exists',
    'machine-discovery/llms-txt-structure',
    'machine-discovery/llms-txt-link-descriptions',
    'machine-discovery/llms-txt-links-valid',
    'machine-discovery/llms-full-txt',
    'machine-discovery/sitemap-exists',
    'machine-discovery/discovery-index-coverage',
    'machine-discovery/sitemap-absolute-urls',
    'machine-discovery/sitemap-lastmod',
    'answer-readiness/faq-sections',
    'answer-readiness/question-headings',
    'answer-readiness/first-paragraph-answers',
    'answer-readiness/direct-definitions',
    'answer-readiness/comparison-tables',
    // 9.6 (numbered-steps) folded into 6.8 (semantic-lists) in Plan 4.
    'content-extraction/semantic-lists',
    'answer-readiness/specific-numbers',
    'answer-readiness/dates-on-content',
    'answer-readiness/content-without-clickthrough',
    'answer-readiness/meta-description',
    'answer-readiness/brand-name',
    'answer-readiness/trust-signals',
    'answer-readiness/review-signals',
  ],
} as const;

function calculateReadinessVitals(
  checks: Array<{ id: string; category: string; score: number; status: CheckStatus }>,
): {
  commerce: number;
  content: number;
  botAccessibility: number;
  technical: number;
} {
  const applicable = checks.filter((c) => c.status !== 'na');

  const average = (matching: Array<{ score: number }>) => {
    if (matching.length === 0) return 0;
    return Math.round((matching.reduce((sum, c) => sum + c.score, 0) / matching.length) * 100);
  };

  const getScore = (ids: readonly string[]) => average(applicable.filter((c) => ids.includes(c.id)));

  const getCategoryScore = (category: string) =>
    average(applicable.filter((c) => c.category === category));

  return {
    commerce: getScore(READINESS_VITAL_IDS.commerce),
    content: getScore(READINESS_VITAL_IDS.content),
    botAccessibility: getCategoryScore('access-crawl-control'),
    technical: getCategoryScore('content-extraction'),
  };
}
