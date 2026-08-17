import { describe, it, expect } from 'vitest';
import { AiContentDeclarationAudit } from './ai-content-declaration';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

const doc = (head: string) => `<html lang="en"><head>${head}</head><body></body></html>`;

describe('AiContentDeclarationAudit', () => {
  const audit = new AiContentDeclarationAudit();

  it('passes when ai-content-declaration is a valid URL', () => {
    const ctx = mockCheckContext([
      mockPageContext(
        'https://example.com/',
        doc('<meta name="ai-content-declaration" content="https://example.com/llms.txt">'),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('https://example.com/llms.txt');
  });

  it('warns when ai-content-declaration is present but not a URL', () => {
    const ctx = mockCheckContext([
      mockPageContext(
        'https://example.com/',
        doc('<meta name="ai-content-declaration" content="see our policy">'),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('not a valid URL');
  });

  it('fails when ai-content-declaration is missing', () => {
    const ctx = mockCheckContext([mockPageContext('https://example.com/', doc(''))]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No ai-content-declaration');
  });

  it('fails when there are no pages', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe('fail');
  });
});
