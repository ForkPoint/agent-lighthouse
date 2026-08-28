import { parseHtml, extractJsonLd, extractMetaTags, extractHeadLinks } from '../parser';
import type { CheckContext, PageContext } from '../check-context';
import type { FetchResult } from '../fetcher';
import type { EvidenceKey, ScanEvidence } from '../scan-evidence';
import type { PageType } from '../types';

/**
 * Scan states in which an audit has the least to go on and the most freedom to
 * invent. Four of them are the states the evidence gate marks unscored; the
 * fifth is a page that arrived and said nothing.
 *
 * These are contexts, not fixtures: the contract suites run every registered
 * audit against each one, so an audit that congratulates a site the scan never
 * read is caught whoever wrote it.
 */
export interface HostileState {
  /** Short name, used in test titles and failure messages. */
  name: string;
  /** The evidence keys this state denies. */
  missing: EvidenceKey[];
  /** True when the scan obtained no usable response at all. */
  nothingObtained: boolean;
  build(): CheckContext;
}

const BASE_URL = 'https://example.test';

/** Root paths a scan always asks for, so a state can answer them uniformly. */
const ROOT_PATHS = ['/robots.txt', '/sitemap.xml', '/llms.txt'];

function fetchResult(over: Partial<FetchResult> = {}): FetchResult {
  const body = over.body ?? '';
  return {
    url: BASE_URL,
    finalUrl: BASE_URL,
    status: 200,
    headers: {},
    body,
    ttfbMs: 1,
    totalMs: 2,
    contentType: '',
    contentLength: body.length,
    ...over,
  };
}

/** Every root path answering the same way — a wall answers uniformly. */
function rootFiles(build: (path: string) => FetchResult): Record<string, FetchResult> {
  return Object.fromEntries(ROOT_PATHS.map((path) => [path, build(path)]));
}

function evidence(
  reasons: Partial<Record<EvidenceKey, string>>,
  renderedByPage: Record<string, boolean> = {},
  usablePageTypes: PageType[] = [],
): ScanEvidence {
  const met: Record<EvidenceKey, boolean> = {
    'origin-reachable': true,
    'unblocked-fetches': true,
    'rendered-body': true,
    'sample-adequate': true,
  };
  for (const key of Object.keys(reasons) as EvidenceKey[]) met[key] = false;

  return {
    met,
    reasons,
    renderedByPage,
    usablePageTypes: new Set(usablePageTypes),
    // Same rule the scan uses: a shell was still a response from the site.
    judgeable: met['origin-reachable'] && met['unblocked-fetches'],
  };
}

function page(url: string, html: string, pageType: PageType = 'homepage'): PageContext {
  const $ = parseHtml(html);
  return {
    url,
    pageType,
    fetchResult: fetchResult({ url, finalUrl: url, body: html, contentType: 'text/html' }),
    $,
    jsonLd: extractJsonLd($),
    meta: extractMetaTags($),
    headLinks: extractHeadLinks($),
  };
}

function context(over: Partial<CheckContext>): CheckContext {
  return {
    rootFiles: {},
    pages: [],
    domain: 'example.test',
    baseUrl: BASE_URL,
    fetch: async ({ url }) => fetchResult({ url, finalUrl: url, status: 404 }),
    evidence: evidence({}),
    ...over,
  };
}

/** A bot wall: every request refused, nothing read. */
const blocked: HostileState = {
  name: 'blocked',
  missing: ['unblocked-fetches', 'rendered-body', 'sample-adequate'],
  nothingObtained: true,
  build: () =>
    context({
      rootFiles: rootFiles((path) =>
        fetchResult({
          url: `${BASE_URL}${path}`,
          finalUrl: `${BASE_URL}${path}`,
          status: 403,
          headers: { 'cf-ray': '8a0f0000000-LHR', 'content-type': 'text/html' },
          body: '<html><body>Attention Required! | Cloudflare</body></html>',
        }),
      ),
      wafProtection: {
        isBlocked: true,
        provider: 'cloudflare',
        name: 'Cloudflare',
        reason: 'HTTP 403 with a cf-ray header',
        statusCode: 403,
      },
      evidence: evidence({
        'unblocked-fetches': 'Cloudflare answered the scanner with HTTP 403.',
        'rendered-body': 'No page was read.',
        'sample-adequate': 'No page was read.',
      }),
    }),
};

/** A throttle: the scan asked too fast. Says nothing about who the site admits. */
const throttled: HostileState = {
  name: 'throttled',
  missing: ['unblocked-fetches', 'rendered-body', 'sample-adequate'],
  nothingObtained: true,
  build: () =>
    context({
      rootFiles: rootFiles((path) =>
        fetchResult({
          url: `${BASE_URL}${path}`,
          finalUrl: `${BASE_URL}${path}`,
          status: 429,
          headers: { 'retry-after': '30' },
        }),
      ),
      wafProtection: {
        isBlocked: true,
        provider: 'rate-limited',
        name: 'Rate limit',
        reason: 'HTTP 429 on every request',
        statusCode: 429,
        isRateLimit: true,
      },
      evidence: evidence({
        'unblocked-fetches': 'The site answered HTTP 429 on every request.',
        'rendered-body': 'No page was read.',
        'sample-adequate': 'No page was read.',
      }),
    }),
};

/** A temporary hop to somewhere else: the site asked for was never reached. */
const redirectedAway: HostileState = {
  name: 'redirected-away',
  missing: ['origin-reachable', 'rendered-body', 'sample-adequate'],
  nothingObtained: true,
  build: () =>
    context({
      evidence: evidence({
        'origin-reachable': 'The homepage redirected to parked.example.net.',
        'rendered-body': 'No page was read.',
        'sample-adequate': 'No page was read.',
      }),
    }),
};

/** The origin answered, with a PDF. Nothing an HTML audit can read. */
const nonHtml: HostileState = {
  name: 'non-html',
  missing: ['rendered-body', 'sample-adequate'],
  nothingObtained: true,
  build: () =>
    context({
      rootFiles: {
        '/robots.txt': fetchResult({
          url: `${BASE_URL}/robots.txt`,
          finalUrl: `${BASE_URL}/robots.txt`,
          status: 404,
        }),
      },
      evidence: evidence({
        'rendered-body': 'The homepage served application/pdf.',
        'sample-adequate': 'No HTML page was read.',
      }),
    }),
};

/** A JS shell: a page arrived, carrying no text a non-JS consumer can read. */
const shell: HostileState = {
  name: 'shell',
  missing: ['rendered-body', 'sample-adequate'],
  nothingObtained: false,
  build: () => {
    const url = `${BASE_URL}/`;
    return context({
      pages: [
        page(
          url,
          '<html lang="en"><head><title>Shop</title></head><body><div id="root"></div></body></html>',
        ),
      ],
      rootFiles: {
        '/robots.txt': fetchResult({
          url: `${BASE_URL}/robots.txt`,
          finalUrl: `${BASE_URL}/robots.txt`,
          body: 'User-agent: *\nAllow: /\n',
          contentType: 'text/plain',
        }),
      },
      evidence: evidence(
        {
          'rendered-body': 'The served HTML carried no readable text.',
          'sample-adequate': 'No page rendered text.',
        },
        { [url]: false },
      ),
    });
  },
};

export const NOTHING_OBTAINED: HostileState[] = [blocked, throttled, redirectedAway, nonHtml];
export const SHELL_STATE: HostileState = shell;
export const HOSTILE_STATES: HostileState[] = [...NOTHING_OBTAINED, shell];
