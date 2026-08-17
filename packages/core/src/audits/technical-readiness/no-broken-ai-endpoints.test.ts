import { describe, it, expect } from 'vitest';
import { NoBrokenAiEndpointsAudit } from './no-broken-ai-endpoints';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

// NOTE: The audit calls isSafeUrl() (which runs dns.lookup) before fetching.
// We use literal public IP hosts so dns.lookup resolves locally without a
// network round-trip, keeping these tests deterministic and offline-safe.
const OK_URL = 'http://8.8.8.8/ok';
const BROKEN_URL = 'http://8.8.8.8/broken';

describe('NoBrokenAiEndpointsAudit', () => {
  const audit = new NoBrokenAiEndpointsAudit();

  it('warns when no AI endpoint URLs are found', async () => {
    const ctx = mockCheckContext([], {});
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('No AI endpoint URLs found');
  });

  it('passes when all URLs in llms.txt are reachable', async () => {
    const ctx = mockCheckContext([], {
      '/llms.txt': mockFetchResult(`# Links\n${OK_URL}\n`, 200, 'text/plain'),
    });
    ctx.fetch = async (opts) =>
      mockFetchResult('', opts.url.includes('/broken') ? 404 : 200);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('reachable');
  });

  it('fails when all URLs are broken', async () => {
    const ctx = mockCheckContext([], {
      '/llms.txt': mockFetchResult(`${BROKEN_URL}\n`, 200, 'text/plain'),
    });
    ctx.fetch = async () => mockFetchResult('', 404);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('broken or unreachable');
    expect(result.message).toContain('404');
  });

  it('warns when some URLs are broken and some are valid', async () => {
    const ctx = mockCheckContext([], {
      '/llms.txt': mockFetchResult(`${OK_URL}\n${BROKEN_URL}\n`, 200, 'text/plain'),
    });
    ctx.fetch = async (opts) =>
      mockFetchResult('', opts.url.includes('/broken') ? 404 : 200);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('broken or unreachable');
  });

  it('collects URLs from ai-catalog.json services', async () => {
    const catalog = JSON.stringify({ services: [{ url: OK_URL }] });
    const ctx = mockCheckContext([], {
      '/.well-known/ai-catalog.json': mockFetchResult(catalog, 200, 'application/json'),
    });
    ctx.fetch = async () => mockFetchResult('', 200);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('reachable');
  });

  it('collects URLs from navigation.json objects', async () => {
    const nav = JSON.stringify({ url: OK_URL, nested: { href: OK_URL } });
    const ctx = mockCheckContext([], {
      '/navigation.json': mockFetchResult(nav, 200, 'application/json'),
    });
    ctx.fetch = async () => mockFetchResult('', 200);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('collects URLs from navigation.json arrays', async () => {
    const nav = JSON.stringify([{ url: OK_URL }, { href: OK_URL }]);
    const ctx = mockCheckContext([], {
      '/navigation.json': mockFetchResult(nav, 200, 'application/json'),
    });
    ctx.fetch = async () => mockFetchResult('', 200);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('collects markdown-format links from llms.txt', async () => {
    const body = `# AI Endpoints\n- [Page](${OK_URL})\n`;
    const ctx = mockCheckContext([], {
      '/llms.txt': mockFetchResult(body, 200, 'text/plain'),
    });
    ctx.fetch = async () => mockFetchResult('', 200);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('skips ai-catalog.json when services property is falsy', async () => {
    // Covers `catalog.services && Array.isArray(...)` false branch (line 39)
    const catalog = JSON.stringify({ services: null });
    const ctx = mockCheckContext([], {
      '/.well-known/ai-catalog.json': mockFetchResult(catalog, 200, 'application/json'),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('No AI endpoint URLs found');
  });

  it('skips services without a url property in ai-catalog.json', async () => {
    // Covers `if (service.url)` false branch (line 41): service exists but has no url
    const catalog = JSON.stringify({ services: [{ name: 'no-url' }, { url: OK_URL }] });
    const ctx = mockCheckContext([], {
      '/.well-known/ai-catalog.json': mockFetchResult(catalog, 200, 'application/json'),
    });
    ctx.fetch = async () => mockFetchResult('', 200);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('reachable');
  });

  it('resolves relative service URLs from ai-catalog.json using baseUrl', async () => {
    // Covers the ternary false branch on line 47: relative URL → `${ctx.baseUrl}${value}`
    // Override baseUrl to an IP so the resolved URL stays network-safe (no real DNS)
    const catalog = JSON.stringify({ services: [{ url: '/api/v1' }] });
    const ctx = mockCheckContext([], {
      '/.well-known/ai-catalog.json': mockFetchResult(catalog, 200, 'application/json'),
    });
    ctx.baseUrl = 'http://8.8.8.8';
    ctx.fetch = async () => mockFetchResult('', 200);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('reachable');
  });

  it('handles llms.txt with no bare URLs (only text)', async () => {
    // Covers `if (matches)` false branch (line 65) when body has no http:// URLs
    const nav = JSON.stringify({ url: OK_URL });
    const ctx = mockCheckContext([], {
      '/llms.txt': mockFetchResult('# AI files\n- See navigation.json for details\n', 200, 'text/plain'),
      '/navigation.json': mockFetchResult(nav, 200, 'application/json'),
    });
    ctx.fetch = async () => mockFetchResult('', 200);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('handles nav.json with null and relative URL values', async () => {
    // null value → covers else-if(obj && …) false branch (line 81, obj is null)
    // relative URL → covers ternary false branch on line 84 (not startsWith http)
    // Override baseUrl to an IP so the resolved relative URL stays network-safe
    const nav = JSON.stringify({ url: '/relative-page', link: null, count: 42 });
    const ctx = mockCheckContext([], {
      '/navigation.json': mockFetchResult(nav, 200, 'application/json'),
    });
    ctx.baseUrl = 'http://8.8.8.8';
    ctx.fetch = async () => mockFetchResult('', 200);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('reachable');
  });

  it('skips URLs that fail the safe-URL check (covers isSafeUrl false branch)', async () => {
    // localhost is explicitly blocked by isSafeUrl without DNS lookup → false branch covered
    const ctx = mockCheckContext([], {
      '/llms.txt': mockFetchResult('http://localhost/api\n', 200, 'text/plain'),
    });
    // No ctx.fetch needed — isSafeUrl filters out localhost before any fetch
    const result = await audit.audit(ctx);
    // 0 safe URLs → 0 broken → pass (with "All 0 AI endpoint URL(s) are reachable")
    expect(result.status).toBe('pass');
    expect(result.message).toContain('All 0');
  });

  it('counts fetch errors as broken (status 0)', async () => {
    const ctx = mockCheckContext([], {
      '/llms.txt': mockFetchResult(`${BROKEN_URL}\n`, 200, 'text/plain'),
    });
    ctx.fetch = async () => {
      throw new Error('network error');
    };
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toContain('Broken: 1');
  });
});
