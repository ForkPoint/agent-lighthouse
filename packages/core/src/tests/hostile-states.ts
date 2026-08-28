import {
  parseHtml,
  extractJsonLd,
  extractMetaTags,
  extractHeadLinks,
  extractMicrodata,
  extractRdfa,
} from '../parser';
import { buildScanEvidence } from '../scan-evidence';
import { detectWafProtection } from '../waf-detector';
import type { CheckContext, PageContext } from '../check-context';
import type { FetchResult } from '../fetcher';
import type { EvidenceKey } from '../scan-evidence';
import type { WafProtection } from '../waf-detector';
import type { PageType } from '../types';

/**
 * Scan states in which an audit has the least to go on and the most freedom to
 * invent. Five of them hold no evidence about the site the user asked for; the
 * sixth is a page that arrived and said nothing.
 *
 * These are contexts, not fixtures: the contract suites run every registered
 * audit against each one, so an audit that congratulates a site the scan never
 * read is caught whoever wrote it.
 *
 * Every state is assembled the way `orchestrator.ts` assembles a real scan and
 * its evidence comes from the real `buildScanEvidence`. A hand-written `met`
 * map would let the suite agree with itself while disagreeing with production,
 * which is the one failure this suite cannot afford.
 */
export interface HostileState {
  /** Short name, used in test titles and failure messages. */
  name: string;
  /**
   * The evidence keys this state is expected to deny. Declared, not derived:
   * the suite asserts `buildScanEvidence` agrees, so a change to the gate's
   * rules fails here instead of quietly redefining the state.
   */
  missing: EvidenceKey[];
  /** True when the scan holds no evidence about the site the user asked for. */
  nothingObtained: boolean;
  build(): CheckContext;
}

const BASE_URL = 'https://example.test';
const HOME_URL = `${BASE_URL}/`;

/**
 * The root paths a scan asks for, mirroring `rootFilePaths` in
 * `orchestrator.ts`. A wall answers all of them, so a state that populated
 * only a couple would leave an audit reading any other path a `undefined` it
 * never gets in production — and hide the audits that read a challenge page's
 * body without checking its status. `hostile-states.test.ts` proves this list
 * still matches the orchestrator's.
 */
