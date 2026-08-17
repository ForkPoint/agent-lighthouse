import { describe, it, expect } from 'vitest';
import { SensitivePathsAudit } from './sensitive-paths';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

describe('SensitivePathsAudit', () => {
  const audit = new SensitivePathsAudit();

  it('passes when all sensitive paths (/api/, /admin/) are disallowed', () => {
    const robots = 'User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin/';
    const ctx = mockCheckContext([], {
      '/robots.txt': mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('protected');
  });

  it('warns when only some sensitive paths are protected', () => {
    const robots = 'User-agent: *\nAllow: /\nDisallow: /api/';
    const ctx = mockCheckContext([], {
      '/robots.txt': mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('not protected');
    expect(result.found).toContain('/admin/');
  });

  it('fails when no sensitive paths are protected', () => {
    const robots = 'User-agent: *\nAllow: /';
    const ctx = mockCheckContext([], {
      '/robots.txt': mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No sensitive paths are protected');
  });

  it('warns when robots.txt is missing', () => {
    const ctx = mockCheckContext([], {});
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('No robots.txt found');
  });
});
