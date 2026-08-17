import { describe, it, expect } from 'vitest';
import { TermsOfServiceAudit } from './terms-of-service';
import { mockCheckContext, mockFetchResult, mockPageContext } from '../../__tests__/test-utils';

describe('TermsOfServiceAudit', () => {
  const audit = new TermsOfServiceAudit();

  it('passes when /terms/ returns 200', () => {
    const ctx = mockCheckContext([], {
      '/terms/': mockFetchResult('terms', 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('/terms/');
  });

  it('passes when terms are linked from a page', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><a href="/legal/terms-and-conditions.html">Terms &amp; Conditions</a></body></html>',
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('linked');
  });

  it('fails when no terms page is found', () => {
    const page = mockPageContext('https://example.com', '<html><body><a href="/about">About</a></body></html>');
    const ctx = mockCheckContext([page], {});
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No terms of service');
  });

  it('skips anchor tags with empty href in link scan', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><a href="">Click here</a><a href="/about">About</a></body></html>',
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
  });

  it('passes when anchor text is exactly "terms"', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><a href="/terms">terms</a></body></html>',
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('linked');
  });

  it('passes when href matches TERMS_HREF pattern but text does not match text patterns', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><a href="/terms">Learn more</a></body></html>',
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('linked');
  });

  it('stops scanning after first terms link hit (covers if(hit) early-return)', () => {
    // Two matching anchors: after the first sets hit, the second triggers `if (hit) return`
    const page = mockPageContext(
      'https://example.com',
      '<html><body><a href="/terms">Terms of Service</a><a href="/tos">ToS</a></body></html>',
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('/terms');
  });

  it('shows status when terms path exists with non-200 status', () => {
    const ctx = mockCheckContext([], {
      '/terms/': mockFetchResult('', 404),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toContain('Status 404');
  });
});
