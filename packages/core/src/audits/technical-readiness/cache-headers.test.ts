import { describe, it, expect } from 'vitest';
import { CacheHeadersAudit } from './cache-headers';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

describe('CacheHeadersAudit', () => {
  const audit = new CacheHeadersAudit();

  function withCacheControl(body: string) {
    const r = mockFetchResult(body, 200);
    r.headers['cache-control'] = 'public, max-age=3600';
    return r;
  }

  it('passes when all AI files have Cache-Control', () => {
    const ctx = mockCheckContext([], {
      '/llms.txt': withCacheControl('content'),
      '/openapi.json': withCacheControl('{}'),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('All AI files have Cache-Control');
  });

  it('warns when some files have it and some do not', () => {
    const ctx = mockCheckContext([], {
      '/llms.txt': withCacheControl('content'),
      '/openapi.json': mockFetchResult('{}', 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('/openapi.json');
  });

  it('fails when no files have Cache-Control', () => {
    const ctx = mockCheckContext([], {
      '/llms.txt': mockFetchResult('content', 200),
      '/openapi.json': mockFetchResult('{}', 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No AI files have Cache-Control');
  });

  it('warns when no applicable AI files are found', () => {
    const ctx = mockCheckContext([], {});
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('No AI files');
  });

  it('ignores files with non-200 status', () => {
    const ctx = mockCheckContext([], {
      '/llms.txt': mockFetchResult('', 404),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.found).toContain('No applicable files found');
  });
});
