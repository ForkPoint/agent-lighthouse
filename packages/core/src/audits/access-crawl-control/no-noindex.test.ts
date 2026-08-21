import { describe, it, expect } from 'vitest';
import { NoNoindexAudit } from './no-noindex';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('NoNoindexAudit', () => {
  const audit = new NoNoindexAudit();

  it('passes when the homepage has no noindex directive', () => {
    const html = '<html><head><meta name="robots" content="index, follow" /></head><body>Home</body></html>';
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('no noindex directive');
  });

  it('fails when the homepage has a noindex meta tag', () => {
    const html = '<html><head><meta name="robots" content="noindex, follow" /></head><body>Home</body></html>';
    const ctx = mockCheckContext([mockPageContext('https://example.com/', html)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('noindex directive');
  });

  it('fails when no pages were scanned', () => {
    const ctx = mockCheckContext([]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No pages scanned');
  });

  it('fails when the homepage has noindex via X-Robots-Tag header only', () => {
    // hasHeaderNoindex=true, hasMetaNoindex=false → if (hasHeaderNoindex) branch on line 53 is true
    const html = '<html><head></head><body>Home</body></html>';
    const page = mockPageContext('https://example.com/', html);
    page.fetchResult.headers['x-robots-tag'] = 'noindex';
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toContain('X-Robots-Tag');
  });
});
