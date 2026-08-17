import { describe, it, expect } from 'vitest';
import { LcpNotLazyAudit } from './lcp-not-lazy';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('LcpNotLazyAudit', () => {
  const audit = new LcpNotLazyAudit();

  it('passes when the first image is not lazy-loaded', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><img src="hero.jpg" fetchpriority="high"></body></html>',
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('not lazy-loaded');
  });

  it('fails when the first image has loading="lazy"', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><img src="hero.jpg" loading="lazy"></body></html>',
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('loading="lazy"');
    expect(result.found).toContain('hero.jpg');
  });

  it('passes when there are no images', () => {
    const page = mockPageContext('https://example.com', '<html><body><p>no images</p></body></html>');
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.found).toContain('No <img> tags found');
  });

  it('warns when no homepage is available', () => {
    const ctx = mockCheckContext([]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('No homepage data');
  });

  it('fails with "(inline)" label when lazy first image has no src', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><img loading="lazy" alt="hero"></body></html>',
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toContain('(inline)');
  });

  it('passes with "(inline)" label when first image has no src and is not lazy', () => {
    const page = mockPageContext(
      'https://example.com',
      '<html><body><img alt="hero"></body></html>',
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.found).toContain('(inline)');
  });
});
