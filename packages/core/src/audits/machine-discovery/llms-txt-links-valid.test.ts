import { describe, it, expect, vi } from 'vitest';
import { LlmsTxtLinksValidAudit } from './llms-txt-links-valid';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

// isSafeUrl performs a real DNS lookup; stub it so link resolution is
// deterministic and offline-safe. ctx.fetch is stubbed per-test below.
vi.mock('../../fetcher', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../fetcher')>();
  return { ...actual, isSafeUrl: async () => true };
});

function fetchStub(statusByUrl: Record<string, number>) {
  return async ({ url }: { url: string }) => {
    const r = mockFetchResult('', statusByUrl[url] ?? 200);
    r.url = url;
    r.finalUrl = url;
    return r;
  };
}

describe('LlmsTxtLinksValidAudit', () => {
  const audit = new LlmsTxtLinksValidAudit();

  it('passes when all links return HTTP 200', async () => {
    const body =
      '# Site\n\n## Pages\n' +
      '- [Home](https://example.com/): Home\n' +
      '- [About](https://example.com/about): About';
    const ctx = mockCheckContext([], { '/llms.txt': mockFetchResult(body, 200) });
    ctx.fetch = fetchStub({});
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('return HTTP 200');
  });

  it('warns when a link is broken', async () => {
    const body =
      '# Site\n\n## Pages\n' +
      '- [Home](https://example.com/): Home\n' +
      '- [Gone](https://example.com/gone): Gone';
    const ctx = mockCheckContext([], { '/llms.txt': mockFetchResult(body, 200) });
    ctx.fetch = fetchStub({ 'https://example.com/gone': 404 });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.found).toContain('404');
  });

  it('warns when llms.txt has no links to validate', async () => {
    const ctx = mockCheckContext([], {
      '/llms.txt': mockFetchResult('# Site\n\n> Summary, no links.', 200),
    });
    ctx.fetch = fetchStub({});
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('No links found');
  });

  // This audit measures the links inside a published file. Whether the file
  // exists is `machine-discovery/llms-txt-exists`, and reporting it twice made
  // one absent file cost two rows.
  it('is not applicable when llms.txt is missing', async () => {
    const ctx = mockCheckContext([], {});
    const result = await audit.audit(ctx);
    expect(result.status).toBe('na');
    expect(result.message).toContain('no links to validate');
  });

  it('skips malformed URLs in the link list (catch branch)', async () => {
    // http://[invalid has an unclosed IPv6 bracket → new URL throws → catch fires
    const body =
      '# Site\n\n## Pages\n' +
      '- [Bad](http://[invalid): Malformed URL\n' +
      '- [Home](https://example.com/): Home';
    const ctx = mockCheckContext([], { '/llms.txt': mockFetchResult(body, 200) });
    ctx.fetch = fetchStub({});
    const result = await audit.audit(ctx);
    // Malformed URL skipped; valid link fetched and returns 200
    expect(result.status).toBe('pass');
    expect(result.message).toContain('return HTTP 200');
  });
});
