import { vi } from 'vitest';
import type { PageOverride } from './types';
import type { FetchResult } from './fetcher';

// ── Mocks ────────────────────────────────────────────────────────
// Shared, test-controlled URL → FetchResult map. The fetcher mock looks each
// requested URL up here, defaulting to a 404 so nothing escapes to the network.
const h = vi.hoisted(() => ({ map: new Map<string, FetchResult>() }));

function notFound(url: string): FetchResult {
  return {
    url,
    finalUrl: url,
    status: 404,
    headers: {},
    body: '',
    ttfbMs: 0,
    totalMs: 0,
    contentType: '',
    contentLength: 0,
  };
}

vi.mock('./fetcher', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./fetcher')>();
  return {
    // Keep the real splitCredentials (pure helper the orchestrator uses to
    // sanitize the scanned URL); only the network fetch is stubbed.
    ...actual,
    createFetcher: () => ({
      fetch: async ({ url }: { url: string }) => h.map.get(url) ?? notFound(url),
    }),
  };
});

// Avoid spinning up jsdom for every page; the orchestrator only needs
// a resolved result object.
vi.mock('./audits/accessibility/runner', () => ({
  runA11yForHtml: async () => ({}),
  A11Y_RULES: [],
}));

// Use the real audit runner by default, but keep it spy-able so a single test
// can inject crafted check results to exercise the report-assembly fallbacks.
vi.mock('./audit-runner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./audit-runner')>();
  return { ...actual, runAudits: vi.fn(actual.runAudits) };
});

import { runScan } from './orchestrator';
import type { ScanEvent } from './progress';
import { defaultConfig } from './audit-config';
import { runAudits } from './audit-runner';
import type { AuditRunResult } from './audit-runner';

// ── Helpers ──────────────────────────────────────────────────────

function ok(url: string, body: string, contentType = 'text/html'): FetchResult {
  return {
    url,
    finalUrl: url,
    status: 200,
    headers: { 'content-type': contentType },
    body,
    ttfbMs: 1,
    totalMs: 2,
    contentType,
    contentLength: body.length,
  };
}

function set(url: string, body: string, contentType = 'text/html'): void {
  h.map.set(url, ok(url, body, contentType));
}

const PRODUCT_HTML = `<html><head>
  <script type="application/ld+json">{"@type":"Product","name":"Widget","sku":"S1","offers":{"@type":"Offer","price":"9.99","priceCurrency":"USD","availability":"InStock"}}</script>
</head><body><h1>Widget</h1></body></html>`;

const CATEGORY_HTML = `<html><head>
  <script type="application/ld+json">{"@type":"CollectionPage"}</script>
</head><body><h1>All</h1></body></html>`;

const CONTENT_HTML = `<html><body><main><h1>Hello</h1><p>Some content here.</p></main></body></html>`;

beforeEach(() => {
  h.map.clear();
});

// ---------------------------------------------------------------------------
// Full scan with auto-discovery
// ---------------------------------------------------------------------------

