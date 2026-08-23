import { describe, it, expect } from 'vitest';
import { CrawlDelayAudit } from './crawl-delay';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

describe('CrawlDelayAudit', () => {
  const audit = new CrawlDelayAudit();

  it('passes when no Crawl-delay directives are present', () => {
    const robots = 'User-agent: *\nAllow: /';
    const ctx = mockCheckContext([], {
      '/robots.txt': mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('No Crawl-delay directives');
  });

  it('passes when Crawl-delay is reasonable (<= 10s)', () => {
    const robots = 'User-agent: *\nCrawl-delay: 5\nAllow: /';
    const ctx = mockCheckContext([], {
      '/robots.txt': mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('reasonable');
    expect(result.message).toContain('5s');
  });

  it('fails when Crawl-delay is excessive (> 10s)', () => {
    const robots = 'User-agent: *\nCrawl-delay: 30\nAllow: /';
    const ctx = mockCheckContext([], {
      '/robots.txt': mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('Excessive Crawl-delay');
    expect(result.message).toContain('30s');
  });

  it('warns when robots.txt is missing', () => {
    const ctx = mockCheckContext([], {});
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('No robots.txt found');
  });
});
