import { describe, it, expect } from 'vitest';
import { PrivacyPolicyAudit } from './privacy-policy';
import { mockCheckContext, mockFetchResult, mockPageContext } from '../../__tests__/test-utils';

describe('PrivacyPolicyAudit', () => {
  const audit = new PrivacyPolicyAudit();

  it('passes when a standard privacy path returns 200', () => {
    const ctx = mockCheckContext([], {
      '/privacy-policy/': mockFetchResult('policy', 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('/privacy-policy/');
  });

  it('passes when a privacy policy is linked from a page', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><a href="/legal/privacy-policy.html">Privacy Policy</a></body></html>',
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('linked');
  });

  it('fails when no privacy policy is found', () => {
    const page = mockPageContext('https://example.com', '<html><body><a href="/about">About</a></body></html>');
    const ctx = mockCheckContext([page], {});
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No privacy policy');
  });

  it('skips anchor tags with empty href in link scan', () => {
    // Empty-href anchor should not throw and should not match
    const page = mockPageContext(
      'https://example.com',
      '<html><body><a href="">Click here</a><a href="/about">About</a></body></html>',
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
  });

  it('passes when anchor text is exactly "privacy"', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><a href="/privacy">privacy</a></body></html>',
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('linked');
  });

  it('passes when href matches PRIVACY_HREF pattern but text does not match text patterns', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><a href="/privacy">Learn more</a></body></html>',
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('linked');
  });

  it('stops scanning after first privacy link hit (covers if(hit) early-return)', () => {
    // Two matching anchors: after the first sets hit, the second triggers `if (hit) return`
    const page = mockPageContext(
      'https://example.com',
      '<html><body><a href="/privacy">Privacy Policy</a><a href="/privacy-notice">Privacy Notice</a></body></html>',
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('/privacy');
  });

  it('shows status when privacy path exists with non-200 status', () => {
    const ctx = mockCheckContext([], {
      '/privacy-policy/': mockFetchResult('', 404),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toContain('status 404');
  });
});
