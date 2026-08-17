import { describe, it, expect } from 'vitest';
import { CanonicalLinksAudit } from './canonical-links';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('CanonicalLinksAudit', () => {
  const audit = new CanonicalLinksAudit();

  it('passes when all pages have a canonical link', () => {
    const ctx = mockCheckContext([
      mockPageContext(
        'https://example.com/',
        '<html><head><link rel="canonical" href="https://example.com/" /></head><body>Home</body></html>',
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('have canonical link tags');
  });

  it('warns when some pages are missing canonical links', () => {
    const ctx = mockCheckContext([
      mockPageContext(
        'https://example.com/',
        '<html><head><link rel="canonical" href="https://example.com/" /></head><body>Home</body></html>',
      ),
      mockPageContext('https://example.com/about', '<html><head></head><body>About</body></html>', 1),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('missing canonical');
  });

  it('fails when no pages have canonical links', () => {
    const ctx = mockCheckContext([
      mockPageContext('https://example.com/', '<html><head></head><body>Home</body></html>'),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No scanned pages have canonical');
  });

  it('fails when no pages were scanned', () => {
    const ctx = mockCheckContext([]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No pages scanned');
  });

  it('warns with +more suffix when more than 5 pages are missing canonical links', () => {
    // 6 pages without canonical + 1 with → warn path, length > 5 → "+N more" branch
    const withCanonical = mockPageContext(
      'https://example.com/',
      '<html><head><link rel="canonical" href="https://example.com/" /></head><body>Home</body></html>',
    );
    const withoutCanonical = (i: number) =>
      mockPageContext(
        `https://example.com/page${i}`,
        '<html><head></head><body>Page</body></html>',
        i,
      );
    const ctx = mockCheckContext([
      withCanonical,
      withoutCanonical(1),
      withoutCanonical(2),
      withoutCanonical(3),
      withoutCanonical(4),
      withoutCanonical(5),
      withoutCanonical(6),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.found).toContain('+1 more');
  });
});
