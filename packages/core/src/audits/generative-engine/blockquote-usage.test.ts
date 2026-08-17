import { describe, it, expect } from 'vitest';
import { BlockquoteUsageAudit } from './blockquote-usage';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('BlockquoteUsageAudit', () => {
  const audit = new BlockquoteUsageAudit();

  it('passes when blockquote elements are present', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body><blockquote><p>Key insight.</p></blockquote></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('blockquote');
  });

  it('fails when no blockquote elements exist', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body><p>No quotes here.</p></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No <blockquote> elements found');
  });

  it('fails when no pages scanned', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No pages scanned');
  });

  it('passes and sets pageWithBlockquote from first matching page when multiple pages have blockquotes', () => {
    const page1 = mockPageContext(
      'https://example.com/post-1',
      `<html><body><blockquote><p>First quote.</p></blockquote></body></html>`,
    );
    const page2 = mockPageContext(
      'https://example.com/post-2',
      `<html><body><blockquote><p>Second quote.</p></blockquote></body></html>`,
      1,
    );
    const result = audit.audit(mockCheckContext([page1, page2]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('2 <blockquote>');
  });
});
