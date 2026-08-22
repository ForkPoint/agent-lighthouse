import { describe, it, expect } from 'vitest';
import { AgentGovernanceAudit } from './agent-governance';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

describe('AgentGovernanceAudit', () => {
  const audit = new AgentGovernanceAudit();

  it('passes when both categories have >= 2 explicit groups', () => {
    const robots = [
      'User-agent: GPTBot',
      'Disallow: /',
      '',
      'User-agent: CCBot',
      'Disallow: /',
      '',
      'User-agent: ChatGPT-User',
      'Allow: /',
      '',
      'User-agent: Claude-User',
      'Allow: /',
      '',
      'User-agent: *',
      'Allow: /',
    ].join('\n');
    const ctx = mockCheckContext([], {
      '/robots.txt': mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('2 training crawler(s)');
    expect(result.details?.trainingAgents).toEqual(['GPTBot', 'CCBot']);
    expect(result.details?.realtimeAgents).toEqual(['ChatGPT-User', 'Claude-User']);
  });

  it('passes when the two categories are explicitly treated differently', () => {
    const robots = [
      'User-agent: GPTBot',
      'Disallow: /',
      '',
      'User-agent: ChatGPT-User',
      'Allow: /',
      '',
      'User-agent: *',
      'Allow: /',
    ].join('\n');
    const ctx = mockCheckContext([], {
      '/robots.txt': mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('different policies');
  });

  it('warns when only training crawlers are explicitly named', () => {
    const robots = [
      'User-agent: GPTBot',
      'Disallow: /',
      '',
      'User-agent: *',
      'Allow: /',
    ].join('\n');
    const ctx = mockCheckContext([], {
      '/robots.txt': mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('Only training crawlers');
    expect(result.details?.trainingAgents).toEqual(['GPTBot']);
    expect(result.details?.realtimeAgents).toEqual([]);
  });

  it('fails when robots.txt only has a catch-all User-agent: *', () => {
    const robots = 'User-agent: *\nAllow: /\nDisallow: /api/';
    const ctx = mockCheckContext([], {
      '/robots.txt': mockFetchResult(robots, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('catch-all');
    expect(result.details?.hasCatchAll).toBe(true);
  });

  it('is not applicable when robots.txt is missing', () => {
    const ctx = mockCheckContext([], {});
    const result = audit.audit(ctx);
    expect(result.status).toBe('na');
    expect(result.message).toContain('No robots.txt found');
  });

  it('is not applicable when robots.txt returns non-200', () => {
    const ctx = mockCheckContext([], {
      '/robots.txt': mockFetchResult('', 404),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('na');
  });
});
