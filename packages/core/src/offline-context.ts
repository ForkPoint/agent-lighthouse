import type { CheckContext, PageContext } from "./check-context";
import type { FetchOptions, FetchResult } from "./fetcher";
import { parsePageContext } from "./page-context";
import { buildScanEvidence } from "./scan-evidence";
import type { PageType } from "./types";
import { detectWafProtection } from "./waf-detector";

export interface OfflineContextOptions {
  /** The page type to declare instead of classifying the page. */
  pageType?: PageType;
  /** Root files the caller has, by path, such as `/robots.txt`. */
  rootFiles?: Record<string, FetchResult>;
  /**
   * Answers the requests audits make. Omitted, every request fails at once
   * with status 0, as an unsent request does: the context holds only what
   * the caller gave it.
   */
  fetch?: (options: FetchOptions) => Promise<FetchResult>;
}

/**
 * A check context for one page the caller already has, such as a stored
 * capture, built the way a scan builds one: the page parsed and classified,
 * bot walls detected, and the scan evidence derived from the response. It
 * sends no request unless the caller supplies `fetch`.
 *
 * A page whose response is not a readable HTTP 200 is left out of `pages`,
 * as a scan leaves it out; the evidence then says why.
 */
export function buildOfflineContext(
  result: FetchResult,
  options: OfflineContextOptions = {},
): CheckContext {
  const parsed = new URL(result.url);
  const rootFiles = options.rootFiles ?? {};
  const pages: PageContext[] =
    result.status === 200 && result.body
      ? [
          {
            ...parsePageContext(result.url, result.body, options.pageType),
            fetchResult: result,
          },
        ]
      : [];
  const wafProtection = detectWafProtection(
    result.url,
    result,
    rootFiles,
    pages.length,
  );
  const evidence = buildScanEvidence({
    requestedUrl: result.url,
    homepageResult: result,
    pages,
    rootFiles,
    wafProtection,
  });
  return {
    targetUrl: result.url,
    rootFiles,
    pages,
    domain: parsed.hostname,
    baseUrl: parsed.origin,
    fetch:
      options.fetch ??
      (async (request) => ({
        url: request.url,
        finalUrl: request.url,
        status: 0,
        headers: {},
        body: "",
        ttfbMs: 0,
        totalMs: 0,
        contentType: "",
        contentLength: 0,
        error: "offline context: no request sent",
      })),
    ...(wafProtection != null && { wafProtection }),
    evidence,
  };
}
