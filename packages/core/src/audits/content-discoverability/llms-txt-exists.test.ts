import { describe, it, expect } from 'vitest';
import { LlmsTxtExistsAudit } from './llms-txt-exists';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

describe('LlmsTxtExistsAudit', () => {
  const audit = new LlmsTxtExistsAudit();

  it('passes when llms.txt exists and starts with #', () => {
    const ctx = mockCheckContext([], {
      '/llms.txt': mockFetchResult('# My Site\n\n> Intro', 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('fails when llms.txt is missing (404)', () => {
    const ctx = mockCheckContext([], {
      '/llms.txt': mockFetchResult('', 404),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('llms.txt not found');
  });

  it('warns when llms.txt exists but lacks H1 heading', () => {
    const ctx = mockCheckContext([], {
      '/llms.txt': mockFetchResult('Welcome to my site\n\nNo heading here', 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('missing markdown heading');
  });

  it('fails when fetch result is completely missing', () => {
    const ctx = mockCheckContext([], {});
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
  });
});
