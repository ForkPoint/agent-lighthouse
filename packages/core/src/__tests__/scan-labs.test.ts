/**
 * Integration tests: one test per audit against the labs reference app.
 *
 * Prerequisites:
 *   - Labs app running via `npm run dev:labs` (uses LABS_PORT from .env, default 7200)
 *
 * Run:
 *   npx vitest run libs/scanner/src/__tests__/scan-labs.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { runAudits } from '../audit-runner';
import { defaultConfig } from '../audit-config';
import { createFetcher } from '../fetcher';
import {
  parseHtml,
  extractJsonLd,
  extractMetaTags,
  extractHeadLinks,
  detectPageType,
} from '../parser';
import type { CheckContext, PageContext } from '../check-context';
import type { CheckResult } from '../types';
import type { FetchResult } from '../fetcher';

const IS_LABS_ENABLED = Boolean(process.env.NEXT_PUBLIC_LABS_URL || process.env.LABS_PORT);
const LABS_URL = process.env.NEXT_PUBLIC_LABS_URL || (process.env.LABS_PORT ? `http://localhost:${process.env.LABS_PORT}` : 'http://localhost:7200');

// ── Known exceptions ────────────────────────────────────────────
// Audits that cannot pass in localhost dev:
const KNOWN_FAIL = new Set([
  'access-crawl-control/https-enabled', // HTTPS — localhost is HTTP
]);

// Audits that warn because they are N/A or environment-dependent:
const KNOWN_WARN = new Set([
  '3.14', // Offer schema — no /pricing/ URL pattern detected
]);

// Audits that may fail due to dev server performance (cold compilation):
const TIMING_SENSITIVE = new Set([
  'content-extraction/server-responsiveness', // Fast page load — TTFB varies in dev
  'content-extraction/fast-response-time', // Fast response time — TTFB varies in dev
]);

// Resolve the title suffix + assertion for a given audit id without
// branching at test-registration time (one `it` per audit, behaviour
// selected up front).
function resolveAuditExpectation(id: string): {
  titleSuffix: string;
  assert: (result: CheckResult | undefined) => void;
} {
  if (KNOWN_FAIL.has(id)) {
    return {
      titleSuffix: ' (known fail — localhost)',
      assert: (result) => {
        expect(result).toBeDefined();
        expect(result!.status).toBe('fail');
      },
    };
  }
  if (KNOWN_WARN.has(id)) {
    return {
      titleSuffix: ' (known warn — N/A)',
      assert: (result) => {
        expect(result).toBeDefined();
        expect(result!.status).toBe('warn');
      },
    };
  }
  if (TIMING_SENSITIVE.has(id)) {
    return {
      titleSuffix: ' (timing-sensitive)',
      assert: (result) => {
        // In dev mode, TTFB can exceed thresholds due to compilation
        expect(['pass', 'warn', 'fail', undefined]).toContain(result?.status);
      },
    };
  }
  return {
    titleSuffix: '',
    assert: (result) => {
      // Audit was filtered out by applicablePageTypes — that's OK
      expect(
        result === undefined || result.status === 'pass'
          ? 'pass'
          : `${id}:${result.status}:${result.explanation} expected=${result.details?.expected} found=${result.details?.found}`,
      ).toBe('pass');
    },
  };
}

// ── Build context (same as orchestrator phases 1-2) ─────────────

async function buildLabsContext(): Promise<CheckContext> {
  const fetcher = createFetcher();
  const baseUrl = new URL(LABS_URL).origin;
  const domain = new URL(LABS_URL).hostname;

  const rootFilePaths = [
    '/robots.txt',
    '/llms.txt',
    '/llms-full.txt',
    '/sitemap.xml',
    '/sitemap-index.xml',
    '/rss.xml',
    '/feed.xml',
    '/openapi.json',
    '/openapi.yaml',
    '/.well-known/ai-catalog.json',
    '/.well-known/mcp/servers.json',
    '/.well-known/agents.json',
    '/.well-known/ai-plugin.json',
    '/.well-known/security.txt',
    '/navigation.json',
    '/privacy-policy/',
    '/privacy/',
    '/privacy-policy',
    '/privacy',
    '/terms/',
    '/terms',
    '/about/',
    '/about-us/',
    '/about',
  ];

  const rootResults = await Promise.all(
    rootFilePaths.map((path) => fetcher.fetch({ url: `${baseUrl}${path}` })),
  );
  const rootFiles: Record<string, FetchResult> = {};
  rootFilePaths.forEach((path, i) => {
    rootFiles[path] = rootResults[i]!;
  });

  // Fetch all 4 page types
  const pageUrls = [
    LABS_URL, // homepage
    `${LABS_URL}/category/running-shoes`, // category/PLP
    `${LABS_URL}/product/ultraboost-runner-x`, // product/PDP
    `${LABS_URL}/blog/how-to-choose-running-shoes`, // content/blog
  ];

  const pageResults = await Promise.all(pageUrls.map((u) => fetcher.fetch({ url: u })));

  const pages: PageContext[] = pageResults
    .map((r, i) => ({ result: r, url: pageUrls[i]!, index: i }))
    .filter((p) => p.result.status === 200 && p.result.body)
    .map((p) => {
      const $ = parseHtml(p.result.body);
      const jsonLd = extractJsonLd($);
      const meta = extractMetaTags($);
      return {
        url: p.url,
        pageType: detectPageType(p.url, $, jsonLd, meta, p.index === 0),
        fetchResult: p.result,
        $,
        jsonLd,
        meta,
        headLinks: extractHeadLinks($),
      };
    });

  return {
    rootFiles,
    pages,
    domain,
    baseUrl,
    fetch: (opts) => fetcher.fetch(opts),
  };
}

// ── Test suite ──────────────────────────────────────────────────

describe.skipIf(!IS_LABS_ENABLED)('Audit Scan on Labs Reference App', () => {
  let checkMap: Map<string, CheckResult>;

  beforeAll(async () => {
    if (!IS_LABS_ENABLED) return;
    const ctx = await buildLabsContext();
    const { checks } = await runAudits(ctx, defaultConfig);
    checkMap = new Map(checks.map((c) => [c.id, c]));
    console.log(
      `\nScan complete: ${checks.length} audits run, ` +
        `${checks.filter((c) => c.status === 'pass').length} pass, ` +
        `${checks.filter((c) => c.status === 'warn').length} warn, ` +
        `${checks.filter((c) => c.status === 'fail').length} fail\n`,
    );
  });

  // Generate describe/it blocks for every audit in the config
  for (const category of defaultConfig.categories) {
    const registrations = defaultConfig.audits[category.id] ?? [];

    describe(category.name, () => {
      for (const reg of registrations) {
        const { id, title } = reg.meta;
        const { titleSuffix, assert } = resolveAuditExpectation(id);

        it(`[${id}] ${title}${titleSuffix}`, () => {
          if (!IS_LABS_ENABLED || !checkMap) return;
          assert(checkMap.get(id));
        });
      }
    });
  }
}, 120_000);