describe('runScan — discovery', () => {
  it('discovers pages from sitemap, llms.txt, nav and internal links across buckets', async () => {
    const url = 'https://example.com/';
    set(
      url,
      `<html><body>
        <nav>
          <a href="/products/widget">W</a>
          <a href="/collections/all">C</a>
          <a href="http://">bad</a>
        </nav>
        <a href="https://example.com/blog/post-1">B</a>
        <a href="https://example.com/about-page">A</a>
        <a href="https://example.com/p/123">P2</a>
      </body></html>`,
    );
    set(
      'https://example.com/sitemap.xml',
      `<?xml version="1.0"?><urlset>
        <url><loc>https://example.com/news/article</loc></url>
        <url><loc>https://other.com/skip</loc></url>
      </urlset>`,
      'application/xml',
    );
    set(
      'https://example.com/llms.txt',
      `[Docs](https://example.com/docs)\n[Ext](https://other.com/x)\n`,
      'text/plain',
    );
    set('https://example.com/products/widget', PRODUCT_HTML);
    set('https://example.com/collections/all', CATEGORY_HTML);
    set('https://example.com/news/article', CONTENT_HTML);
    set('https://example.com/p/123', PRODUCT_HTML);
    // blog/post-1 is selected but returns 404 → dropped from the page set.

    const onEvent = vi.fn();
    const report = await runScan(url, { onEvent });

    expect(report.url).toBe(url);
    expect(report.domain).toBe('example.com');
    // homepage + widget + collection + news + p/123 (blog 404 excluded).
    expect(report.pagesScanned).toHaveLength(5);
    const widget = report.pagesScanned.find((p) => p.url.endsWith('/products/widget'));
    expect(widget?.pageType).toBe('product');
    expect(report.pagesScanned.some((p) => p.url.endsWith('/blog/post-1'))).toBe(false);

    expect(typeof report.overallScore).toBe('number');
    expect(report.scoreTier).toBeDefined();
    expect(typeof report.summary).toBe('string');
    expect((report.summary ?? '').length).toBeGreaterThan(0);
    expect(report.categories).toHaveLength(defaultConfig.categories.length);
    expect(report.topFails.length).toBeLessThanOrEqual(10);
    expect(report.topPasses.length).toBeLessThanOrEqual(10);
    expect(report.readinessVitals).toMatchObject({
      commerce: expect.any(Number),
      content: expect.any(Number),
      botAccessibility: expect.any(Number),
      technical: expect.any(Number),
    });
    // No product override → field verification deliberately skipped.
    expect(report.productFields).toBeUndefined();
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'scan:done', fraction: 1 }));
  });
});

// ---------------------------------------------------------------------------
// Credential hygiene (basic-auth targets)
// ---------------------------------------------------------------------------

