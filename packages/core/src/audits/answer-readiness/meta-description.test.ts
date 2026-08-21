import { describe, it, expect } from 'vitest';
import { MetaDescriptionAudit } from './meta-description';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

const doc = (head: string) => `<html lang="en"><head>${head}</head><body></body></html>`;

describe('MetaDescriptionAudit', () => {
  const audit = new MetaDescriptionAudit();

  it('passes when description is 50-300 chars', () => {
    const desc = 'A concise summary of the page content describing exactly what users will learn here today.';
    const ctx = mockCheckContext([
      mockPageContext('https://example.com/', doc(`<meta name="description" content="${desc}">`)),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('Meta description present');
  });

  it('warns when description is too short', () => {
    const ctx = mockCheckContext([
      mockPageContext('https://example.com/', doc('<meta name="description" content="Too short.">')),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('should be 50-300');
  });

  it('warns when description is too long', () => {
    const desc = 'x'.repeat(350);
    const ctx = mockCheckContext([
      mockPageContext('https://example.com/', doc(`<meta name="description" content="${desc}">`)),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('350');
  });

  it('fails when description is missing', () => {
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
