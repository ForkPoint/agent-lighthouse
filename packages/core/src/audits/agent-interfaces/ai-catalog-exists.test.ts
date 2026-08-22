import { describe, it, expect } from 'vitest';
import { AiCatalogExistsAudit } from './ai-catalog-exists';
import { mockCheckContext, mockPageContext, mockFetchResult } from '../../__tests__/test-utils';
import type { PageContext } from '../../check-context';

const CATALOG = JSON.stringify({ name: 'Site', services: [{ name: 'Search' }] });

const page = (head: string, url = 'https://example.com/', index = 0): PageContext =>
  mockPageContext(url, `<html><head>${head}</head><body></body></html>`, index);

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

  // ── absorbed ai-catalog-link (4.19): the rel="ai-catalog" advertisement ──

  it('warns when a rel="ai-catalog" link advertises a catalog the well-known path does not serve', () => {
    const ctx = mockCheckContext([page('<link rel="ai-catalog" href="/ai-catalog.json">')], {
      '/.well-known/ai-catalog.json': mockFetchResult('', 404),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('/ai-catalog.json');
  });

  it('matches the rel token case-insensitively and inside a multi-token rel', () => {
    const ctx = mockCheckContext(
      [
        page(
          '<link rel="Alternate AI-Catalog" type="application/ai-catalog+json" href="/c.json">',
        ),
      ],
      { '/.well-known/ai-catalog.json': mockFetchResult('', 404) },
    );
    expect(audit.audit(ctx).status).toBe('warn');
  });

  it('accepts an HTTP Link header advertising the catalog', () => {
    const p = page('');
    p.fetchResult.headers['link'] = '</ai-catalog.json>; rel="ai-catalog"';
    const ctx = mockCheckContext([p], {
      '/.well-known/ai-catalog.json': mockFetchResult('', 404),
    });
    expect(audit.audit(ctx).status).toBe('warn');
  });

  it('finds the advertisement on any crawled page, not only the homepage', () => {
    const ctx = mockCheckContext(
      [
        page(''),
        page('<link rel="ai-catalog" href="/c.json">', 'https://example.com/developers', 1),
      ],
      { '/.well-known/ai-catalog.json': mockFetchResult('', 404) },
    );
    expect(audit.audit(ctx).status).toBe('warn');
  });

  it('does not treat the old title-matched alternate link as an advertisement', () => {
    const ctx = mockCheckContext(
      [
        page(
          '<link rel="alternate" type="application/json" href="/c.json" title="AI Catalog">',
        ),
      ],
      { '/.well-known/ai-catalog.json': mockFetchResult('', 404) },
    );
    expect(audit.audit(ctx).status).toBe('fail');
  });

  it('reports the advertisement alongside a valid well-known catalog', () => {
    const ctx = mockCheckContext([page('<link rel="ai-catalog" href="/ai-catalog.json">')], {
      '/.well-known/ai-catalog.json': mockFetchResult(CATALOG, 200, 'application/json'),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.found).toContain('rel="ai-catalog"');
  });

  it('still passes on the well-known catalog with no advertisement at all', () => {
    const ctx = mockCheckContext([page('')], {
      '/.well-known/ai-catalog.json': mockFetchResult(CATALOG, 200, 'application/json'),
    });
    expect(audit.audit(ctx).status).toBe('pass');
  });
});
