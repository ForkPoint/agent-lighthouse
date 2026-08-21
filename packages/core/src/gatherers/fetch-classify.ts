import type { FetchResult } from '../fetcher';

export type FetchClass = 'ok' | 'soft-404' | 'blocked' | 'missing' | 'error';
export type ExpectedKind = 'text' | 'json' | 'xml' | 'html';

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

const HTML_SIGNATURE = /^\s*(?:<!doctype\s+html|<html[\s>])/i;

function looksLikeHtml(result: FetchResult): boolean {
  return (
    result.contentType.includes('text/html') ||
    HTML_SIGNATURE.test(stripBom(result.body).slice(0, 512))
  );
}

/**
 * Classify a fetched root file honestly. `status === 200` alone is not
 * "the file exists": SPAs and some CDNs return the HTML app shell (200)
 * for any unknown path — a soft 404 that inflated v1 scores.
 */
export function classifyFetch(
  result: FetchResult | undefined,
  expected: ExpectedKind,
): FetchClass {
  if (!result) return 'missing';
  if (result.error) return 'error';
  if (result.status === 404 || result.status === 410) return 'missing';
  if (result.status === 401 || result.status === 403 || result.status === 429) return 'blocked';
  if (result.status >= 500 || result.status === 0) return 'error';
  if (result.status !== 200) return 'missing';

  if (expected === 'html') return 'ok';
  if (expected === 'json') {
    try {
      JSON.parse(stripBom(result.body));
      return 'ok';
    } catch {
      return looksLikeHtml(result) ? 'soft-404' : 'error';
    }
  }
  // text / xml: an HTML document where a machine file should be is a soft 404.
  return looksLikeHtml(result) ? 'soft-404' : 'ok';
}

export function isRealFile(result: FetchResult | undefined, expected: ExpectedKind): boolean {
  return classifyFetch(result, expected) === 'ok';
}
