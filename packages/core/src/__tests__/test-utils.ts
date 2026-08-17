import {
  parseHtml,
  extractJsonLd,
  extractMetaTags,
  extractHeadLinks,
  detectPageType,
} from '../parser';
import type { CheckContext, PageContext } from '../check-context';
import type { FetchResult } from '../fetcher';

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
    fetch: async () => mockFetchResult('', 404),
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
