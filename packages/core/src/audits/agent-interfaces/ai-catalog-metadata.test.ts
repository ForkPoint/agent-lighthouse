import { describe, it, expect } from 'vitest';
import { AiCatalogMetadataAudit } from './ai-catalog-metadata';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

describe('AiCatalogMetadataAudit', () => {
  const audit = new AiCatalogMetadataAudit();

  it('passes when all required metadata fields are present', () => {
    const body = JSON.stringify({
      version: '1.0',
      name: 'Site',
      description: 'A site',
      capabilities: ['search'],
      owner: 'Acme',
      contact: 'hello@example.com',
      lastUpdated: '2026-01-01',
      services: [],
    });
    const ctx = mockCheckContext([], {
      '/.well-known/ai-catalog.json': mockFetchResult(body, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('all required metadata');
  });

  it('warns when at least half (but not all) fields are present', () => {
    const body = JSON.stringify({
      version: '1.0',
      name: 'Site',
      description: 'A site',
      capabilities: ['search'],
      owner: 'Acme',
      // missing contact and lastUpdated -> 5/7 present
    });
    const ctx = mockCheckContext([], {
      '/.well-known/ai-catalog.json': mockFetchResult(body, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('contact');
    expect(result.message).toContain('lastUpdated');
  });

  it('fails when most fields are missing', () => {
    const body = JSON.stringify({ version: '1.0', name: 'Site' }); // 2/7 present
    const ctx = mockCheckContext([], {
      '/.well-known/ai-catalog.json': mockFetchResult(body, 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('missing most');
  });

  it('fails when ai-catalog.json is missing', () => {
    const ctx = mockCheckContext([], {});
    expect(audit.audit(ctx).status).toBe('fail');
  });

  it('fails when ai-catalog.json is invalid JSON', () => {
    const ctx = mockCheckContext([], {
      '/.well-known/ai-catalog.json': mockFetchResult('nope {{{', 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('not valid JSON');
  });
});
