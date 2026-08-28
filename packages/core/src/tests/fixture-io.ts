import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import type { FetchResult } from '../fetcher';
import type { PageContext } from '../check-context';
import { parseHtml } from '../parser';
import { pageRendersText } from '../scan-evidence';
import { detectWafProtection } from '../waf-detector';

/**
 * What a captured response turned out to be.
 *
 * A fixture named after its host says nothing about what the host answered.
 * A WAF interstitial frozen as `reuters-com` and read as a news article
 * poisons the corpus silently, so the kind is part of the record and is
 * decided from the response, never from what the operator meant to capture.
 */
export type FixtureKind = 'page' | 'wall' | 'shell';

export const FIXTURE_KINDS: readonly FixtureKind[] = ['page', 'wall', 'shell'];

/**
 * Where a fixture came from and when. A fixture is a measurement of a page on
 * a date, and the date is part of the record: a page that changes upstream
 * does not invalidate what the fixture proved on the day it was taken.
 */
export interface FixtureProvenance {
  url: string;
  capturedAt: string;
  sha256: string;
  /** The HTTP status the capture observed. Half of why `kind` is what it is. */
  status: number;
  kind: FixtureKind;
  /**
   * The response headers, verbatim.
   *
   * Dozens of audits read `headers[...]` and `contentType` directly, so a
   * fixture that stored only the body would hand them the harness's defaults
   * and turn every `x-robots-tag`, CORS, caching and security-header verdict
   * into fiction. Headers also decide `kind` for a 2xx bot wall, so without
   * them the suite cannot replay that decision and a regression that
   * reclassified a challenge page as readable would pass unnoticed.
   */
  headers: Record<string, string>;
  contentType: string;
  /** Present only when the capture was redirected. */
  redirectChain?: Array<{ status: number; from: string; to: string }>;
}

const DIR = resolve(__dirname, '../../test-data/corpus/real');

/**
 * The narrowest `PageContext` `pageRendersText` reads. Building one keeps the
 * shell rule the scanner's rule instead of a second copy of the thresholds.
 */
function asPage(result: FetchResult): PageContext {
  return {
    url: result.finalUrl || result.url,
    pageType: 'homepage',
    fetchResult: result,
    $: parseHtml(result.body),
    jsonLd: [],
    meta: {},
    headLinks: [],
  };
}

/**
 * Decide what a captured response is, from the response alone.
 *
 * Walls are settled first: a bot challenge is often 200 with a sentence of
 * text on it, and calling that a shell would file a refusal under "the site
 * renders nothing", which is a claim about the site rather than about who it
 * admits.
 */
export function classifyCapture(result: FetchResult): FixtureKind {
  if (result.status < 200 || result.status >= 300) return 'wall';
  // The fourth argument is how many pages the scan obtained. Zero is the
  // sentinel for "it obtained nothing", and several provider branches widen
  // to match any marker header when they see it — a capture has a 2xx body in
  // hand, so the truthful count is one, and passing zero would call every
  // Akamai-fronted page a wall.
  //
  // Residual: with one, a 200 AkamaiGHost denial body no longer trips the
  // Akamai branch and lands as `shell` instead of `wall`. Both are non-page,
  // so nothing is filed as readable content, and the alternative — a second
  // WAF rule written here — is the copy that this module exists to avoid.
  if (detectWafProtection(result.finalUrl || result.url, result, {}, 1)?.isBlocked) return 'wall';
  return pageRendersText(asPage(result)) ? 'page' : 'shell';
}

export function listFixtures(): string[] {
  if (!existsSync(DIR)) return [];
  return readdirSync(DIR)
    .filter((file) => file.endsWith('.html.gz'))
    .map((file) => file.replace(/\.html\.gz$/, ''))
    .sort();
}

export function readFixture(name: string): { html: string; provenance: FixtureProvenance } {
  const html = gunzipSync(readFileSync(resolve(DIR, `${name}.html.gz`))).toString('utf8');
  const provenance = JSON.parse(
    readFileSync(resolve(DIR, `${name}.json`), 'utf8'),
  ) as FixtureProvenance;
  return { html, provenance };
}
