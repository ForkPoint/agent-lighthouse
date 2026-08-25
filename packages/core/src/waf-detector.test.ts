import { describe, it, expect } from 'vitest';
import { detectWafProtection } from './waf-detector';
import type { FetchResult } from './fetcher';

/**
 * Bot-wall detection.
 *
 * The verdict changes what a report says about a store outright: a blocked
 * scan reports a bot wall rather than a low score, so a false positive tells
 * an operator their storefront is closed to agents when it is not. Every
 * provider branch is asserted, including the two that need a zero-page scan.
 */

const URL = 'https://shop.test';

function result(over: Partial<FetchResult> = {}): FetchResult {
  return {
    url: URL,
    finalUrl: URL,
    status: 200,
    headers: {},
    body: '',
    ttfbMs: 0,
    totalMs: 0,
    contentType: 'text/html',
    contentLength: 0,
    ...over,
  };
}

/** Detect against a single homepage response, with pages scanned. */
function onHomepage(over: Partial<FetchResult>, pages = 3) {
  return detectWafProtection(URL, result(over), {}, pages);
}

describe('detectWafProtection', () => {
  it('returns null for an ordinary 200 with no bot-wall markers', () => {
    expect(onHomepage({ body: '<html><body>Shop</body></html>' })).toBeNull();
  });

  it('returns null when there is no homepage result at all', () => {
    expect(detectWafProtection(URL, null, {}, 3)).toBeNull();
  });

  describe('Cloudflare', () => {
    it('detects the cf-mitigated challenge header', () => {
      const waf = onHomepage({ headers: { 'cf-mitigated': 'challenge' } });
      expect(waf).toMatchObject({ isBlocked: true, provider: 'cloudflare' });
    });

    it('detects a cf-ray on a 403', () => {
      expect(onHomepage({ headers: { 'cf-ray': 'abc' }, status: 403 })?.provider).toBe('cloudflare');
    });

    it('detects a 429 behind the cloudflare server header', () => {
      expect(onHomepage({ headers: { server: 'cloudflare' }, status: 429 })?.provider).toBe(
        'cloudflare',
      );
    });

    it('detects the interstitial body on a 200', () => {
      const waf = onHomepage({
        headers: { server: 'cloudflare' },
        body: '<title>Just a moment...</title>',
      });
      expect(waf?.provider).toBe('cloudflare');
    });

    // Cloudflare fronts a large share of the web; serving through it is not
    // itself a block, and calling it one would mislabel most storefronts.
    it('does not flag a plain 200 served through cloudflare', () => {
      expect(onHomepage({ headers: { 'cf-ray': 'abc', server: 'cloudflare' }, status: 200 })).toBeNull();
    });

    it('names the status code in the reason for a 403', () => {
      expect(onHomepage({ headers: { 'cf-ray': 'abc' }, status: 403 })?.reason).toContain('403');
    });
  });

  describe('other providers', () => {
    it.each([
      ['datadome', { headers: { 'x-datadome': 'protected' } }],
      ['datadome', { body: 'protected by datadome' }],
      ['perimeterx', { headers: { 'x-px-block': '1' } }],
      ['perimeterx', { body: '<script src="//client.perimeterx.net/x.js">' }],
      ['perimeterx', { body: 'Press & Hold to confirm you are human' }],
      ['imperva', { headers: { 'x-iinfo': '1-2-3' } }],
      ['imperva', { headers: { 'x-cdn': 'Incapsula' } }],
      ['imperva', { body: 'Request unsuccessful. Incapsula incident ID 1-2' }],
      ['kasada', { headers: { 'x-kpsdk-ct': 'abc' } }],
      ['kasada', { body: 'k-challenge' }],
    ])('detects %s', (provider, over) => {
      expect(onHomepage(over as Partial<FetchResult>)?.provider).toBe(provider);
    });
  });

  describe('Akamai', () => {
    it('detects a 403 access-denied page', () => {
      const waf = onHomepage({ status: 403, body: 'Access Denied' });
      expect(waf).toMatchObject({ provider: 'akamai', isBlocked: true });
      expect(waf?.reason).toContain('403');
    });

    it('detects the AkamaiGHost server header when nothing was scanned', () => {
      expect(onHomepage({ headers: { server: 'AkamaiGHost' } }, 0)?.provider).toBe('akamai');
    });

    // The markers alone are not a block: Akamai serves plenty of open sites,
    // and the scan reached their pages.
    it('does not flag Akamai markers on a 200 whose pages were scanned', () => {
      expect(onHomepage({ headers: { 'x-akamai-transformed': '9' }, status: 200 }, 3)).toBeNull();
    });
  });

  describe('a scan that reached no pages', () => {
    it('reports a generic WAF on a 403', () => {
      const waf = onHomepage({ status: 403 }, 0);
      expect(waf).toMatchObject({ provider: 'generic-waf', statusCode: 403 });
    });

    it('reports a generic WAF on a 429', () => {
      expect(onHomepage({ status: 429 }, 0)?.provider).toBe('generic-waf');
    });

    it('reports a dropped connection on status 0', () => {
      expect(onHomepage({ status: 0 }, 0)?.provider).toBe('connection-drop');
    });

    it.each(['timeout', 'The operation was aborted', 'ECONNRESET'])(
      'reports a dropped connection for the error %p',
      (error) => {
        expect(onHomepage({ status: 200, error }, 0)?.provider).toBe('connection-drop');
      },
    );

    it('returns null for an ordinary 404 with no other marker', () => {
      expect(onHomepage({ status: 404 }, 0)).toBeNull();
    });
  });

  describe('root files', () => {
    it('detects a wall on a root file when the homepage looks clean', () => {
      const waf = detectWafProtection(
        URL,
        result({ body: '<html>Shop</html>' }),
        { '/robots.txt': result({ headers: { 'x-datadome': 'protected' } }) },
        3,
      );
      expect(waf?.provider).toBe('datadome');
    });

    it('returns null when neither the homepage nor a root file is walled', () => {
      expect(
        detectWafProtection(URL, result({ body: 'Shop' }), { '/robots.txt': result() }, 3),
      ).toBeNull();
    });
  });

  it('always names the wall, so a report never prints "undefined"', () => {
    const waf = onHomepage({ headers: { 'cf-mitigated': 'challenge' } });
    expect(waf?.name).toBeTruthy();
    expect(waf?.reason).toBeTruthy();
  });
});
