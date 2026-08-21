import { describe, it, expect } from 'vitest';
import { GptbotAudit } from './gptbot';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

describe('GptbotAudit', () => {
  const audit = new GptbotAudit();

  it('passes when GPTBot is explicitly allowed in robots.txt', () => {
    const robots = 'User-agent: GPTBot\nAllow: /';
    const ctx = mockCheckContext([], {
      '/robots.txt': mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('explicitly allowed');
  });

  it('warns when GPTBot is allowed only via wildcard (not explicit)', () => {
    const robots = 'User-agent: *\nAllow: /';
    const ctx = mockCheckContext([], {
      '/robots.txt': mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('allowed by default');
  });

  it('fails when GPTBot is blocked via Disallow: /', () => {
    const robots = 'User-agent: GPTBot\nDisallow: /';
    const ctx = mockCheckContext([], {
      '/robots.txt': mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('blocked by robots.txt');
  });

  it('warns when robots.txt is missing', () => {
    const ctx = mockCheckContext([], {});
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('robots.txt not found');
  });

  it('warns when robots.txt returns non-200', () => {
    const ctx = mockCheckContext([], {
      '/robots.txt': mockFetchResult('', 404),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.found).toContain('No robots.txt found');
  });
});