describe('runScan — credential hygiene', () => {
  it('scans a basic-auth URL but never echoes credentials into the report', async () => {
    const credUrl = 'https://user:pass@example.com/';
    // The homepage is fetched with the credentialed URL (the fetcher converts
    // the userinfo into an Authorization header); mock keys on exactly that.
    set(credUrl, '<html><body><a href="https://example.com/about-page">A</a></body></html>');
    set('https://example.com/about-page', CONTENT_HTML);

    const report = await runScan(credUrl);

    expect(report.url).toBe('https://example.com/');
    expect(report.domain).toBe('example.com');
    // Credentials must not leak anywhere into the serialized report.
    expect(JSON.stringify(report)).not.toContain('user:pass');
    expect(report.pagesScanned.every((p) => !p.url.includes('@'))).toBe(true);
    // The homepage is still present, under its credential-free URL.
    expect(report.pagesScanned.some((p) => p.url === 'https://example.com/')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Page overrides
// ---------------------------------------------------------------------------

describe('runScan — page overrides', () => {
  it('honours a product override, dedupes/normalizes, and runs field verification', async () => {
    const url = 'https://example.com/';
    set(
      url,
      `<html><body>
        <a href="https://example.com/products/special">Special</a>
        <a href="https://example.com/blog/post">Blog</a>
      </body></html>`,
    );
    set('https://example.com/products/special', PRODUCT_HTML);
    set('https://example.com/blog/post', CONTENT_HTML);

    const overrides: PageOverride[] = [
      { url: 'https://example.com/products/special', pageType: 'product' },
      { url: 'not a url', pageType: 'content' }, // invalid → skipped
      { url: 'https://example.com/', pageType: 'content' }, // homepage collision → skipped
      { url: 'https://example.com/products/special/', pageType: 'content' }, // dup key → skipped
    ];

    const report = await runScan(url, { pages: overrides });

    const special = report.pagesScanned.find((p) => p.url === 'https://example.com/products/special');
    expect(special).toBeDefined();
    expect(special?.pageType).toBe('product');
    // The override URL must not be fetched twice via discovery.
    expect(
      report.pagesScanned.filter((p) => p.url.includes('/products/special')),
    ).toHaveLength(1);

    // A product override turns on field-level verification.
    expect(report.productFields).toBeDefined();
    expect(report.productFields?.sku).toBe('found');
  });
});

// ---------------------------------------------------------------------------
// Homepage unreachable
// ---------------------------------------------------------------------------

describe('runScan — homepage unreachable', () => {
  it('produces an empty page set when the homepage cannot be fetched', async () => {
    const url = 'https://example.com/';
    // No entries set → homepage and every root file resolve to 404.

    const report = await runScan(url);

    expect(report.pagesScanned).toEqual([]);
    expect(report.productFields).toBeUndefined();
    expect(typeof report.overallScore).toBe('number');
    expect(typeof report.summary).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// No root files, only "other" discovery bucket
// ---------------------------------------------------------------------------

describe('runScan — no root files', () => {
  it('discovers from internal links when there is no sitemap or llms.txt', async () => {
    const url = 'https://example.com/';
    set(
      url,
      `<html><body><nav>
        <a href="/docs">Docs</a>
        <a href="/about-page">About</a>
      </nav></body></html>`,
    );
    set('https://example.com/docs', CONTENT_HTML);
    set('https://example.com/about-page', CONTENT_HTML);

    const report = await runScan(url);

    // homepage + docs + about-page.
    expect(report.pagesScanned).toHaveLength(3);
    expect(report.productFields).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Sitemap-index fallback + non-root scan URL
// ---------------------------------------------------------------------------

describe('runScan — sitemap-index fallback', () => {
  it('falls back to sitemap-index.xml and handles a non-root scan URL', async () => {
    const url = 'https://example.com/shop';
    set(url, `<html><body><a href="https://example.com/news/x">N</a></body></html>`);
    // sitemap.xml is absent (404); sitemap-index.xml provides the URLs.
    set(
      'https://example.com/sitemap-index.xml',
      `<?xml version="1.0"?><urlset><url><loc>https://example.com/news/x</loc></url></urlset>`,
      'application/xml',
    );
    set('https://example.com/news/x', CONTENT_HTML);

    const report = await runScan(url);

    expect(report.pagesScanned.some((p) => p.url === 'https://example.com/news/x')).toBe(true);
    expect(report.pagesScanned.some((p) => p.url === url)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Discovery slot accounting with many overrides
// ---------------------------------------------------------------------------

describe('runScan — limited discovery slots', () => {
  it('reserves slots for overrides, leaving room for only one discovered page', async () => {
    const url = 'https://example.com/';
    set(
      url,
      `<html><body>
        <a href="https://example.com/products/a">PA</a>
        <a href="https://example.com/collections/b">CB</a>
        <a href="https://example.com/blog/c">BC</a>
      </body></html>`,
    );
    for (const path of ['o1', 'o2', 'o3', 'o4']) {
      set(`https://example.com/${path}`, CONTENT_HTML);
    }
    set('https://example.com/products/a', PRODUCT_HTML);
    set('https://example.com/collections/b', CATEGORY_HTML);
    set('https://example.com/blog/c', CONTENT_HTML);

    const overrides: PageOverride[] = [
      { url: 'https://example.com/o1', pageType: 'content' },
      { url: 'https://example.com/o2', pageType: 'content' },
      { url: 'https://example.com/o3', pageType: 'content' },
      { url: 'https://example.com/o4', pageType: 'content' },
    ];

    const report = await runScan(url, { pages: overrides });

    // MAX_PAGES_PER_SCAN(6) - homepage(1) - overrides(4) = 1 discovered slot.
    const overrideUrls = overrides.map((o) => o.url);
    const discovered = report.pagesScanned.filter(
      (p) => p.url !== url && !overrideUrls.includes(p.url),
    );
    expect(discovered).toHaveLength(1);
    // The single slot goes to the first bucket (product).
    expect(discovered[0]!.url).toBe('https://example.com/products/a');
  });
});

// ---------------------------------------------------------------------------
// Report-assembly fallbacks (crafted check results)
// ---------------------------------------------------------------------------

describe('runScan — report assembly fallbacks', () => {
  it('handles unknown priorities, unweighted passes and empty readiness prefixes', async () => {
    const url = 'https://example.com/';
    set(url, CONTENT_HTML);

    const mk = (over: Record<string, unknown>) =>
      ({
        category: 'misc',
        title: 't',
        description: 'd',
        score: 0,
        scoreDisplayMode: 'binary',
        impact: 'Low',
        fix: 'f',
        explanation: 'e',
        details: {},
        ...over,
      }) as unknown;

    const crafted: AuditRunResult = {
      checks: [
        mk({ id: 'm1', status: 'fail', priority: 'mystery', score: 0 }),
        mk({ id: 'm2', status: 'fail', priority: 'enigma', score: 0 }),
        mk({ id: 'm3', status: 'pass', priority: 'low', score: 1 }),
        mk({ id: 'm4', status: 'pass', priority: 'low', score: 1 }),
      ] as AuditRunResult['checks'],
      categories: [
        {
          id: 'misc',
          name: 'Misc',
          weight: 1,
          score: 50,
          checks: [],
          passCount: 2,
          warnCount: 0,
          failCount: 2,
        },
      ],
      overallScore: 50,
    };
    vi.mocked(runAudits).mockResolvedValueOnce(crafted);

    const report = await runScan(url);

    // Both fails surface as recommendations (sorted via the priority fallback).
    expect(report.recommendations).toHaveLength(2);
    // Both passes surface as top passes (sorted via the weight fallback).
    expect(report.topPasses).toHaveLength(2);
    // No crawler-permissions / technical-readiness checks → those vitals are 0.
    expect(report.readinessVitals?.botAccessibility).toBe(0);
    expect(report.readinessVitals?.technical).toBe(0);
  });

  it('never lets an na check move a readiness vital', async () => {
    const url = 'https://example.com/';

    const mk = (over: Record<string, unknown>) =>
      ({
        category: 'misc',
        title: 't',
        description: 'd',
        score: 0,
        scoreDisplayMode: 'binary',
        impact: 'Low',
        fix: 'f',
        explanation: 'e',
        details: {},
        ...over,
      }) as unknown;

    // One passing check per vital, so each vital has real evidence to average.
    const applicable = [
      mk({ id: '3.8', status: 'pass', priority: 'low', score: 1 }),
      mk({ id: '1.1', status: 'pass', priority: 'low', score: 1 }),
      mk({ id: 'cp1', category: 'crawler-permissions', status: 'pass', priority: 'low', score: 1 }),
      mk({ id: 'tr1', category: 'technical-readiness', status: 'pass', priority: 'low', score: 1 }),
    ];

    // The na stubs a real scan emits: status 'na' with the stub score of 0.
    const naStubs = [
      mk({ id: '3.14', status: 'na', priority: 'low', score: 0 }),
      mk({ id: '1.2', status: 'na', priority: 'low', score: 0 }),
      mk({ id: 'cp2', category: 'crawler-permissions', status: 'na', priority: 'low', score: 0 }),
      mk({ id: 'tr2', category: 'technical-readiness', status: 'na', priority: 'low', score: 0 }),
    ];

    const run = async (checks: unknown[]) => {
      h.map.clear();
      set(url, CONTENT_HTML);
      vi.mocked(runAudits).mockResolvedValueOnce({
        checks: checks as AuditRunResult['checks'],
        categories: [],
        overallScore: 100,
      });
      return runScan(url);
    };

    const without = await run(applicable);
    const withNa = await run([...applicable, ...naStubs]);

    expect(without.readinessVitals).toEqual({
      commerce: 100,
      content: 100,
      botAccessibility: 100,
      technical: 100,
    });
    expect(withNa.readinessVitals).toEqual(without.readinessVitals);
    expect(withNa.readinessScore).toBe(without.readinessScore);
  });
});

// ---------------------------------------------------------------------------
// Informative checks are advisory-only: they never drive user-facing lists
// ---------------------------------------------------------------------------

describe('runScan — informative checks stay out of recommendations and top lists', () => {
  it('omits informative checks from recommendations, topFails and topPasses', async () => {
    const url = 'https://example.com/';
    set(url, CONTENT_HTML);

    const mk = (over: Record<string, unknown>) =>
      ({
        category: 'misc',
        title: 't',
        description: 'd',
        score: 0,
        scoreDisplayMode: 'binary',
        impact: 'Low',
        fix: 'f',
        explanation: 'e',
        details: {},
        ...over,
      }) as unknown;

    const crafted: AuditRunResult = {
      checks: [
        mk({
          id: 'info-fail',
          description: 'info-fail-description',
          status: 'fail',
          priority: 'critical',
          score: 0,
          scoreDisplayMode: 'informative',
        }),
        mk({
          id: 'real-fail',
          description: 'real-fail-description',
          status: 'fail',
          priority: 'high',
          score: 0,
        }),
        mk({
          id: 'info-pass',
          status: 'pass',
          priority: 'low',
          score: 1,
          scoreDisplayMode: 'informative',
        }),
        mk({ id: 'real-pass', status: 'pass', priority: 'low', score: 1 }),
      ] as AuditRunResult['checks'],
      categories: [
        {
          id: 'misc',
          name: 'Misc',
          weight: 1,
          score: 50,
          checks: [],
          passCount: 2,
          warnCount: 0,
          failCount: 2,
        },
      ],
      overallScore: 50,
    };
    vi.mocked(runAudits).mockResolvedValueOnce(crafted);

    const report = await runScan(url);

    // `recommendations` is typed as CheckRecommendation (no `id`), so identify
    // the entries by their description instead.
    const recommendationDescriptions = report.recommendations.map((r) => r.description);
    expect(recommendationDescriptions).not.toContain('info-fail-description');
    expect(recommendationDescriptions).toContain('real-fail-description');

    expect(report.topFails.map((c) => c.id)).not.toContain('info-fail');
    expect(report.topFails.map((c) => c.id)).toContain('real-fail');

    const topPassIds = report.topPasses.map((c) => c.id);
    expect(topPassIds).not.toContain('info-pass');
    expect(topPassIds).toContain('real-pass');
  });
});

// ---------------------------------------------------------------------------
// Informative checks must not move readiness vitals / readinessScore
// ---------------------------------------------------------------------------

describe('runScan — informative checks stay out of readiness vitals', () => {
  it('adding a failing informative check leaves readinessVitals and readinessScore unchanged', async () => {
    const url = 'https://example.com/';
    set(url, CONTENT_HTML);

    const mk = (over: Record<string, unknown>) =>
      ({
        category: 'misc',
        title: 't',
        description: 'd',
        status: 'pass',
        priority: 'low',
        score: 1,
        scoreDisplayMode: 'binary',
        impact: 'Low',
        fix: 'f',
        explanation: 'e',
        details: {},
        ...over,
      }) as unknown;

    // Baseline: every vital-feeding check passes, so `content` (id list) and
    // `botAccessibility` (category prefix) both come out at 100.
    const baseChecks = [
      mk({ id: '1.1', category: 'content-structure' }),
      mk({ id: '1.2', category: 'content-structure' }),
      mk({ id: 'cp-1', category: 'crawler-permissions' }),
    ];

    const craft = (checks: unknown[]): AuditRunResult => ({
      checks: checks as AuditRunResult['checks'],
      categories: [
        {
          id: 'misc',
          name: 'Misc',
          weight: 1,
          score: 100,
          checks: [],
          passCount: checks.length,
          warnCount: 0,
          failCount: 0,
        },
      ],
      overallScore: 100,
    });

    vi.mocked(runAudits).mockResolvedValueOnce(craft(baseChecks));
    const baseline = await runScan(url);

    // Same run plus two failing informative checks — one on the id-list vital
    // (`content`), one on the category-prefix vital (`botAccessibility`).
    // Unfiltered they would drag both averages down.
    const withInformative = [
      ...baseChecks,
      mk({
        id: '1.3',
        category: 'content-structure',
        status: 'fail',
        score: 0,
        scoreDisplayMode: 'informative',
      }),
      mk({
        id: 'cp-2',
        category: 'crawler-permissions',
        status: 'fail',
        score: 0,
        scoreDisplayMode: 'informative',
      }),
    ];

    vi.mocked(runAudits).mockResolvedValueOnce(craft(withInformative));
    const withInfo = await runScan(url);

    // Sanity: the baseline vitals are actually non-zero, so "unchanged" is a
    // real claim and not two empty objects matching by accident.
    expect(baseline.readinessVitals?.content).toBe(100);
    expect(baseline.readinessVitals?.botAccessibility).toBe(100);

    expect(withInfo.readinessVitals).toEqual(baseline.readinessVitals);
    expect(withInfo.readinessScore).toBe(baseline.readinessScore);
  });
});

// ---------------------------------------------------------------------------
// Progress events (options-bag API)
// ---------------------------------------------------------------------------

describe('runScan — progress events', () => {
  const url = 'https://example.com/';

  beforeEach(() => {
    set(
      url,
      `<html><body><nav>
        <a href="/products/widget">W</a>
      </nav></body></html>`,
    );
    set('https://example.com/products/widget', PRODUCT_HTML);
  });

  it('emits an ordered, monotonic event stream through a full scan', async () => {
    const events: ScanEvent[] = [];
    const report = await runScan(url, { onEvent: (e) => events.push(e) });

    expect(events[0]).toMatchObject({ type: 'scan:start', url, fraction: 0 });
    expect(events.at(-1)).toMatchObject({
      type: 'scan:done',
      score: report.overallScore,
      fraction: 1,
      durationMs: expect.any(Number),
    });

    // Phases run in order, each bracketed by phase:start / phase:done.
    const phaseStarts = events.filter((e) => e.type === 'phase:start').map((e) => e.phase);
    const phaseDones = events.filter((e) => e.type === 'phase:done').map((e) => e.phase);
    const order = ['fetch-root', 'fetch-pages', 'analyze', 'audits', 'report'];
    expect(phaseStarts).toEqual(order);
    expect(phaseDones).toEqual(order);

    // fetch-root emits one unit:done per fetched root file.
    const rootUnits = events.filter((e) => e.type === 'unit:done' && e.phase === 'fetch-root');
    const rootStart = events.find((e) => e.type === 'phase:start' && e.phase === 'fetch-root')!;
    expect(rootStart).toMatchObject({ totalUnits: rootUnits.length });
    expect(rootUnits.length).toBeGreaterThan(30);

    // audits phase: every runnable audit settles into exactly one unit event.
    const auditsStart = events.find((e) => e.type === 'phase:start' && e.phase === 'audits')!;
    const auditUnits = events.filter(
      (e) => (e.type === 'unit:done' || e.type === 'unit:fail') && e.phase === 'audits',
    );
    expect(auditsStart).toMatchObject({ totalUnits: auditUnits.length });
    expect(auditUnits.length).toBeGreaterThan(100);

    // fraction is monotonic non-decreasing, elapsedMs always present.
    let prev = -1;
    for (const e of events) {
      expect(e.fraction).toBeGreaterThanOrEqual(prev);
      expect(e.elapsedMs).toBeGreaterThanOrEqual(0);
      prev = e.fraction;
    }
  });
});

