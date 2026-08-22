import { describe, it, expect } from 'vitest';
import { LanguageAttributeAudit } from './language-attribute';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('LanguageAttributeAudit', () => {
  const audit = new LanguageAttributeAudit();

  it('passes when <html lang> is set', () => {
    const ctx = mockCheckContext([
      mockPageContext('https://example.com/', '<html lang="en"><head></head><body></body></html>'),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('lang="en"');
  });

  it('fails when <html> has no lang attribute', () => {
    const ctx = mockCheckContext([
      mockPageContext('https://example.com/', '<html><head></head><body></body></html>'),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No lang attribute');
  });

  it('fails when there are no pages', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe('fail');
  });
});
