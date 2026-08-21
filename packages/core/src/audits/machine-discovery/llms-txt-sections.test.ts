import { describe, it, expect } from 'vitest';
import { LlmsTxtSectionsAudit } from './llms-txt-sections';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

describe('LlmsTxtSectionsAudit', () => {
  const audit = new LlmsTxtSectionsAudit();

  it('passes when llms.txt has H2 sections', () => {
    const body = '# Site\n\n> Summary\n\n## Docs\n- item\n\n## Company\n- item';
    const ctx = mockCheckContext([], { '/llms.txt': mockFetchResult(body, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('2 H2 section');
  });

  it('fails when llms.txt has no H2 sections', () => {
    const body = '# Site\n\n> Summary\n\n- [Home](https://example.com/)';
    const ctx = mockCheckContext([], { '/llms.txt': mockFetchResult(body, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('no H2 sections');
  });

  it('fails when llms.txt is missing', () => {
    const ctx = mockCheckContext([], {});
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('llms.txt not found');
  });
});
