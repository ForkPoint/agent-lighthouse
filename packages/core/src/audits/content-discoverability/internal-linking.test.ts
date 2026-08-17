import { describe, it, expect } from 'vitest';
import { InternalLinkingAudit } from './internal-linking';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('InternalLinkingAudit', () => {
  const audit = new InternalLinkingAudit();

  const withLinks = '<html><body><a href="/a">A</a><a href="/b">B</a></body></html>';
  const noLinks = '<html><body><a href="https://other.com/x">External</a></body></html>';

  it('passes when all pages have internal links', () => {
    const ctx = mockCheckContext([mockPageContext('https://example.com/', withLinks)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('have internal links');
  });

  it('warns when some pages lack internal links', () => {
    const ctx = mockCheckContext([
      mockPageContext('https://example.com/', withLinks),
      mockPageContext('https://example.com/orphan', noLinks, 1),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('no internal links');
  });

  it('fails when no pages have internal links', () => {
    const ctx = mockCheckContext([mockPageContext('https://example.com/', noLinks)]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No scanned pages have internal links');
  });

  it('fails when no pages were scanned', () => {
    const ctx = mockCheckContext([]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No pages scanned');
  });

  it('counts relative hrefs via catch fallback when base URL is invalid (true branch)', () => {
    // Setting page.url = '' makes new URL(href, '') throw for relative hrefs.
    // href starting with '/' enters the catch and is counted as internal.
    const p = mockPageContext('https://example.com/', '<html><body><a href="/valid">Link</a></body></html>');
    const page = { ...p, url: '' };
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    // '/valid' counted as internal via catch → page has 1 internal link → pass
    expect(result.status).toBe('pass');
  });

  it('shows "+N more" suffix when more than 5 pages have no internal links (warn path)', () => {
    // 1 page with links + 6 without → warn path, length > 5 → "+N more" branch
    const externalOnly = '<html><body><a href="https://other.com/x">External</a></body></html>';
    const pages = [
      mockPageContext('https://example.com/', withLinks),
      ...Array.from({ length: 6 }, (_, i) =>
        mockPageContext(`https://example.com/page${i + 1}`, externalOnly, i + 1),
      ),
    ];
    const ctx = mockCheckContext(pages);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.found).toContain('+1 more');
  });

  it('ignores hrefs that do not match any relative prefix in the catch fallback (false branch)', () => {
    // Setting page.url = '' makes new URL throw for 'bare word' hrefs.
    // 'bare-word' starts with neither '/' '#' './' '../' → false branch → not counted.
    const p = mockPageContext('https://example.com/', '<html><body><a href="bare-word">Link</a></body></html>');
    const page = { ...p, url: '' };
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    // 'bare-word' not counted → 0 internal links → fail
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No scanned pages have internal links');
  });
});