export const ROOT_PATHS = [
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
  '/.well-known/api-catalog',
  '/.well-known/ai-catalog.json',
  '/.well-known/mcp/servers.json',
  '/.well-known/ucp',
  '/.well-known/agents.json',
  '/.well-known/ai-plugin.json',
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

function fetchResult(over: Partial<FetchResult> & { url: string }): FetchResult {
  const body = over.body ?? '';
  const contentType = over.contentType ?? '';
  // A real response carries the type in both places. Audits read whichever one
  // they were written against, so a fixture that sets only one lets an audit
  // pass here and fail on a live scan.
  const headers: Record<string, string> = { ...over.headers };
  if (contentType) headers['content-type'] ??= contentType;
  return {
    finalUrl: over.url,
    status: 200,
    body,
    ttfbMs: 1,
    totalMs: 2,
    contentLength: body.length,
    ...over,
    contentType,
    headers,
  };
}

/** Every root path answering the same way — a wall answers uniformly. */
function rootFiles(build: (path: string) => Partial<FetchResult>): Record<string, FetchResult> {
  return Object.fromEntries(
    ROOT_PATHS.map((path) => {
      const url = `${BASE_URL}${path}`;
      return [path, fetchResult({ url, ...build(path) })];
    }),
  );
}

/**
 * A page context built exactly as `orchestrator.ts` builds one, including the
 * structured-data union that product audits read.
 */
function toPageContext(url: string, result: FetchResult, pageType: PageType): PageContext {
  const $ = parseHtml(result.body);
  const jsonLd = extractJsonLd($);
  return {
    url,
    pageType,
    fetchResult: result,
    $,
    jsonLd,
    structuredData: [...jsonLd, ...extractMicrodata($), ...extractRdfa($)],
    meta: extractMetaTags($),
    headLinks: extractHeadLinks($),
  };
}

/**
 * The orchestrator's page filter, copied deliberately: `status === 200 && body`
 * with no content-type gate. A parked page and a PDF homepage both become a
 * `PageContext`, so states built from them must hand audits that page rather
 * than an empty list.
 */
function pagesFrom(homepage: FetchResult, pageType: PageType): PageContext[] {
  if (homepage.status !== 200 || !homepage.body) return [];
  return [toPageContext(HOME_URL, homepage, pageType)];
}

interface StateSpec {
  name: string;
  missing: EvidenceKey[];
  nothingObtained: boolean;
  homepage: FetchResult;
  rootFiles: Record<string, FetchResult>;
  wafProtection?: WafProtection;
  /**
   * Derive the WAF verdict from the responses instead of stating it, for a
   * state whose whole point is that the live detector reaches it.
   */
  waf?: (homepage: FetchResult, rootFiles: Record<string, FetchResult>) => WafProtection | null;
  /** Type the classifier would give the page, when one survives the filter. */
  pageType?: PageType;
}

function state(spec: StateSpec): HostileState {
  return {
    name: spec.name,
    missing: spec.missing,
    nothingObtained: spec.nothingObtained,
    build: () => {
      const pages = pagesFrom(spec.homepage, spec.pageType ?? 'homepage');
      const waf = spec.waf?.(spec.homepage, spec.rootFiles) ?? spec.wafProtection ?? null;
      return {
        rootFiles: spec.rootFiles,
        pages,
        domain: 'example.test',
        baseUrl: BASE_URL,
        fetch: async ({ url }) => fetchResult({ url, status: 404 }),
        wafProtection: waf ?? undefined,
        evidence: buildScanEvidence({
          requestedUrl: HOME_URL,
          homepageResult: spec.homepage,
          pages,
          rootFiles: spec.rootFiles,
          wafProtection: waf,
        }),
      };
    },
  };
}

const CLOUDFLARE_CHALLENGE =
  '<html><head><title>Attention Required! | Cloudflare</title></head>' +
  '<body><h1>Sorry, you have been blocked</h1><p>You are unable to access example.test</p></body></html>';

/**
 * A bot wall: every request refused, nothing read. The challenge HTML is
 * served at every root path, which is what catches an audit that reads a root
 * file's body without checking its status.
 */
const blocked = state({
  name: 'blocked',
  missing: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
  nothingObtained: true,
  homepage: fetchResult({
    url: HOME_URL,
    status: 403,
    contentType: 'text/html',
    headers: { 'cf-ray': '8a0f0000000abc-LHR', server: 'cloudflare' },
    body: CLOUDFLARE_CHALLENGE,
  }),
  rootFiles: rootFiles(() => ({
    status: 403,
    contentType: 'text/html',
    headers: { 'cf-ray': '8a0f0000000abc-LHR', server: 'cloudflare' },
    body: CLOUDFLARE_CHALLENGE,
  })),
  wafProtection: {
    isBlocked: true,
    provider: 'cloudflare',
    name: 'Cloudflare',
    reason: 'HTTP 403 with a cf-ray header',
    statusCode: 403,
  },
});

/**
 * The same wall, served at HTTP 200.
 *
 * Copied from the two 200-status interstitials in the real corpus:
 * `stackoverflow-thread-wall.html.gz` and `ebay-com-category-wall.html.gz`
 * both carry `<title>Just a moment...</title>`, `<meta name="robots"
 * content="noindex,nofollow">` and a `cf-mitigated: challenge` header, and
 * their whole rendered body is one line asking the reader to enable
 * JavaScript.
 *
 * `blocked` answers 403, which denies `origin-reachable` and takes every
 * attribution guard with it. A managed challenge served at 200 `text/html`
 * from the requested host denies nothing but `unblocked-fetches`, so it is the
 * one wall the four states above do not reach — and the state that convicts an
 * audit whose only protection is `origin-reachable`.
 */
const CHALLENGE_200_HTML =
  '<!DOCTYPE html><html lang="en-US"><head><title>Just a moment...</title>' +
  '<meta name="robots" content="noindex,nofollow">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
  '<body class="no-js"><div class="main-wrapper" role="main"><div class="main-content">' +
  '<h1>example.test</h1><p id="challenge-error-text">Enable JavaScript and cookies to continue</p>' +
  '</div></div><script src="/cdn-cgi/challenge-platform/h/b/orchestrate/chl_page/v1"></script>' +
  '</body></html>';

const CHALLENGE_200_HEADERS = {
  'cf-mitigated': 'challenge',
  'cf-ray': 'a32341f569537bd7-SOF',
  server: 'cloudflare',
};

const challengedAt200 = state({
  name: 'challenged-at-200',
  missing: ['unblocked-fetches', 'rendered-body', 'sample-adequate'],
  nothingObtained: true,
  homepage: fetchResult({
    url: HOME_URL,
    status: 200,
    contentType: 'text/html',
    headers: CHALLENGE_200_HEADERS,
    body: CHALLENGE_200_HTML,
  }),
  rootFiles: rootFiles(() => ({
    status: 200,
    contentType: 'text/html',
    headers: CHALLENGE_200_HEADERS,
    body: CHALLENGE_200_HTML,
  })),
  // Derived, not written by hand. The hand-written maps on the states above
  // predate this one; here the point is that a live scan of this response
  // really does produce a blocked verdict, so the detector decides it.
  waf: (homepage, files) => detectWafProtection(HOME_URL, homepage, files, 1),
});

/** A throttle: the scan asked too fast. Says nothing about who the site admits. */
const throttled = state({
  name: 'throttled',
  missing: ['origin-reachable', 'unblocked-fetches', 'rendered-body', 'sample-adequate'],
  nothingObtained: true,
  homepage: fetchResult({
    url: HOME_URL,
    status: 429,
    contentType: 'text/html',
    headers: { 'retry-after': '30' },
    body: '<html><body>Too Many Requests</body></html>',
  }),
  rootFiles: rootFiles(() => ({
    status: 429,
    contentType: 'text/html',
    headers: { 'retry-after': '30' },
    body: '<html><body>Too Many Requests</body></html>',
  })),
  wafProtection: {
    isBlocked: true,
    provider: 'rate-limited',
    name: 'Rate limit (HTTP 429)',
    reason: 'The site answered HTTP 429 — too many requests',
    statusCode: 429,
    isRateLimit: true,
  },
});

/**
 * A parking page under somebody else's domain, reached through a temporary
 * hop. The nastiest of the five: a page arrives, it renders plenty of text,
 * and every word of it is about a domain broker rather than the site. Only
 * `origin-reachable` is denied, so an audit that reads `pages` without
 * consulting the gate will happily score the parking page.
 *
 * The host is deliberately not `parked.example.net`: `buildScanEvidence`
 * accepts a sibling registrable *name* across suffixes, so anything under
 * `example.*` would be judged the same site and this state would silently
 * stop being hostile.
 */
const PARKED_URL = 'https://parking.brandsale.test/example.test';
const PARKED_PAGE =
  '<html lang="en"><head><title>example.test is for sale</title></head><body><main>' +
  '<h1>The domain example.test is for sale</h1>' +
  '<p>This premium domain name is available for immediate purchase through our brokerage. ' +
  'Our team has been connecting buyers and sellers of premium domain names since 2003, and we ' +
  'handle escrow, transfer and registrar paperwork on every sale we broker for our clients. ' +
  'Make an offer today and one of our brokers will respond to your enquiry within one business ' +
  'day to discuss pricing, payment plans and the transfer timeline in full detail.</p>' +
  '<p>Financing is available on most listings, and every transaction is protected by escrow.</p>' +
  '</main></body></html>';

const redirectedAway = state({
  name: 'redirected-away',
  missing: ['origin-reachable'],
  nothingObtained: true,
  homepage: fetchResult({
    url: HOME_URL,
    finalUrl: PARKED_URL,
    status: 200,
    contentType: 'text/html',
    body: PARKED_PAGE,
    redirectChain: [{ status: 302, from: HOME_URL, to: PARKED_URL }],
  }),
  rootFiles: rootFiles(() => ({
    // A parking host answers every path with the same page, which is how an
    // audit ends up reporting a broker's copy as the site's llms.txt.
    finalUrl: PARKED_URL,
    status: 200,
    contentType: 'text/html',
    body: PARKED_PAGE,
  })),
});

/**
 * The origin answered, with a PDF. The orchestrator has no content-type gate
 * on its page filter, so this still becomes a `PageContext` — a cheerio parse
 * of PDF source, which is nothing an HTML audit can read but is not nothing.
 */
const PDF_BODY = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\ntrailer\n%%EOF\n';

const nonHtml = state({
  name: 'non-html',
  missing: ['origin-reachable', 'rendered-body', 'sample-adequate'],
  nothingObtained: true,
  homepage: fetchResult({
    url: HOME_URL,
    status: 200,
    contentType: 'application/pdf',
    body: PDF_BODY,
  }),
  rootFiles: rootFiles(() => ({ status: 404 })),
});

/**
 * The body a JS shell serves: a mount point and a bundle, no text. Exported so
 * the per-audit tests build their shell from this exact page — two copies that
 * drift would let the contract suite and the unit tests stop agreeing on what
 * a shell is.
 */
export const SHELL_HTML =
  '<html lang="en"><head><title>Shop</title></head>' +
  '<body><div id="root"></div><script src="/app.js"></script></body></html>';

/**
 * A JS shell: a page arrived from the right host, carrying no text a non-JS
 * consumer can read. The only state the gate still calls judgeable — what this
 * site serves is a finding about the site, not about the scan.
 */
const shell = state({
  name: 'shell',
  missing: ['rendered-body', 'sample-adequate'],
  nothingObtained: false,
  homepage: fetchResult({
    url: HOME_URL,
    status: 200,
    contentType: 'text/html',
    body: SHELL_HTML,
  }),
  rootFiles: rootFiles((path) =>
    path === '/robots.txt'
      ? {
          status: 200,
          contentType: 'text/plain',
          body: 'User-agent: *\nAllow: /\n',
        }
      : { status: 404 },
  ),
});

export const NOTHING_OBTAINED: HostileState[] = [
  blocked,
  challengedAt200,
  throttled,
  redirectedAway,
  nonHtml,
];
export const SHELL_STATE: HostileState = shell;
export const HOSTILE_STATES: HostileState[] = [...NOTHING_OBTAINED, shell];
