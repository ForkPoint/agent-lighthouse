import { describe, it, expect } from 'vitest';
import { CommerceLinksAudit } from './commerce-links';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('CommerceLinksAudit', () => {
  const audit = new CommerceLinksAudit();

  it('passes when return, shipping, and seller links are all present', () => {
    const html =
      '<html><body><footer>' +
      '<a href="/returns">Return Policy</a>' +
      '<a href="/shipping">Shipping</a>' +
      '<a href="/about">About Us</a>' +
      '</footer></body></html>';
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('Found links for return policy');
  });

  it('warns when only some commerce links are present', () => {
    const html =
      '<html><body><footer>' +
      '<a href="/returns">Returns</a>' +
      '<a href="/shipping">Shipping</a>' +
      '</footer></body></html>';
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('seller');
  });

  it('fails when no commerce links are found', () => {
    const html = '<html><body><a href="/home">Home</a></body></html>';
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('Missing all critical commerce links');
  });

  it('fails when there are no pages', () => {
    const ctx = mockCheckContext([]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No pages for analysis');
  });

  it('handles anchor with empty href (covers || "" fallback branch)', () => {
    // <a href=""> makes attr('href')?.toLowerCase() return '' (falsy) → || '' fires
    const html = '<html><body><a href="">Empty</a><a href="/home">Home</a></body></html>';
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)]);
    const result = audit.audit(ctx);
    // No commerce keywords matched → fail
    expect(result.status).toBe('fail');
    expect(result.message).toContain('Missing all critical commerce links');
  });
});
