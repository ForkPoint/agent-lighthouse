import { describe, it, expect } from 'vitest';
import { NoBlanketBlockAudit } from './no-blanket-block';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

describe('NoBlanketBlockAudit', () => {
  const audit = new NoBlanketBlockAudit();

  it('passes when wildcard does not blanket-block', () => {
    const robots = 'User-agent: *\nAllow: /\nDisallow: /api/';
    const ctx = mockCheckContext([], {
      '/robots.txt': mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('No blanket Disallow');
  });

  it('passes when wildcard has Disallow: / countered by Allow: /', () => {
    const robots = 'User-agent: *\nDisallow: /\nAllow: /';
    const ctx = mockCheckContext([], {
      '/robots.txt': mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('fails when wildcard has blanket Disallow: /', () => {
    const robots = 'User-agent: *\nDisallow: /';
    const ctx = mockCheckContext([], {
      '/robots.txt': mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('blocks all crawlers');
  });

  it('warns when robots.txt is missing', () => {
    const ctx = mockCheckContext([], {});
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('No robots.txt found');
  });

  it('warns when robots.txt returns non-200', () => {
    const ctx = mockCheckContext([], {
      '/robots.txt': mockFetchResult('', 500),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
  });
});
