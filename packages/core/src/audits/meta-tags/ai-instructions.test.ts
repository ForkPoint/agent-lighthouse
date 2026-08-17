import { describe, it, expect } from 'vitest';
import { AiInstructionsAudit } from './ai-instructions';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

const doc = (head: string) => `<html lang="en"><head>${head}</head><body></body></html>`;

describe('AiInstructionsAudit', () => {
  const audit = new AiInstructionsAudit();

  it('passes when ai-instructions meta has content', () => {
    const ctx = mockCheckContext([
      mockPageContext(
        'https://example.com/',
        doc('<meta name="ai-instructions" content="Summarise this page as a product overview.">'),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('ai-instructions meta tag is present');
  });

  it('fails when ai-instructions meta is missing', () => {
    const ctx = mockCheckContext([mockPageContext('https://example.com/', doc(''))]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No ai-instructions');
  });

  it('fails when there are no pages', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe('fail');
  });

  it('truncates displayed value when ai-instructions content exceeds 80 characters', () => {
    const longContent = 'Summarise every product on this page with a focus on pricing, availability, and key features for comparison.';
    const ctx = mockCheckContext([
      mockPageContext(
        'https://example.com/',
        doc(`<meta name="ai-instructions" content="${longContent}">`),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.found).toContain('...');
    expect(result.found?.length).toBeLessThanOrEqual(83); // 80 chars + '...'
  });
});
