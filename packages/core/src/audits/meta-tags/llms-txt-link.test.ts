import { describe, it, expect } from 'vitest';
import { LlmsTxtLinkAudit } from './llms-txt-link';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

const doc = (head: string) => `<html lang="en"><head>${head}</head><body></body></html>`;

describe('LlmsTxtLinkAudit', () => {
  const audit = new LlmsTxtLinkAudit();

  it('passes when an llms.txt alternate link is present', () => {
    const ctx = mockCheckContext([
      mockPageContext(
        'https://example.com/',
        doc('<link rel="alternate" type="text/plain" href="/llms.txt" title="LLMs.txt">'),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('/llms.txt');
  });

  it('fails when no llms.txt link is present', () => {
    const ctx = mockCheckContext([mockPageContext('https://example.com/', doc(''))]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No llms.txt link');
  });

  it('fails when there are no pages', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe('fail');
  });
});
