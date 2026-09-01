import { describe, it, expect } from 'vitest';
import { defaultConfig } from '../../audit-config';
import { planAudits } from '../../audit-runner';
import { ServerResponsivenessAudit } from './server-responsiveness';
import {
  attributableFixture,
  mockCheckContext,
  mockPageContext,
  shellSiteContext,
  unreachedSiteContext,
  walledSiteContext,
} from '../../__tests__/test-utils';
import type { PageContext } from '../../check-context';

/** A page whose fetch recorded `ttfb` milliseconds to first byte. */
function timedPage(ttfb: number, path = '/'): PageContext {
  const page = mockPageContext(`https://example.com${path}`, '<html><body>ok</body></html>', 1);
  page.fetchResult.ttfbMs = ttfb;
  page.fetchResult.totalMs = ttfb;
  return page;
}

/** A page whose fetch failed: the fetcher reports ttfbMs = the full timeout. */
function failedPage(path = '/down'): PageContext {
  const page = timedPage(10_000, path);
  page.fetchResult.status = 0;
  page.fetchResult.error = 'ECONNRESET';
  return page;
}

const run = (...pages: PageContext[]) =>
  new ServerResponsivenessAudit().audit(mockCheckContext(pages));

describe('ServerResponsivenessAudit', () => {
  describe('when there is nothing to measure', () => {
    it('is not applicable when no pages were scanned', () => {
      expect(run().status).toBe('na');
    });

    it('is not applicable when the scan was blocked by a WAF', () => {
      const ctx = mockCheckContext([timedPage(5000)]);
      ctx.wafProtection = { isBlocked: true, name: 'Cloudflare', reason: 'challenge' };
      const result = new ServerResponsivenessAudit().audit(ctx);
      expect(result.status).toBe('na');
      expect(result.message).toContain('Cloudflare');
    });

    it('is not applicable when every fetch failed', () => {
      const result = run(failedPage('/a'), failedPage('/b'));
      expect(result.status).toBe('na');
    });
  });

  describe('median, not a single sample', () => {
    it('passes when the median is fast even though one page is very slow', () => {
      const result = run(timedPage(120, '/a'), timedPage(140, '/b'), timedPage(5000, '/c'));
      expect(result.status).toBe('pass');
      expect(result.found).toContain('140ms');
    });

    it('does not let a slow average drag a fast median down', () => {
      const result = run(timedPage(100, '/a'), timedPage(100, '/b'), timedPage(9000, '/c'));
      expect(result.status).toBe('pass');
    });

    it('excludes failed fetches from the sample instead of charging them the timeout', () => {
      const result = run(timedPage(150, '/a'), timedPage(160, '/b'), failedPage('/c'));
      expect(result.status).toBe('pass');
      expect(result.found).toContain('1 page(s) could not be measured');
    });

    it('averages the two middle samples on an even count', () => {
      const result = run(timedPage(100, '/a'), timedPage(300, '/b'));
      expect(result.found).toContain('200ms');
    });
  });

  describe('banded verdict', () => {
    it('passes at exactly the fast threshold', () => {
      expect(run(timedPage(800)).status).toBe('pass');
    });

    it('warns just above the fast threshold', () => {
      const result = run(timedPage(801));
      expect(result.status).toBe('warn');
      expect(result.priority).toBe('medium');
    });

    it('warns at exactly the slow threshold', () => {
      expect(run(timedPage(2500)).status).toBe('warn');
    });

    it('fails above the slow threshold', () => {
      const result = run(timedPage(2501));
      expect(result.status).toBe('fail');
      expect(result.priority).toBe('high');
    });

    it('no longer fails on a single page above 1800ms with a fast median', () => {
      const result = run(timedPage(200, '/a'), timedPage(210, '/b'), timedPage(1900, '/c'));
      expect(result.status).toBe('pass');
    });
  });

  it('discloses that the figure includes connection setup from the scanner location', () => {
    const result = run(timedPage(200));
    expect(result.found).toContain('connection setup');
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and the runner has to honour it rather than run this audit anyway.
  it('declines when no response can be attributed to this site', async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new ServerResponsivenessAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, 'the same input reached is judged').not.toBe('na');

    const plan = planAudits(unreachedSiteContext(pages, rootFiles), defaultConfig);
    expect(plan.runnable.map((entry) => entry.reg.meta.id)).not.toContain(
      ServerResponsivenessAudit.meta.id,
    );
    expect(
      plan.skipped.find((stub) => stub.id === ServerResponsivenessAudit.meta.id)?.status,
    ).toBe('na');
  });
  // Ordering: a walled scan gets the reason it could not be measured, which
  // names the wall. A guard above that branch would replace it with the
  // generic attribution message and lose the wall.
  it('names the wall as the reason it could not measure a walled scan', () => {
    const result = new ServerResponsivenessAudit().audit(walledSiteContext());
    expect(result.status).toBe('na');
    expect(result.message).toContain('could not be measured');
    expect(result.message).toContain('Cloudflare');
  });

  // `requires` deliberately omits `rendered-body`: TTFB is measured from the
  // response, and a shell answers as fast or as slow as anything else.
  it('still judges a page that served no readable text', async () => {
    const result = await new ServerResponsivenessAudit().audit(shellSiteContext());
    expect(result.status).not.toBe('na');
  });
});
