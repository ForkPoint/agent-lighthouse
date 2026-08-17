import { describe, it, expect } from 'vitest';
import { LlmsTxtLinkDescriptionsAudit } from './llms-txt-link-descriptions';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

describe('LlmsTxtLinkDescriptionsAudit', () => {
  const audit = new LlmsTxtLinkDescriptionsAudit();

  it('passes when all links include descriptions', () => {
    const body =
      '# Site\n\n## Pages\n' +
      '- [Home](https://example.com/): Main landing page\n' +
      '- [About](https://example.com/about): Company information';
    const ctx = mockCheckContext([], { '/llms.txt': mockFetchResult(body, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('include descriptions');
  });

  it('warns when only some links have descriptions', () => {
    const body =
      '# Site\n\n## Pages\n' +
      '- [Home](https://example.com/): Main landing page\n' +
      '- [About](https://example.com/about)';
    const ctx = mockCheckContext([], { '/llms.txt': mockFetchResult(body, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('1/2 links have descriptions');
  });

  it('fails when fewer than half the links have descriptions', () => {
    const body =
      '# Site\n\n## Pages\n' +
      '- [A](https://example.com/a): Described page\n' +
      '- [B](https://example.com/b)\n' +
      '- [C](https://example.com/c)';
    const ctx = mockCheckContext([], { '/llms.txt': mockFetchResult(body, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('1/3 links have descriptions');
  });

  it('warns when llms.txt has no markdown links', () => {
    const ctx = mockCheckContext([], {
      '/llms.txt': mockFetchResult('# Site\n\n> Summary only, no links.', 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('no markdown links');
  });

  it('fails when llms.txt is missing', () => {
    const ctx = mockCheckContext([], {});
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('llms.txt not found');
  });
});
