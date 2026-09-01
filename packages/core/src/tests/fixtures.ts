import type { CheckContext } from "../check-context";
import type { FetchOptions, FetchResult } from "../fetcher";
import { buildScanEvidence } from "../scan-evidence";
import { mockPageContext } from "../__tests__/test-utils";

const BASE_URL = "https://example.test";

/** A response that never arrived. */
const unreachable: FetchResult = {
  url: `${BASE_URL}/`,
  finalUrl: `${BASE_URL}/`,
  status: 0,
  headers: {},
  body: "",
  ttfbMs: 0,
  totalMs: 0,
  contentType: "",
  contentLength: 0,
  error: "ENOTFOUND",
};

/** Any URL an audit asks for, answered 404. Never a network call. */
const notFound = (options: FetchOptions): Promise<FetchResult> =>
  Promise.resolve({
    ...unreachable,
    url: options.url,
    finalUrl: options.url,
    status: 404,
    error: undefined,
  });

/**
 * Fixture A: the origin never answered.
 *
 * Built through the real `buildScanEvidence` rather than `allEvidenceMet()`,
 * which is the whole point. The fixture this replaces asserted that every
 * class of evidence had been obtained while supplying nothing, so an audit
 * could be tested against a scan that had read four page types it never
 * fetched. No verdict about this site can be correct, and the contract test in
 * `unreachable-contract.test.ts` holds the whole registry to that.
 */
export function unreachableContext(
  overrides: Partial<CheckContext> = {},
): CheckContext {
  return {
    rootFiles: {},
    pages: [],
    domain: "example.test",
    baseUrl: BASE_URL,
    fetch: notFound,
    evidence: buildScanEvidence({
      requestedUrl: `${BASE_URL}/`,
      homepageResult: unreachable,
      pages: [],
      rootFiles: {},
      wafProtection: null,
    }),
    ...overrides,
  };
}

/**
 * A real page that adopted nothing: valid HTML, a language, one `h1`, enough
 * prose to clear `pageRendersText`, and not one optional convention.
 */
export const BARE_SITE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Sunrise Bakery</title>
  </head>
  <body>
    <h1>Sunrise Bakery</h1>
    <p>${"We bake bread every morning in a small shop on Mill Street. ".repeat(12)}</p>
  </body>
</html>`;

/**
 * Fixture B: a site that is entirely reachable and has done nothing wrong.
 *
 * The counterpart to fixture A, and the one that catches the opposite mistake:
 * an audit that fails a bakery for not being an API. Its verdicts are recorded
 * as a snapshot rather than asserted, because unlike fixture A there is no
 * single right answer — a page with no `<main>` really is harder to extract
 * from. What the snapshot buys is that no change to it can pass unexplained.
 */
export function bareSiteContext(
  overrides: Partial<CheckContext> = {},
): CheckContext {
  const page = mockPageContext(`${BASE_URL}/`, BARE_SITE_HTML, 0);
  return {
    rootFiles: {},
    pages: [page],
    domain: "example.test",
    baseUrl: BASE_URL,
    fetch: notFound,
    evidence: buildScanEvidence({
      requestedUrl: `${BASE_URL}/`,
      homepageResult: { ...page.fetchResult, contentType: "text/html" },
      pages: [page],
      rootFiles: {},
      wafProtection: null,
    }),
    ...overrides,
  };
}
