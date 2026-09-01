import {
  parseHtml,
  extractJsonLd,
  extractMetaTags,
  extractHeadLinks,
  detectPageType,
} from '../parser';
import type { CheckContext, PageContext } from '../check-context';
import type { FetchResult } from '../fetcher';
import { allEvidenceMet, buildScanEvidence } from '../scan-evidence';
import { SHELL_HTML } from '../tests/hostile-states';

export function mockPageContext(url: string, html: string, index: number = 0): PageContext {
  const $ = parseHtml(html);
  const jsonLd = extractJsonLd($);
  const meta = extractMetaTags($);
  const fetchResult = mockFetchResult(html, 200, 'text/html');
  fetchResult.url = url;
  fetchResult.finalUrl = url;

  return {
    url,
    pageType: detectPageType(url, $, jsonLd, meta, index === 0),
    fetchResult,
    $,
    jsonLd,
    meta,
    headLinks: extractHeadLinks($),
  };
}

export function mockCheckContext(
  pages: PageContext[],
  rootFiles: Record<string, FetchResult> = {},
): CheckContext {
  return {
    pages,
    rootFiles,
    domain: 'example.com',
    baseUrl: 'https://example.com',
    fetch: async ({ url }) => {
      try {
        const pathname = new URL(url).pathname;
        if (rootFiles[pathname]) return rootFiles[pathname];
      } catch {}
      return mockFetchResult('', 404);
    },
    // Unit tests judge the audit, not the gate: hand every requirement to them
    // so a two-page fixture never gates itself out.
    evidence: allEvidenceMet(),
  };
}


/**
 * A page and a set of root files complete enough that every audit reading them
 * reaches some verdict. Paired with {@link unreachedSiteContext} it proves an
 * attribution guard fires: the same input yields a verdict when the scan
 * reached the site and `na` when it did not.
 */
export function attributableFixture(): {
  pages: PageContext[];
  rootFiles: Record<string, FetchResult>;
} {
  const body = Array.from(
    { length: 60 },
    () => 'Widgets are machined from bar stock and finished by hand in our workshop.',
  ).join(' ');
  const html =
    '<html lang="en"><head><title>Widgets</title>' +
    '<meta name="description" content="Hand-finished widgets, machined from bar stock." />' +
    '<link rel="alternate" type="application/rss+xml" href="/rss.xml" /></head>' +
    '<body><header>Navigation</header><main><article><h1>Widgets</h1>' +
    `<p>${body}</p>` +
    '<figure><img src="/widget.png" alt="A widget" /><figcaption>A widget.</figcaption></figure>' +
    '<table><thead><tr><th>Name</th></tr></thead><tbody><tr><td>Widget</td></tr></tbody></table>' +
    '<a href="/widgets/hand-finished-widget">Hand-finished widget</a>' +
    '</article></main><footer>Contact us</footer></body></html>';

  const file = (path: string, bodyText: string, contentType: string): FetchResult => {
    const result = mockFetchResult(bodyText, 200, contentType);
    result.url = `https://example.com${path}`;
    result.finalUrl = result.url;
    return result;
  };

  return {
    pages: [mockPageContext('https://example.com/widgets/hand-finished-widget', html)],
    rootFiles: {
      '/robots.txt': file('/robots.txt', 'User-agent: *\nAllow: /\n', 'text/plain'),
      '/llms.txt': file('/llms.txt', '# Widgets\n\n- [Widgets](/widgets)\n', 'text/plain'),
      '/llms-full.txt': file('/llms-full.txt', `# Widgets\n\n${body}\n`, 'text/plain'),
      '/rss.xml': file(
        '/rss.xml',
        '<?xml version="1.0"?><rss version="2.0"><channel><title>Widgets</title>' +
          '<item><title>A widget</title><link>https://example.com/widgets/a</link></item>' +
          '</channel></rss>',
        'application/rss+xml',
      ),
    },
  };
}

/**
 * A scan holding readable responses it cannot attribute to the site the user
 * asked for — the `redirected-away` hostile state at unit-test scale. Every
 * audit that names `origin-reachable` in its `requires` must decline here.
 */
