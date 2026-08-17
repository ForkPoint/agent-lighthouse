import { describe, it, expect } from 'vitest';
import { NoBlockingCaptchaAudit } from './no-blocking-captcha';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

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
