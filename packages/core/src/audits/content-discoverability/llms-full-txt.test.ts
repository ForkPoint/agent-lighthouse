import { describe, it, expect } from 'vitest';
import { LlmsFullTxtAudit } from './llms-full-txt';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

describe('LlmsFullTxtAudit', () => {
  const audit = new LlmsFullTxtAudit();

  it('passes when llms-full.txt returns 200', () => {
    const ctx = mockCheckContext([], {
      '/llms-full.txt': mockFetchResult('# Site\n\nFull content', 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('llms-full.txt exists');
  });

  it('fails when llms-full.txt returns 404', () => {
    const ctx = mockCheckContext([], {
      '/llms-full.txt': mockFetchResult('', 404),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toContain('HTTP 404');
  });

  it('fails when llms-full.txt was not fetched at all', () => {
    const ctx = mockCheckContext([], {});
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No llms-full.txt file found');
  });
});
