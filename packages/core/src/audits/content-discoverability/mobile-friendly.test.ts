import { describe, it, expect } from 'vitest';
import { MobileFriendlyAudit } from './mobile-friendly';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('MobileFriendlyAudit', () => {
  const audit = new MobileFriendlyAudit();

  const withViewport =
    '<html><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body>Hi</body></html>';
  const withoutViewport = '<html><head></head><body>Hi</body></html>';

  it('passes when all pages have a viewport meta tag', () => {
    const ctx = mockCheckContext([mockPageContext('https://example.com/', withViewport)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('have a viewport meta tag');
  });

  it('warns when some pages are missing the viewport meta tag', () => {
    const ctx = mockCheckContext([
      mockPageContext('https://example.com/', withViewport),
      mockPageContext('https://example.com/about', withoutViewport, 1),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('missing viewport');
  });

  it('fails when no pages have a viewport meta tag', () => {
    const ctx = mockCheckContext([mockPageContext('https://example.com/', withoutViewport)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No scanned pages have a viewport');
  });

  it('fails when no pages were scanned', () => {
    const ctx = mockCheckContext([]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No pages scanned');
  });

  it('shows "+N more" suffix when more than 5 pages are missing viewport', () => {
    // 1 page with viewport + 6 without → warn path, length > 5 → "+N more" branch
    const pages = [
      mockPageContext('https://example.com/', withViewport),
      ...Array.from({ length: 6 }, (_, i) =>
        mockPageContext(`https://example.com/page${i + 1}`, withoutViewport, i + 1),
      ),
    ];
    const ctx = mockCheckContext(pages);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.found).toContain('+1 more');
  });
});
