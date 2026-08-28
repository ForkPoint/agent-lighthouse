import { describe, it, expect } from 'vitest';
import { NoBlockingCaptchaAudit } from './no-blocking-captcha';
import {
  attributableFixture,
  mockCheckContext,
  shellSiteContext,
  mockPageContext,
  unreachedSiteContext,
  walledSiteContext,
} from '../../__tests__/test-utils';

describe('NoBlockingCaptchaAudit', () => {
  const audit = new NoBlockingCaptchaAudit();

  it('passes when no blocking CAPTCHA scripts are detected', () => {
    const page = mockPageContext(
      'https://example.com',
      `<html><body>
        <form action="/api/contact" method="POST"><input name="email" /></form>
      </body></html>`,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('No blocking CAPTCHA');
  });

  it('warns when reCAPTCHA is detected', () => {
    const page = mockPageContext(
      'https://example.com',
      `<html><body>
        <script src="https://www.google.com/recaptcha/api.js"></script>
        <form action="/contact" method="POST"><input name="email" /></form>
      </body></html>`,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('recaptcha');
  });

  it('warns when Cloudflare Turnstile is detected', () => {
    const page = mockPageContext(
      'https://example.com',
      `<html><body>
        <script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>
      </body></html>`,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('turnstile');
  });
});

describe('NoBlockingCaptchaAudit — the wall the scanner met', () => {
  const audit = new NoBlockingCaptchaAudit();

  it('reports the bot wall instead of passing the site that refused the scan', () => {
    const ctx = {
      ...mockCheckContext([]),
      wafProtection: {
        isBlocked: true,
        provider: 'cloudflare' as const,
        name: 'Cloudflare',
        reason: 'HTTP 403 with cf-ray',
        statusCode: 403,
      },
    };
    const result = audit.audit(ctx);

    expect(result.status).toBe('fail');
    expect(result.message).toContain('bot wall');
    expect(result.message).toContain('Cloudflare');
  });

  it('stays quiet about a rate limit, which is the scan asking too fast', () => {
    const ctx = {
      ...mockCheckContext([]),
      wafProtection: {
        isBlocked: true,
        provider: 'rate-limited' as const,
        name: 'Rate limit (HTTP 429)',
        reason: 'HTTP 429',
        statusCode: 429,
        isRateLimit: true,
      },
    };
    expect(audit.audit(ctx).status).toBe('na');
  });

  it('is notApplicable when no page was fetched', () => {
    expect(audit.audit(mockCheckContext([])).status).toBe('na');
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and this audit has to honour it rather than read the page anyway.
  it('declines when no response can be attributed to this site', async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new NoBlockingCaptchaAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, 'the same input reached is judged').not.toBe('na');

    const unreached = await instance.audit(unreachedSiteContext(pages, rootFiles));
    expect(unreached.status).toBe('na');
  });
  // Ordering: the wall is this audit's subject. A guard above the wall branch
  // returns `na` and re-ships the defect this audit was written to fix.
  it('reports the wall on a walled scan, not a shrug', () => {
    const result = new NoBlockingCaptchaAudit().audit(walledSiteContext());
    expect(result.status).toBe('fail');
    expect(result.message).toContain('bot wall');
    expect(result.message).toContain('Cloudflare');
  });

  // The weight-1.0 vacuous pass this audit shipped. The detection is a
  // substring search over the served HTML; a shell renders its forms — and
  // whatever guards them — from a bundle this search cannot read. `requires`
  // is empty so the gate does not decline this, and the audit has to.
  it('declines a page that served no readable text', () => {
    const result = new NoBlockingCaptchaAudit().audit(shellSiteContext());
    expect(result.status).toBe('na');
    expect(result.message).toContain('no readable text');
  });

  // Ordering: the guard sits below the detection branch, so a CAPTCHA a shell
  // does serve statically is still reported.
  it('still reports a CAPTCHA a shell serves statically', () => {
    const html =
      '<html lang="en"><head><title>Shop</title>' +
      '<script src="https://www.google.com/recaptcha/api.js"></script></head>' +
      '<body><div id="root"></div></body></html>';
    const result = new NoBlockingCaptchaAudit().audit(shellSiteContext(html));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('recaptcha');
  });

});
