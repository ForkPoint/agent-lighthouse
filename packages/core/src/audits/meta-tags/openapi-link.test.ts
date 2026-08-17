import { describe, it, expect } from 'vitest';
import { OpenApiLinkAudit } from './openapi-link';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

const doc = (head: string) => `<html lang="en"><head>${head}</head><body></body></html>`;

describe('OpenApiLinkAudit', () => {
  const audit = new OpenApiLinkAudit();

  it('passes when an OpenAPI alternate link is present', () => {
    const ctx = mockCheckContext([
      mockPageContext(
        'https://example.com/',
        doc(
          '<link rel="alternate" type="application/json" href="/openapi.json" title="OpenAPI Spec">',
        ),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('/openapi.json');
  });

  it('fails when no OpenAPI link is present', () => {
    const ctx = mockCheckContext([mockPageContext('https://example.com/', doc(''))]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No OpenAPI spec link');
  });

  it('fails when there are no pages', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe('fail');
  });
});
