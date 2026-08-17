import { describe, it, expect } from 'vitest';
import { OgTypeAudit } from './og-type';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

const doc = (head: string) => `<html lang="en"><head>${head}</head><body></body></html>`;

describe('OgTypeAudit', () => {
  const audit = new OgTypeAudit();

  it('passes when og:type is present (non-blog page)', () => {
    const ctx = mockCheckContext([
      mockPageContext('https://example.com/', doc('<meta property="og:type" content="website">')),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('website');
  });

  it('warns when a blog page has og:type other than "article"', () => {
    const ctx = mockCheckContext([
      mockPageContext(
        'https://example.com/blog/my-post',
        doc('<meta property="og:type" content="website">'),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('article');
  });

  it('passes when a blog page correctly uses og:type "article"', () => {
    const ctx = mockCheckContext([
      mockPageContext(
        'https://example.com/blog/my-post',
        doc('<meta property="og:type" content="article">'),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('fails when og:type is missing', () => {
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
