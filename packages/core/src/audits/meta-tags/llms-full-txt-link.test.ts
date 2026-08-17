import { describe, it, expect } from 'vitest';
import { LlmsFullTxtLinkAudit } from './llms-full-txt-link';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

const doc = (head: string) => `<html lang="en"><head>${head}</head><body></body></html>`;

describe('LlmsFullTxtLinkAudit', () => {
  const audit = new LlmsFullTxtLinkAudit();

  it('passes when an llms-full.txt alternate link is present', () => {
    const ctx = mockCheckContext([
      mockPageContext(
        'https://example.com/',
        doc(
          '<link rel="alternate" type="text/plain" href="/llms-full.txt" title="LLMs-full.txt">',
        ),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('/llms-full.txt');
  });

  it('fails when only a plain llms.txt link is present (title lacks "llms-full")', () => {
    const ctx = mockCheckContext([
      mockPageContext(
        'https://example.com/',
        doc('<link rel="alternate" type="text/plain" href="/llms.txt" title="LLMs.txt">'),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No llms-full.txt link');
  });

  it('fails when there are no pages', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe('fail');
  });
});
