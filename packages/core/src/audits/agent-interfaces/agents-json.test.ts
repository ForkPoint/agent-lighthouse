import { describe, it, expect } from 'vitest';
import { AgentsJsonAudit } from './agents-json';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

describe('AgentsJsonAudit', () => {
  const audit = new AgentsJsonAudit();

  it('passes when agents.json is a valid JSON object', () => {
    const body = JSON.stringify({ name: 'Site', protocols: ['rest', 'mcp'] });
    const ctx = mockCheckContext([], {
      '/.well-known/agents.json': mockFetchResult(body, 200, 'application/json'),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('valid JSON');
  });

  it('passes when agents.json is a valid JSON array', () => {
    const ctx = mockCheckContext([], {
      '/.well-known/agents.json': mockFetchResult(JSON.stringify([{ name: 'a' }]), 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('fails when agents.json is missing (404)', () => {
    const ctx = mockCheckContext([], {
      '/.well-known/agents.json': mockFetchResult('', 404),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toContain('404');
  });

  it('fails when agents.json is not fetched at all', () => {
    const ctx = mockCheckContext([], {});
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toContain('Not fetched');
  });

  it('fails when agents.json is invalid JSON', () => {
    const ctx = mockCheckContext([], {
      '/.well-known/agents.json': mockFetchResult('not json {{{', 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('not valid JSON');
  });
});
