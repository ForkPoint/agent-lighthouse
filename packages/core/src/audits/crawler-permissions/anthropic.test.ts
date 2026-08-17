import { describe, it, expect } from 'vitest';
import { AnthropicAudit } from './anthropic';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

describe('AnthropicAudit (anthropic-ai / ClaudeBot)', () => {
  const audit = new AnthropicAudit();

  it('passes when anthropic-ai is explicitly allowed', () => {
    const robots = 'User-agent: anthropic-ai\nAllow: /';
    const ctx = mockCheckContext([], {
      '/robots.txt': mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('explicitly allowed');
  });

  it('passes when ClaudeBot is explicitly allowed (alias)', () => {
    const robots = 'User-agent: ClaudeBot\nAllow: /';
    const ctx = mockCheckContext([], {
      '/robots.txt': mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('passes when one alias is blocked but the other is allowed', () => {
    // Both aliases explicit: pass if either is allowed.
    const robots = 'User-agent: anthropic-ai\nDisallow: /\n\nUser-agent: ClaudeBot\nAllow: /';
    const ctx = mockCheckContext([], {
      '/robots.txt': mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('warns when allowed only via wildcard (not explicit)', () => {
    const robots = 'User-agent: *\nAllow: /';
    const ctx = mockCheckContext([], {
      '/robots.txt': mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('allowed by default');
  });

  it('fails when anthropic-ai is explicitly blocked (no ClaudeBot group)', () => {
    const robots = 'User-agent: anthropic-ai\nDisallow: /';
    const ctx = mockCheckContext([], {
      '/robots.txt': mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('blocked by robots.txt');
  });

  it('fails when both aliases are explicitly blocked', () => {
    const robots = 'User-agent: anthropic-ai\nDisallow: /\n\nUser-agent: ClaudeBot\nDisallow: /';
    const ctx = mockCheckContext([], {
      '/robots.txt': mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
  });

  it('warns when robots.txt is missing', () => {
    const ctx = mockCheckContext([], {});
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('robots.txt not found');
  });
});