export function unreachedSiteContext(
  pages: PageContext[] = [],
  rootFiles: Record<string, FetchResult> = {},
): CheckContext {
  const ctx = mockCheckContext(pages, rootFiles);
  return {
    ...ctx,
    evidence: {
      ...ctx.evidence,
      met: { ...ctx.evidence.met, 'origin-reachable': false },
      reasons: {
        'origin-reachable':
          'The requested host redirected to parking.brandsale.test, a different site, ' +
          'without a permanent redirect.',
      },
      judgeable: false,
    },
  };
}

/**
 * A scan the site walled: a bot wall on the context *and* `origin-reachable`
 * denied, which is exactly what an HTTP 403 challenge produces.
 *
 * This pairing is the point. {@link unreachedSiteContext} flips the evidence
 * key alone, so an attribution guard mistakenly placed *above* an audit's wall
 * branch still passes there. Here it does not: the audits whose subject is the
 * refusal must return the refusal, and ordering is what this context pins.
 */
export function walledSiteContext(overrides: Partial<CheckContext> = {}): CheckContext {
  const ctx = unreachedSiteContext();
  return {
    ...ctx,
    wafProtection: {
      isBlocked: true,
      provider: 'cloudflare',
      name: 'Cloudflare',
      reason: 'HTTP 403 with a cf-ray header',
      statusCode: 403,
    },
    evidence: {
      ...ctx.evidence,
      met: { ...ctx.evidence.met, 'unblocked-fetches': false },
      reasons: {
        ...ctx.evidence.reasons,
        'origin-reachable': 'The homepage answered HTTP 403.',
        'unblocked-fetches': 'Cloudflare refused the scan: HTTP 403 with a cf-ray header.',
      },
    },
    ...overrides,
  };
}

/**
 * A scan a bot wall answered at HTTP 200.
 *
 * The wall the branch's `challenged-at-200` hostile state models, at unit-test
 * scale. It is not {@link walledSiteContext}: a managed challenge served at 200
 * `text/html` from the requested host meets every test `origin-reachable`
 * applies, so only `unblocked-fetches` is denied and an audit guarding on
 * `origin-reachable` alone still runs — against markup and headers the wall
 * attached, not the site.
 *
 * Pass the same `pages` and `rootFiles` an audit judges when the scan reached
 * the site, so the pair proves the guard fires on the wall and only there.
 */
export function challengedSiteContext(
  pages: PageContext[] = [],
  rootFiles: Record<string, FetchResult> = {},
): CheckContext {
  const ctx = mockCheckContext(pages, rootFiles);
  return {
    ...ctx,
    wafProtection: {
      isBlocked: true,
      provider: 'cloudflare',
      name: 'Cloudflare',
      reason: 'HTTP 200 with cf-mitigated: challenge',
      statusCode: 200,
    },
    evidence: {
      ...ctx.evidence,
      met: { ...ctx.evidence.met, 'unblocked-fetches': false },
      reasons: {
        ...ctx.evidence.reasons,
        'unblocked-fetches':
          'Cloudflare refused the scan: HTTP 200 with cf-mitigated: challenge.',
      },
      judgeable: false,
    },
  };
}

/**
 * A page that arrived from the right host and rendered no text.
 *
 * `origin-reachable` and `unblocked-fetches` stay met — a shell is a finding
 * about the site, not about the scan — so the evidence comes from the real
 * `buildScanEvidence` rather than a hand-written `met` map. An audit reading
 * the response envelope must still reach a verdict here; one reading the
 * rendered document must not congratulate the emptiness.
 */
export function shellSiteContext(
  html: string = SHELL_HTML,
  rootFiles: Record<string, FetchResult> = {},
): CheckContext {
  const url = 'https://example.com/';
  const page = mockPageContext(url, html);
  const ctx = mockCheckContext([page], rootFiles);
  return {
    ...ctx,
    evidence: buildScanEvidence({
      requestedUrl: url,
      homepageResult: page.fetchResult,
      pages: [page],
      rootFiles,
      wafProtection: null,
    }),
  };
}

export function mockFetchResult(
  body: string,
  status: number = 200,
  contentType: string = 'text/plain',
): FetchResult {
  return {
    url: '',
    finalUrl: '',
    status,
    body,
    headers: { 'content-type': contentType },
    ttfbMs: 0,
    totalMs: 0,
    contentType,
    contentLength: body.length,
  };
}
