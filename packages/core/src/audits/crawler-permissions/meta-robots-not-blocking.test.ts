import { describe, it, expect } from 'vitest';
import { MetaRobotsNotBlockingAudit } from './meta-robots-not-blocking';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('MetaRobotsNotBlockingAudit', () => {
  const audit = new MetaRobotsNotBlockingAudit();

  it('passes when no scanned page has a noindex meta robots tag', () => {
    const pages = [
      mockPageContext('https://example.com/', '<html><head><meta name="robots" content="index, follow"></head><body>Hi</body></html>'),
      mockPageContext('https://example.com/about', '<html><head></head><body>About</body></html>', 1),
    ];
    const ctx = mockCheckContext(pages);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('No scanned pages have');
    expect(result.found).toContain('none have noindex');
  });

  it('fails when a page has <meta name="robots" content="noindex">', () => {
    const pages = [
      mockPageContext('https://example.com/secret', '<html><head><meta name="robots" content="noindex, nofollow"></head><body>Secret</body></html>'),
    ];
    const ctx = mockCheckContext(pages);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('noindex');
    expect(result.found).toContain('https://example.com/secret');
  });

  it('warns when no pages were scanned', () => {
    const ctx = mockCheckContext([]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('No pages were scanned');
  });
});
