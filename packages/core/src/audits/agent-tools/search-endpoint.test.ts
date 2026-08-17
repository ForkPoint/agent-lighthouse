import { describe, it, expect } from 'vitest';
import { SearchEndpointAudit } from './search-endpoint';
import { mockCheckContext, mockPageContext, mockFetchResult } from '../../__tests__/test-utils';

function pageWithSearchAction() {
  const ld = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    url: 'https://example.com',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://example.com/search?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  });
  return mockPageContext(
    'https://example.com',
    `<html><head><script type="application/ld+json">${ld}</script></head><body></body></html>`,
  );
}

describe('SearchEndpointAudit', () => {
  const audit = new SearchEndpointAudit();

  it('passes when a SearchAction endpoint returns HTTP 200', async () => {
    const ctx = mockCheckContext([pageWithSearchAction()]);
    ctx.fetch = async () => mockFetchResult('results', 200);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('functional');
  });

  it('warns when the SearchAction endpoint returns a non-200 status', async () => {
    const ctx = mockCheckContext([pageWithSearchAction()]);
    ctx.fetch = async () => mockFetchResult('', 404);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('HTTP 404');
  });

  it('warns when the SearchAction endpoint is unreachable', async () => {
    const ctx = mockCheckContext([pageWithSearchAction()]);
    ctx.fetch = async () => {
      throw new Error('network');
    };
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('could not be reached');
  });

  it('passes when OpenAPI has a GET search endpoint', async () => {
    const spec = JSON.stringify({ paths: { '/search': { get: { operationId: 'search' } } } });
    const page = mockPageContext('https://example.com', '<html><body></body></html>');
    const ctx = mockCheckContext([page], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('GET search endpoint');
  });

  it('fails when no search endpoint is found', async () => {
    const page = mockPageContext('https://example.com', '<html><body></body></html>');
    const ctx = mockCheckContext([page]);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No functional search endpoint');
  });

  it('finds SearchAction when potentialAction target is a plain string URL', async () => {
    const ld = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      potentialAction: {
        '@type': 'SearchAction',
        target: 'https://example.com/search?q={search_term}',
      },
    });
    const page = mockPageContext(
      'https://example.com',
      `<html><head><script type="application/ld+json">${ld}</script></head><body></body></html>`,
    );
    const ctx = mockCheckContext([page]);
    ctx.fetch = async () => mockFetchResult('results', 200);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('finds SearchAction via @graph recursion with object target', async () => {
    const ld = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: 'https://example.com/s?q={q}' },
        },
      ],
    });
    const page = mockPageContext(
      'https://example.com',
      `<html><head><script type="application/ld+json">${ld}</script></head><body></body></html>`,
    );
    const ctx = mockCheckContext([page]);
    ctx.fetch = async () => mockFetchResult('results', 200);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('finds direct root-level SearchAction with string target', async () => {
    const ld = JSON.stringify({
      '@type': 'SearchAction',
      target: 'https://example.com/search?q={search_term}',
    });
    const page = mockPageContext(
      'https://example.com',
      `<html><head><script type="application/ld+json">${ld}</script></head><body></body></html>`,
    );
    const ctx = mockCheckContext([page]);
    ctx.fetch = async () => mockFetchResult('results', 200);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('fails when JSON-LD has a non-matching type and no OpenAPI search endpoint', async () => {
    const ld = JSON.stringify({ '@type': 'Organization', name: 'Test Corp' });
    const page = mockPageContext(
      'https://example.com',
      `<html><head><script type="application/ld+json">${ld}</script></head><body></body></html>`,
    );
    const ctx = mockCheckContext([page]);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
  });

  it('fails when openapi.json has invalid JSON and no JSON-LD search action', async () => {
    const page = mockPageContext('https://example.com', '<html><body></body></html>');
    const ctx = mockCheckContext([page], {
      '/openapi.json': mockFetchResult('invalid json {{{', 200),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
  });

  it('fails when openapi.json spec has no paths key and no JSON-LD', async () => {
    const page = mockPageContext('https://example.com', '<html><body></body></html>');
    const ctx = mockCheckContext([page], {
      '/openapi.json': mockFetchResult(JSON.stringify({ openapi: '3.0.3', info: {} }), 200),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
  });

  it('fails when spec has a paths entry that is not an object and no JSON-LD', async () => {
    const page = mockPageContext('https://example.com', '<html><body></body></html>');
    const ctx = mockCheckContext([page], {
      '/openapi.json': mockFetchResult(JSON.stringify({ paths: { '/null-path': null } }), 200),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
  });

  it('does not find search URL when direct SearchAction has object target without urlTemplate', async () => {
    const ld = JSON.stringify({
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', url: 'https://example.com/search' },
    });
    const page = mockPageContext(
      'https://example.com',
      `<html><head><script type="application/ld+json">${ld}</script></head><body></body></html>`,
    );
    const ctx = mockCheckContext([page]);
    const result = await audit.audit(ctx);
    // Has object target without urlTemplate → falls through to fail
    expect(result.status).toBe('fail');
  });

  it('returns fail when @graph items contain no SearchAction', async () => {
    const ld = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'Organization', name: 'Test Corp' },
      ],
    });
    const page = mockPageContext(
      'https://example.com',
      `<html><head><script type="application/ld+json">${ld}</script></head><body></body></html>`,
    );
    const ctx = mockCheckContext([page]);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
  });

  it('fails when OpenAPI has only non-search GET endpoints', async () => {
    const spec = JSON.stringify({
      paths: { '/products': { get: { operationId: 'listProducts' } } },
    });
    const page = mockPageContext('https://example.com', '<html><body></body></html>');
    const ctx = mockCheckContext([page], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
  });

  it('handles non-object JSON-LD item gracefully', async () => {
    // JSON-LD containing null — extractJsonLd pushes null into blocks array
    const page = mockPageContext(
      'https://example.com',
      `<html><head><script type="application/ld+json">null</script></head><body></body></html>`,
    );
    const ctx = mockCheckContext([page]);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
  });

  it('does not find search URL when WebSite potentialAction target is object without urlTemplate', async () => {
    const ld = JSON.stringify({
      '@type': 'WebSite',
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', url: 'https://example.com/search' },
      },
    });
    const page = mockPageContext(
      'https://example.com',
      `<html><head><script type="application/ld+json">${ld}</script></head><body></body></html>`,
    );
    const ctx = mockCheckContext([page]);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
  });
});
