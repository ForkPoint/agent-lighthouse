import { describe, it, expect } from 'vitest';
import { PaginationLinksAudit } from './pagination-links';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('PaginationLinksAudit', () => {
  const audit = new PaginationLinksAudit();

  it('passes when rel="next" link is present in head', () => {
    const page = mockPageContext(
      'https://example.com/blog/page/2',
      `<html><head><link rel="next" href="/blog/page/3"><link rel="prev" href="/blog/page/1"></head><body><p>List</p></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('Pagination links found');
  });

  it('warns when no pagination links exist', () => {
    const page = mockPageContext(
      'https://example.com/blog/page/2',
      `<html><head></head><body><p>List</p></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('No <link rel="prev"> or <link rel="next">');
  });

  it('fails when no pages scanned', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No pages scanned');
  });

  it('passes when only rel="prev" is present (no next link)', () => {
    const page = mockPageContext(
      'https://example.com/blog/page/3',
      `<html><head><link rel="prev" href="/blog/page/2"></head><body><p>Last page</p></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('rel="prev"');
    expect(result.message).not.toContain('rel="next"');
  });

  it('passes when only rel="next" is present (no prev link)', () => {
    const page = mockPageContext(
      'https://example.com/blog/page/1',
      `<html><head><link rel="next" href="/blog/page/2"></head><body><p>First page</p></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('rel="next"');
    expect(result.message).not.toContain('rel="prev"');
  });
});
