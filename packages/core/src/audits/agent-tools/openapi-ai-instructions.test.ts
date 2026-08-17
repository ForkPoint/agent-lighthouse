import { describe, it, expect } from 'vitest';
import { OpenApiAiInstructionsAudit } from './openapi-ai-instructions';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

describe('OpenApiAiInstructionsAudit', () => {
  const audit = new OpenApiAiInstructionsAudit();

  it('passes when info contains x-ai-instructions', () => {
    const spec = JSON.stringify({
      openapi: '3.0.3',
      info: { title: 'API', 'x-ai-instructions': 'Use searchContent first.' },
    });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('x-ai-instructions');
  });

  it('fails when there is no spec', () => {
    const ctx = mockCheckContext([], {});
    expect(audit.audit(ctx).status).toBe('fail');
  });

  it('fails when info lacks x-ai-instructions', () => {
    const spec = JSON.stringify({ openapi: '3.0.3', info: { title: 'API' } });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('does not contain x-ai-instructions');
  });

  it('fails when openapi.json contains invalid JSON', () => {
    const ctx = mockCheckContext([], {
      '/openapi.json': mockFetchResult('invalid json {{{', 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No parseable');
  });
});
