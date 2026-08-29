import { describe, it, expect } from 'vitest';
import { OpenApiServersAudit } from './openapi-servers';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';
import { expectNotApplicableOnEmpty } from '../../tests/na-contract';

function specWithServers(servers: unknown): string {
  return JSON.stringify({ openapi: '3.0.3', servers, paths: {} });
}

describe('OpenApiServersAudit', () => {
  const audit = new OpenApiServersAudit();

  it('passes when the first server URL is reachable', async () => {
    const ctx = mockCheckContext([], {
      '/openapi.json': mockFetchResult(specWithServers([{ url: 'https://example.com/api' }]), 200),
    });
    ctx.fetch = async () => mockFetchResult('', 200);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('reachable');
  });

  it('warns when the server URL returns a 5xx status', async () => {
    const ctx = mockCheckContext([], {
      '/openapi.json': mockFetchResult(specWithServers([{ url: 'https://example.com/api' }]), 200),
    });
    ctx.fetch = async () => mockFetchResult('', 503);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('HTTP 503');
  });

  it('does not pass when the server URL returns a 4xx status', async () => {
    const ctx = mockCheckContext([], {
      '/openapi.json': mockFetchResult(specWithServers([{ url: 'https://example.com/api' }]), 200),
    });
    ctx.fetch = async () => mockFetchResult('', 404);
    const result = await audit.audit(ctx);
    expect(result.status).not.toBe('pass');
    expect(result.status).toBe('warn');
    expect(result.message).toContain('HTTP 404');
  });

  it('warns when the server URL cannot be reached', async () => {
    const ctx = mockCheckContext([], {
      '/openapi.json': mockFetchResult(specWithServers([{ url: 'https://example.com/api' }]), 200),
    });
    ctx.fetch = async () => {
      throw new Error('network');
    };
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('could not be reached');
  });

  // Absent artifact, absent verdict: a site that publishes no OpenAPI
  // document has not written a bad `servers` array. This used to be a
  // high-priority `fail` on every site without an API.
  it('declines when there is no spec', async () => {
    const ctx = mockCheckContext([], {});
    const result = await audit.audit(ctx);
    expect(result.status).toBe('na');
    expect(result.found).toBe('No OpenAPI document');
  });

  it('declines on a scan that read nothing', async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it('fails when there is no servers array', async () => {
    const ctx = mockCheckContext([], {
      '/openapi.json': mockFetchResult(JSON.stringify({ openapi: '3.0.3', paths: {} }), 200),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No servers array');
  });

  it('fails when servers entries have no url', async () => {
    const ctx = mockCheckContext([], {
      '/openapi.json': mockFetchResult(specWithServers([{ description: 'no url' }]), 200),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('no entries with a url');
  });

  // A body that will not parse is a document this audit never read, so it is
  // the same absence. `openapi-exists` is the audit that reports a spec
  // advertised but unreadable, and it reports it once.
  it('declines when openapi.json contains invalid JSON', async () => {
    const ctx = mockCheckContext([], {
      '/openapi.json': mockFetchResult('invalid json {{{', 200),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('na');
  });
});
