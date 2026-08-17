import { describe, it, expect } from 'vitest';
import { CorrectContentTypesAudit } from './correct-content-types';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

describe('CorrectContentTypesAudit', () => {
  const audit = new CorrectContentTypesAudit();

  it('passes when all files have correct Content-Type', () => {
    const ctx = mockCheckContext([], {
      '/llms.txt': mockFetchResult('content', 200, 'text/plain'),
      '/openapi.json': mockFetchResult('{}', 200, 'application/json'),
      '/sitemap.xml': mockFetchResult('<xml/>', 200, 'application/xml'),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('correct Content-Type');
  });

  it('tolerates charset suffixes on Content-Type', () => {
    const ctx = mockCheckContext([], {
      '/openapi.json': mockFetchResult('{}', 200, 'application/json; charset=utf-8'),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('fails when a file has an incorrect Content-Type', () => {
    const ctx = mockCheckContext([], {
      '/openapi.json': mockFetchResult('{}', 200, 'text/html'),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('expected application/json');
    expect(result.message).toContain('got text/html');
  });

  it('warns when no applicable files found', () => {
    const ctx = mockCheckContext([], {});
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.found).toContain('No applicable files found');
  });
});
