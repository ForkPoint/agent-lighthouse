import { describe, it, expect } from 'vitest';
import { MetaAuthorAudit } from './meta-author';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

const doc = (head: string) => `<html lang="en"><head>${head}</head><body></body></html>`;

describe('MetaAuthorAudit', () => {
  const audit = new MetaAuthorAudit();

  it('passes when author meta is set', () => {
    const ctx = mockCheckContext([
      mockPageContext('https://example.com/', doc('<meta name="author" content="Jane Smith">')),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('Jane Smith');
  });

  it('fails when author meta is missing', () => {
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
