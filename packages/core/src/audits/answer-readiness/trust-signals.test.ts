import { describe, it, expect } from 'vitest';
import { TrustSignalsAudit } from './trust-signals';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('TrustSignalsAudit', () => {
  const audit = new TrustSignalsAudit();

  it('passes with 2+ trust signals in the full body (footer)', () => {
    const page = mockPageContext(
      'https://example.com/',
      `<html><body>
        <main><p>Welcome.</p></main>
        <footer>
          <p>Trusted by 500 companies.</p>
          <p>Read our customer testimonials.</p>
        </footer>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('trust signal(s)');
  });

  it('warns when only 1 trust signal is present', () => {
    const page = mockPageContext(
      'https://example.com/',
      `<html><body><p>We won an award last year.</p></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('Only 1 trust signal');
  });

  it('fails when no trust signals are present', () => {
    const page = mockPageContext(
      'https://example.com/',
      `<html><body><p>Just some plain words here.</p></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No trust signals found');
  });

  it('fails when no pages scanned', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No pages scanned');
  });

  it('passes when a logo grid with 3+ images contributes a trust signal', () => {
    const page = mockPageContext(
      'https://example.com/',
      `<html><body>
        <div class="client-logos">
          <img src="logo1.png" alt="Client A">
          <img src="logo2.png" alt="Client B">
          <img src="logo3.png" alt="Client C">
        </div>
        <p>Trusted by hundreds of companies.</p>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.found).toContain('image grid');
  });
});
