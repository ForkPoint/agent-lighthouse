import { describe, it, expect } from 'vitest';
import { LlmsTxtBlockquoteAudit } from './llms-txt-blockquote';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

describe('LlmsTxtBlockquoteAudit', () => {
  const audit = new LlmsTxtBlockquoteAudit();

  it('passes when a blockquote follows the H1', () => {
    const ctx = mockCheckContext([], {
      '/llms.txt': mockFetchResult('# My Site\n\n> A concise summary of the site.', 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('blockquote summary');
  });

  it('fails when llms.txt is missing', () => {
    const ctx = mockCheckContext([], {});
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('llms.txt not found');
  });

  it('fails when there is no H1 heading', () => {
    const ctx = mockCheckContext([], {
      '/llms.txt': mockFetchResult('> just a blockquote, no heading', 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No H1 heading');
  });

  it('fails when there is no blockquote after the H1', () => {
    const ctx = mockCheckContext([], {
      '/llms.txt': mockFetchResult('# My Site\n\nSome intro text without a blockquote.', 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('no blockquote summary');
  });
});
