import { describe, it, expect } from 'vitest';
import { AiCatalogExistsAudit } from './ai-catalog-exists';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

describe('AiCatalogExistsAudit', () => {
  const audit = new AiCatalogExistsAudit();

  it('passes when ai-catalog.json has a services array', () => {
    const body = JSON.stringify({
      name: 'Site',
      services: [
        { name: 'Search', url: 'https://example.com/api/search', type: 'rest' },
        { name: 'Contact', url: 'https://example.com/api/contact', type: 'rest' },
      ],
    });
    const ctx = mockCheckContext([], {
      '/.well-known/ai-catalog.json': mockFetchResult(body, 200, 'application/json'),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('2 service(s)');
  });

  it('fails when ai-catalog.json is missing (404)', () => {
    const ctx = mockCheckContext([], {
      '/.well-known/ai-catalog.json': mockFetchResult('', 404),
    });
    expect(audit.audit(ctx).status).toBe('fail');
  });

  it('fails when ai-catalog.json is not fetched at all', () => {
    const ctx = mockCheckContext([], {});
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.found).toContain('Not fetched');
  });

  it('fails when ai-catalog.json is invalid JSON', () => {
    const ctx = mockCheckContext([], {
      '/.well-known/ai-catalog.json': mockFetchResult('nope {{{', 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('not valid JSON');
  });

  it('fails when there is no services array', () => {
    const ctx = mockCheckContext([], {
      '/.well-known/ai-catalog.json': mockFetchResult(JSON.stringify({ name: 'Site' }), 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('does not contain a services array');
  });
});
