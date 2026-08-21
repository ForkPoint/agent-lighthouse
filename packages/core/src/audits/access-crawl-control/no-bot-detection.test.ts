import { describe, it, expect } from 'vitest';
import { NoBotDetectionAudit } from './no-bot-detection';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

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
});
