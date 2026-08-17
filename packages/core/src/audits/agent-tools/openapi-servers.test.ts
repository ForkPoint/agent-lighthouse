import { describe, it, expect } from 'vitest';
import { OpenApiServersAudit } from './openapi-servers';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

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

  it('fails when there is no spec', async () => {
    const ctx = mockCheckContext([], {});
    expect((await audit.audit(ctx)).status).toBe('fail');
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

  it('fails when openapi.json contains invalid JSON', async () => {
    const ctx = mockCheckContext([], {
      '/openapi.json': mockFetchResult('invalid json {{{', 200),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No parseable');
  });
});
