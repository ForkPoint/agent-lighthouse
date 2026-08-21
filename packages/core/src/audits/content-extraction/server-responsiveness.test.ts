import { describe, it, expect } from 'vitest';
import { FastPageLoadAudit } from './server-responsiveness';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('FastPageLoadAudit', () => {
  const audit = new FastPageLoadAudit();

  function pageWithTtfb(url: string, ttfb: number, index = 0) {
    const page = mockPageContext(url, '<html><body>Hi</body></html>', index);
    page.fetchResult.ttfbMs = ttfb;
    return page;
  }

  it('passes when average TTFB is fast', () => {
    const ctx = mockCheckContext([pageWithTtfb('https://example.com/', 200)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('Average TTFB');
  });

  it('warns when average TTFB is above the fast threshold but no page is very slow', () => {
    const ctx = mockCheckContext([pageWithTtfb('https://example.com/', 1000)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('Average TTFB is 1000ms');
  });

  it('fails when a page has a very slow TTFB', () => {
    const ctx = mockCheckContext([pageWithTtfb('https://example.com/', 2000)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('TTFB > 1800ms');
  });

  it('fails when no pages were scanned', () => {
    const ctx = mockCheckContext([]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No pages scanned');
  });

  it('shows "+N more" suffix when more than 5 pages are very slow', () => {
    // 6 pages with TTFB > 1800ms → fail path, slowPages.length > 5 → "+N more" branch
    const slowPages = Array.from({ length: 6 }, (_, i) =>
      pageWithTtfb(`https://example.com/page${i}`, 2000, i),
    );
    const ctx = mockCheckContext(slowPages);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toContain('+1 more');
  });
});
