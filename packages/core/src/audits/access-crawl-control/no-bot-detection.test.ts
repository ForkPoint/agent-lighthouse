import { describe, it, expect } from 'vitest';
import { NoBotDetectionAudit } from './no-bot-detection';
import {
  attributableFixture,
  mockCheckContext,
  mockPageContext,
  unreachedSiteContext,
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
  // and this audit has to honour it rather than read the page anyway.
  it('declines when no response can be attributed to this site', async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new NoBotDetectionAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, 'the same input reached is judged').not.toBe('na');

    const unreached = await instance.audit(unreachedSiteContext(pages, rootFiles));
    expect(unreached.status).toBe('na');
  });
});
