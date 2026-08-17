import { describe, it, expect } from 'vitest';
import { AiPluginJsonAudit } from './ai-plugin-json';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

describe('AiPluginJsonAudit', () => {
  const audit = new AiPluginJsonAudit();

  it('passes when all required fields are present', () => {
    const body = JSON.stringify({
      schema_version: 'v1',
      name_for_human: 'My Site',
      name_for_model: 'my_site',
    });
    const ctx = mockCheckContext([], {
      '/.well-known/ai-plugin.json': mockFetchResult(body, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('all required fields');
  });

  it('warns when some (but not all) required fields are missing', () => {
    const body = JSON.stringify({
      schema_version: 'v1',
      name_for_human: 'My Site',
      // missing name_for_model
    });
    const ctx = mockCheckContext([], {
      '/.well-known/ai-plugin.json': mockFetchResult(body, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('name_for_model');
  });

  it('fails when all required fields are missing', () => {
    const ctx = mockCheckContext([], {
      '/.well-known/ai-plugin.json': mockFetchResult(JSON.stringify({ logo_url: 'x' }), 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('missing all required fields');
  });

  it('fails when ai-plugin.json is missing', () => {
    const ctx = mockCheckContext([], {});
    expect(audit.audit(ctx).status).toBe('fail');
  });

  it('fails when ai-plugin.json is invalid JSON', () => {
    const ctx = mockCheckContext([], {
      '/.well-known/ai-plugin.json': mockFetchResult('nope {{{', 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('not valid JSON');
  });

  it('shows HTTP status in message when file exists but returns non-200', () => {
    const ctx = mockCheckContext([], {
      '/.well-known/ai-plugin.json': mockFetchResult('', 404),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('not found or not accessible');
  });
});
