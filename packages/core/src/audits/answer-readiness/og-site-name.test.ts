import { describe, it, expect } from 'vitest';
import { OgSiteNameAudit } from './og-site-name';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

const doc = (head: string) => `<html lang="en"><head>${head}</head><body></body></html>`;

describe('OgSiteNameAudit', () => {
  const audit = new OgSiteNameAudit();

  it('passes when og:site_name is set', () => {
    const ctx = mockCheckContext([
      mockPageContext(
        'https://example.com/',
        doc('<meta property="og:site_name" content="Example Co">'),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('Example Co');
  });

  it('fails when og:site_name is missing', () => {
    const ctx = mockCheckContext([mockPageContext('https://example.com/', doc(''))]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('missing');
  });

  it('fails when there are no pages', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe('fail');
  });
});
