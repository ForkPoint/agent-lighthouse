import { describe, it, expect } from 'vitest';
import { MarkdownAlternateAudit } from './markdown-alternate';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

const doc = (head: string) => `<html lang="en"><head>${head}</head><body></body></html>`;

describe('MarkdownAlternateAudit', () => {
  const audit = new MarkdownAlternateAudit();

  it('passes when a text/markdown alternate link is present', () => {
    const ctx = mockCheckContext([
      mockPageContext(
        'https://example.com/',
        doc('<link rel="alternate" type="text/markdown" href="/page.md">'),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('/page.md');
  });

  it('fails when no markdown alternate link is present', () => {
    const ctx = mockCheckContext([mockPageContext('https://example.com/', doc(''))]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No Markdown alternate link');
  });

  it('fails when there are no pages', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe('fail');
  });
});
