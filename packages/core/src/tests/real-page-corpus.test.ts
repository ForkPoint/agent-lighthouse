import { describe, it, expect } from 'vitest';
import { defaultConfig } from '../audit-config';
import { mockCheckContext } from '../__tests__/test-utils';
import type { CheckContext, PageContext } from '../check-context';
import type { FetchResult } from '../fetcher';
import {
  parseHtml,
  extractJsonLd,
  extractMetaTags,
  extractHeadLinks,
  detectPageType,
} from '../parser';
import { detectWafProtection } from '../waf-detector';
import { listFixtures, readFixture, type FixtureProvenance } from './fixture-io';

/**
 * Every registered audit, run against real pages, with its verdict snapshotted.
 *
 * The suite's blind spot is that audits are tested against HTML the audit
 * author wrote, which always has one clean `<main>` holding text. Real pages
 * ship empty ones, several of them, and bodies holding a single word.
 * `getMainContentText` read the first `<main>` and failed two live storefronts
 * at critical priority; no hand-written fixture could show that.
 *
 * A change here is not a failure. It is a diff to read: an audit change that
 * silently flips a verdict on a real page arrives as a review item instead of
 * shipping.
 *
 * Walls and shells are snapshotted alongside pages. A degenerate response is
 * where a vacuous `pass` comes from, so leaving those fixtures out would hide
 * exactly the class of claim this baseline exists to expose.
 *
 * Two fixtures read oddly on purpose, and `docs/evidence/corpus.md` says why:
 * `tirerack-com-soft-block-200` is an Akamai soft block classified as a page,
 * and `vercel-com-wall-200` is `text/markdown` parsed as HTML.
 */

const registrations = Object.values(defaultConfig.audits).flat();
const fixtures = listFixtures();

/**
 * The response as the site served it, not as a harness would synthesise it.
 *
 * `mockPageContext` builds a 200 `text/html` `FetchResult` with zero timings.
 * Dozens of audits read `headers[...]`, `contentType` and `ttfbMs` straight
 * off the response, so replaying a fixture through the mock would snapshot
 * the harness's defaults — every `x-robots-tag`, CORS, caching, compression
 * and TTFB verdict taken on a header the site never sent. The provenance
 * record carries the real ones, so use them.
 */
function fixtureFetchResult(html: string, provenance: FixtureProvenance): FetchResult {
  return {
    // The first hop is what was requested; `provenance.url` is where it landed.
    url: provenance.redirectChain?.[0]?.from ?? provenance.url,
    finalUrl: provenance.url,
    status: provenance.status,
    headers: provenance.headers,
    body: html,
    ttfbMs: provenance.ttfbMs,
    totalMs: provenance.totalMs,
    contentType: provenance.contentType,
    contentLength: provenance.contentLength,
    ...(provenance.redirectChain ? { redirectChain: provenance.redirectChain } : {}),
  };
}

function fixturePageContext(html: string, provenance: FixtureProvenance): PageContext {
  const $ = parseHtml(html);
  const jsonLd = extractJsonLd($);
  const meta = extractMetaTags($);
  return {
    url: provenance.url,
    // `true` marks it the first page of the scan, which is how a homepage is
    // told from an interior page. Each fixture is a one-page scan.
    pageType: detectPageType(provenance.url, $, jsonLd, meta, true),
    fetchResult: fixtureFetchResult(html, provenance),
    $,
    jsonLd,
    meta,
    headLinks: extractHeadLinks($),
  };
}

/**
 * The context an audit sees for one fixture.
 *
 * `domain` and `baseUrl` come from the fixture's own URL. Left at the mock's
 * `example.com`, every same-origin link on a real page counts as third-party
 * and the link, resource and boundary audits report on a site that does not
 * exist.
 *
 * `wafProtection` is derived from the stored response, the same call the
 * orchestrator makes. It is input, not gating: `no-bot-detection` and
 * `no-blocking-captcha` read nothing else, so leaving it undefined would have
 * them report "no bot defense" for the two storefronts that answered 403.
 *
 * The evidence gate, by contrast, is held open (`mockCheckContext` grants
 * every requirement). That is deliberate: a verdict here is the audit's own
 * claim about the bytes, with nothing upstream excusing it. Production skips
 * an audit whose `requires` a degenerate response denies, so a verdict here
 * on a wall or a shell is what the audit would say if it were asked.
 */
function fixtureContext(html: string, provenance: FixtureProvenance): CheckContext {
  const page = fixturePageContext(html, provenance);
  const parsed = new URL(provenance.url);
  // One page was obtained — the fixture is it. Passing zero would widen the
  // detector's marker-header branches and call every Akamai-fronted page a
  // wall; `fixture-io.ts` carries the same note.
  const waf = detectWafProtection(provenance.url, page.fetchResult, {}, 1);
  return {
    ...mockCheckContext([page]),
    domain: parsed.hostname,
    baseUrl: parsed.origin,
    ...(waf ? { wafProtection: waf } : {}),
  };
}

describe('real-page corpus', () => {
  it('has fixtures and audits to run', () => {
    expect(fixtures.length).toBeGreaterThan(0);
    expect(registrations.length).toBeGreaterThan(200);
  });

  for (const name of fixtures) {
    it(`${name}: verdicts hold`, async () => {
      const { html, provenance } = readFixture(name);
      const ctx = fixtureContext(html, provenance);

      const verdicts: Record<string, string> = {};
      for (const registration of registrations) {
        try {
          const result = await registration.create().audit(ctx);
          verdicts[registration.meta.id] = result.status;
        } catch (err) {
          // A throw is a verdict too: the runner stubs it as `scan-error`, so
          // record it rather than failing the whole page.
          verdicts[registration.meta.id] = `THREW: ${String(err).slice(0, 80)}`;
        }
      }

      expect(verdicts).toMatchSnapshot();

      // The snapshot records a throw so a reader can see which audit died on
      // which page, but a throw is never an acceptable resting state: the
      // runner turns it into a `scan-error` stub and the site is told nothing.
      // Asserted after the snapshot so the failing run still writes the
      // evidence. A fixture added later cannot bring a silent one with it.
      const threw = Object.entries(verdicts).filter(([, status]) => status.startsWith('THREW'));
      expect(threw, `audits threw on ${name} instead of reaching a verdict`).toEqual([]);
    });
  }
});
