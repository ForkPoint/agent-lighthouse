import { describe, it, expect } from 'vitest';
import { AiCatalogLinkAudit } from './ai-catalog-link';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

const doc = (head: string) => `<html lang="en"><head>${head}</head><body></body></html>`;

describe('AiCatalogLinkAudit', () => {
  const audit = new AiCatalogLinkAudit();

  it('passes when an AI Catalog alternate link is present', () => {
    const ctx = mockCheckContext([
      mockPageContext(
        'https://example.com/',
        doc(
          '<link rel="alternate" type="application/json" href="/ai-catalog.json" title="AI Catalog">',
        ),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('/ai-catalog.json');
  });

  it('fails when no AI Catalog link is present', () => {
    const ctx = mockCheckContext([mockPageContext('https://example.com/', doc(''))]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No AI Catalog link');
  });

  it('fails when there are no pages', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe('fail');
  });
});
