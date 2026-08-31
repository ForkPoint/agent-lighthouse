import { describe, it, expect } from 'vitest';
import { defaultConfig } from '../../audit-config';
import { planAudits } from '../../audit-runner';
import { NoBotDetectionAudit } from './no-bot-detection';
import {
  attributableFixture,
  mockCheckContext,
  shellSiteContext,
  mockPageContext,
  unreachedSiteContext,
  walledSiteContext,
} from '../../__tests__/test-utils';

describe('NoBotDetectionAudit', () => {
  const audit = new NoBotDetectionAudit();

  it('passes when no bot-detection scripts are present', () => {
    const pages = [
      mockPageContext('https://example.com/', '<html><head></head><body>Welcome</body></html>'),
    ];
    const ctx = mockCheckContext(pages);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('No aggressive bot-detection');
  });

  it('warns when a bot-detection script (reCAPTCHA) is detected', () => {
    const pages = [
      mockPageContext(
        'https://example.com/',
        '<html><head><script src="https://www.google.com/recaptcha/api.js"></script></head><body>Hi</body></html>',
      ),
    ];
    const ctx = mockCheckContext(pages);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('Bot-detection scripts detected');
    expect(result.found).toContain('reCAPTCHA');
  });

  it('warns when a Cloudflare Turnstile script is detected', () => {
    const pages = [
      mockPageContext(
        'https://example.com/',
        '<html><head><script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script></head><body>Hi</body></html>',
      ),
    ];
    const ctx = mockCheckContext(pages);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.found).toContain('Cloudflare Turnstile');
  });

  it('warns when no pages were scanned', () => {
    const ctx = mockCheckContext([]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('No pages were scanned');
  });

  it('aggregates a bot-detection service detected across multiple pages', () => {
    // When the same service (reCAPTCHA) appears on two pages, the second hit must
    // reuse the existing map entry (exercising the false branch of
    // `if (!detectedServices.has(serviceName))`).
    const pages = [
      mockPageContext(
        'https://example.com/',
        '<html><head><script src="https://www.google.com/recaptcha/api.js"></script></head><body></body></html>',
      ),
      mockPageContext(
        'https://example.com/contact',
        '<html><head><script src="https://www.google.com/recaptcha/api.js"></script></head><body></body></html>',
      ),
    ];
    const ctx = mockCheckContext(pages);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('reCAPTCHA');
    expect(result.message).toContain('2 page(s)');
  });

  describe('when the scan hit a wall', () => {
    it('fails on a genuine bot defense and names it', () => {
      const ctx = mockCheckContext([mockPageContext('https://example.com/', '<html><body></body></html>')]);
      ctx.wafProtection = {
        isBlocked: true,
        provider: 'cloudflare',
        name: 'Cloudflare Turnstile / Managed Challenge',
        reason: 'Cloudflare bot challenge detected',
      };
      const result = audit.audit(ctx);
      expect(result.status).toBe('fail');
      expect(result.message).toContain('Cloudflare');
    });

    // HTTP 429 says "too many requests" — a statement about this scan's rate,
    // not about who the site admits. Failing on it told storefronts that serve
    // GPTBot perfectly well that their firewall blocks AI crawlers.
    it('is notApplicable when the scan was rate-limited', () => {
      const ctx = mockCheckContext([mockPageContext('https://example.com/', '<html><body></body></html>')]);
      ctx.wafProtection = {
        isBlocked: true,
        isRateLimit: true,
        provider: 'rate-limited',
        name: 'Rate limit (HTTP 429)',
        reason: 'too many requests',
        statusCode: 429,
      };
      const result = audit.audit(ctx);
      expect(result.status).toBe('na');
      expect(result.message).toMatch(/rate-limited/i);
    });
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and the runner has to honour it rather than run this audit anyway.
  it('declines when no response can be attributed to this site', async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new NoBotDetectionAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, 'the same input reached is judged').not.toBe('na');

    const plan = planAudits(unreachedSiteContext(pages, rootFiles), defaultConfig);
    expect(plan.runnable.map((entry) => entry.reg.meta.id)).not.toContain(
      NoBotDetectionAudit.meta.id,
    );
    expect(plan.skipped.find((stub) => stub.id === NoBotDetectionAudit.meta.id)?.status).toBe('na');
  });
  // Ordering, not just behaviour: the wall is this audit's subject, so the
  // attribution guard must sit BELOW the `isBlocked` branch. A guard above it
  // returns `na` here and the critical, weight-1.0 finding disappears from a
  // walled scan — the most common hostile scan there is.
  it('reports the firewall on a walled scan, not a shrug', () => {
    const result = new NoBotDetectionAudit().audit(walledSiteContext());
    expect(result.status).toBe('fail');
    expect(result.message).toContain('Bot-defense firewall detected');
    expect(result.message).toContain('Cloudflare');
  });

  // The weight-1.0 vacuous pass this audit shipped. The detection is a
  // substring search over the served HTML, and a shell serves a mount point
  // and a bundle: the Turnstile loader is inside the bundle, where the search
  // cannot reach it. `requires` is empty so the gate does not decline this —
  // the audit has to.
  it('declines a page that served no readable text', () => {
    const result = new NoBotDetectionAudit().audit(shellSiteContext());
    expect(result.status).toBe('na');
    expect(result.message).toContain('no readable text');
  });

  // Ordering again: the guard sits below the detection branches, so a shell
  // that ships a challenge loader in its static HTML is still reported.
  it('still reports a loader a shell serves statically', () => {
    const html =
      '<html lang="en"><head><title>Shop</title>' +
      '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script></head>' +
      '<body><div id="root"></div></body></html>';
    const result = new NoBotDetectionAudit().audit(shellSiteContext(html));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('Cloudflare Turnstile');
  });

});
