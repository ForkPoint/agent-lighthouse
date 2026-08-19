import type { PageOverride, PageType, ScanReport } from './types';
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
import { defaultConfig } from './audit-config';
import { planAudits, runAudits } from './audit-runner';
import { ProgressTracker } from './progress';
import type { ScanEvent } from './progress';
import { runA11yForHtml } from './audits/accessibility/runner';
import { A11Y_RULES } from './audits/accessibility';
import { extractProductFieldVerification } from './product-fields';
import { generateScanSummary } from './summary';
import { detectWafProtection } from './waf-detector';

import type { FetchResult } from './fetcher';

export interface ScanOptions {
  onEvent?: (event: ScanEvent) => void;
  pages?: PageOverride[] | null;
  signal?: AbortSignal;
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
    '/.well-known/ai-catalog.json',
    '/.well-known/mcp/servers.json',
    '/.well-known/ucp',
    '/.well-known/agents.json',
    '/.well-known/ai-plugin.json',
    '/.well-known/webmcp',
    '/.well-known/security.txt',
    '/.well-known/tdmrep.json',
    '/navigation.json',
    '/privacy-policy/',
    '/privacy/',
    '/privacy-policy',
    '/privacy',
    '/policies/privacy-policy',
    '/terms/',
    '/terms',
    '/policies/terms-of-service',
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

  const ctx: CheckContext = {
    rootFiles,
    pages,
    domain,
    baseUrl,
    fetch: (options) => fetcher.fetch({ ...options, signal }),
    wafProtection: wafProtection ?? undefined,
  };

  const auditPlan = planAudits(ctx, defaultConfig);
  tracker.phaseStart('audits', auditPlan.runnable.length);

  const {
    checks: allChecks,
    categories,
    overallScore,
  } = await runAudits(
    ctx,
    defaultConfig,
    (event) => {
      if (event.type === 'unit:done') tracker.unitDone(event.label);
      else tracker.unitFail(event.label, event.error);
    },
    auditPlan,
  );
  tracker.phaseDone();

  logger.debug('[orchestrator] Phase 3 complete: Audits finished');

  // ── Phase 4: Assemble report ─────────────────────────────────
  tracker.phaseStart('report', 1);
  logger.debug('[orchestrator] Phase 4: Building final report');

  const durationMs = Math.round(performance.now() - start);

  const recommendations = allChecks
    .filter((c) => c.status !== 'pass')
    .slice()
    .sort((a: { priority: string }, b: { priority: string }) => {
      const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
    });

  // Extract Top 10 Fails (already sorted by priority in recommendations)
  const topFails = recommendations.slice(0, 10);

  // Extract Top 10 Passes (sorted by weight)
  const weightMap = new Map<string, number>();
  for (const catId in defaultConfig.audits) {
    for (const reg of defaultConfig.audits[catId]!) {
      weightMap.set(reg.meta.id, reg.meta.weight);
    }
  }

  const topPasses = allChecks
    .filter((c) => c.status === 'pass')
    .slice()
    .sort(
      (a: { id: string }, b: { id: string }) =>
        (weightMap.get(b.id) ?? 1) - (weightMap.get(a.id) ?? 1),
    )
    .slice(0, 10);

  const readinessVitals = calculateReadinessVitals(allChecks);
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

function calculateReadinessVitals(checks: Array<{ id: string; category: string; score: number }>): {
  commerce: number;
  content: number;
  botAccessibility: number;
  technical: number;
} {
  const getScore = (ids: string[]) => {
    const matching = checks.filter((c) => ids.includes(c.id));
    if (matching.length === 0) return 0;
    return Math.round((matching.reduce((sum, c) => sum + c.score, 0) / matching.length) * 100);
  };

  const getCategoryScoreByPrefix = (prefix: string) => {
    const matching = checks.filter((c) => c.id.startsWith(prefix) || c.category === prefix);
    if (matching.length === 0) return 0;
    return Math.round((matching.reduce((sum, c) => sum + c.score, 0) / matching.length) * 100);
  };

  return {
    commerce: getScore(['3.8', '3.14', '3.21', '3.22', '3.23', '3.24']),
    content: getScore([
      '1.1',
      '1.2',
      '1.3',
      '1.4',
      '1.5',
      '1.6',
      '1.7',
      '1.8',
      '1.9',
      '1.10',
      '9.1',
      '9.2',
      '9.3',
      '9.4',
      '9.5',
      '9.6',
      '9.7',
      '9.8',
      '9.9',
      '9.10',
      '9.11',
      '10.6',
      '10.7',
      '10.8',
      '1.23',
    ]),
    botAccessibility: getCategoryScoreByPrefix('crawler-permissions'),
    technical: getCategoryScoreByPrefix('technical-readiness'),
  };
}
