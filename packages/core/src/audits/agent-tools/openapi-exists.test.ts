import { describe, it, expect } from 'vitest';
import { OpenApiExistsAudit } from './openapi-exists';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

describe('OpenApiExistsAudit', () => {
  const audit = new OpenApiExistsAudit();

  it('passes with a valid JSON spec at /openapi.json', () => {
    const spec = JSON.stringify({ openapi: '3.0.3', info: { title: 'API' }, paths: {} });
    const ctx = mockCheckContext([], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('/openapi.json');
  });

  it('passes with a YAML spec at /openapi.yaml', () => {
    const yaml = 'openapi: 3.0.3\ninfo:\n  title: API\npaths: {}\n';
    const ctx = mockCheckContext([], { '/openapi.yaml': mockFetchResult(yaml, 200) });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('/openapi.yaml');
  });

  it('fails when no spec is present', () => {
    const ctx = mockCheckContext([], {});
    expect(audit.audit(ctx).status).toBe('fail');
  });

  it('fails when /openapi.json is invalid JSON and YAML lacks openapi: directive', () => {
    const ctx = mockCheckContext([], {
      '/openapi.json': mockFetchResult('not json {{{', 200),
      '/openapi.yaml': mockFetchResult('foo: bar\n', 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
  });
});
