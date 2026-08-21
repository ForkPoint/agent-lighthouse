import { describe, it, expect } from 'vitest';
import { CanonicalUrlAudit } from './canonical-url';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

const doc = (head: string) => `<html lang="en"><head>${head}</head><body></body></html>`;

describe('CanonicalUrlAudit', () => {
  const audit = new CanonicalUrlAudit();

  it('passes when canonical is an absolute http(s) URL', () => {
    const ctx = mockCheckContext([
      mockPageContext(
        'https://example.com/page',
        doc('<link rel="canonical" href="https://example.com/page">'),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('https://example.com/page');
  });

  it('warns when canonical is relative', () => {
    const ctx = mockCheckContext([
      mockPageContext('https://example.com/page', doc('<link rel="canonical" href="/page">')),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('not absolute');
  });

  it('fails when no canonical link is present', () => {
    const ctx = mockCheckContext([mockPageContext('https://example.com/page', doc(''))]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No canonical URL');
  });

  it('fails when there are no pages', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe('fail');
  });
});
