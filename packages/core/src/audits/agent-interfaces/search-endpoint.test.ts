import { describe, it, expect } from 'vitest';
import { SearchEndpointAudit } from './search-endpoint';
import { mockCheckContext, mockPageContext, mockFetchResult } from '../../__tests__/test-utils';
import type { PageContext } from '../../check-context';

const ld = (obj: unknown) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
const page = (head: string, url = 'https://example.com/'): PageContext =>
  mockPageContext(url, `<html><head>${head}</head><body></body></html>`);

const RESULTS_HTML = '<html><body><ol class="results"><li>Pricing</li></ol></body></html>';

function pageWithSearchAction() {
  return page(
    ld({
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
    }),
  );
}

describe('SearchEndpointAudit', () => {
  const audit = new SearchEndpointAudit();

  // ── Schema.org SearchAction half ────────────────────────────

  it('passes when a SearchAction endpoint returns HTTP 200 with results', async () => {
    const ctx = mockCheckContext([pageWithSearchAction()]);
    ctx.fetch = async () => mockFetchResult(RESULTS_HTML, 200, 'text/html');
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

  it('warns distinctly when the search endpoint is gated behind auth or a WAF', async () => {
    const ctx = mockCheckContext([pageWithSearchAction()]);
    ctx.fetch = async () => mockFetchResult('Access denied', 403, 'text/html');
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('gated');
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

  it('warns when a 200 response is an empty SPA shell rather than results', async () => {
    const ctx = mockCheckContext([pageWithSearchAction()]);
    ctx.fetch = async () =>
      mockFetchResult(
        '<html><head><script src="/app.js"></script></head><body><div id="root"></div></body></html>',
        200,
        'text/html',
      );
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('no results');
  });

  it('warns when a 200 JSON response carries an empty result array', async () => {
    const ctx = mockCheckContext([pageWithSearchAction()]);
    ctx.fetch = async () =>
      mockFetchResult(JSON.stringify({ results: [], total: 0 }), 200, 'application/json');
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('no results');
  });

  it('passes on a 200 JSON response carrying a non-empty result array', async () => {
    const ctx = mockCheckContext([pageWithSearchAction()]);
    ctx.fetch = async () =>
      mockFetchResult(JSON.stringify({ results: [{ title: 'Pricing' }] }), 200, 'application/json');
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('finds SearchAction when potentialAction is an array (Yoast/Rank Math shape)', async () => {
    const ctx = mockCheckContext([
      page(
        ld({
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          potentialAction: [
            { '@type': 'ReadAction', target: 'https://example.com/' },
            {
              '@type': 'SearchAction',
              target: 'https://example.com/search?q={search_term_string}',
              'query-input': 'required name=search_term_string',
            },
          ],
        }),
      ),
    ]);
    ctx.fetch = async () => mockFetchResult(RESULTS_HTML, 200, 'text/html');
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('finds SearchAction on a WebSite node whose @type is an array', async () => {
    const ctx = mockCheckContext([
      page(
        ld({
          '@context': 'https://schema.org',
          '@type': ['WebSite', 'Organization'],
          potentialAction: {
            '@type': ['SearchAction'],
            target: 'https://example.com/search?q={search_term_string}',
          },
        }),
      ),
    ]);
    ctx.fetch = async () => mockFetchResult(RESULTS_HTML, 200, 'text/html');
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('substitutes every placeholder in a multi-placeholder urlTemplate', async () => {
    const ctx = mockCheckContext([
      page(
        ld({
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          potentialAction: {
            '@type': 'SearchAction',
            target: 'https://example.com/search?q={search_term_string}&lang={lang}',
          },
        }),
      ),
    ]);
    let requested = '';
    ctx.fetch = async ({ url }) => {
      requested = url;
      return mockFetchResult(RESULTS_HTML, 200, 'text/html');
    };
    const result = await audit.audit(ctx);
    expect(requested).not.toContain('{');
    expect(result.status).toBe('pass');
  });

  it('finds a SearchAction nested outside @graph (mainEntity) via the shared flattener', async () => {
    const ctx = mockCheckContext([
      page(
        ld({
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          mainEntity: {
            '@type': 'WebSite',
            potentialAction: {
              '@type': 'SearchAction',
              target: { '@type': 'EntryPoint', urlTemplate: 'https://example.com/s?q={q}' },
            },
          },
        }),
      ),
    ]);
    ctx.fetch = async () => mockFetchResult(RESULTS_HTML, 200, 'text/html');
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('reads SearchAction from structuredData when the page provides it', async () => {
    const p = page('');
    p.structuredData = [
      {
        '@type': 'WebSite',
        potentialAction: {
          '@type': 'SearchAction',
          target: 'https://example.com/search?q={search_term_string}',
        },
      },
    ];
    const ctx = mockCheckContext([p]);
    ctx.fetch = async () => mockFetchResult(RESULTS_HTML, 200, 'text/html');
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('scans every WebSite node, not just the first', async () => {
    const ctx = mockCheckContext([
      page(
        ld([
          { '@context': 'https://schema.org', '@type': 'WebSite', url: 'https://example.com' },
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            potentialAction: {
              '@type': 'SearchAction',
              target: 'https://example.com/search?q={search_term_string}',
            },
          },
        ]),
      ),
    ]);
    ctx.fetch = async () => mockFetchResult(RESULTS_HTML, 200, 'text/html');
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  // ── absorbed website-search-action (3.4): declared-but-incomplete markup ──

  it('warns when a WebSite node declares no SearchAction at all', async () => {
    const ctx = mockCheckContext([
      page(ld({ '@context': 'https://schema.org', '@type': 'WebSite', url: 'https://example.com' })),
    ]);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('no SearchAction');
  });

  it('warns when a SearchAction target carries no query placeholder', async () => {
    const ctx = mockCheckContext([
      page(
        ld({
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          potentialAction: { '@type': 'SearchAction', target: 'https://example.com/search' },
        }),
      ),
    ]);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('no query placeholder');
  });

  it('warns when an EntryPoint target has no urlTemplate', async () => {
    const ctx = mockCheckContext([
      page(
        ld({
          '@type': 'WebSite',
          potentialAction: {
            '@type': 'SearchAction',
            target: { '@type': 'EntryPoint', url: 'https://example.com/search' },
          },
        }),
      ),
    ]);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('warn');
  });

  // ── OpenAPI half ────────────────────────────────────────────

  it('passes when OpenAPI has a GET search endpoint', async () => {
    const spec = JSON.stringify({ paths: { '/search': { get: { operationId: 'search' } } } });
    const ctx = mockCheckContext([page('')], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('GET search endpoint');
  });

  it('matches a search path segment, not a substring of another word', async () => {
    const spec = JSON.stringify({
      paths: {
        '/research/papers': { get: { operationId: 'listPapers' } },
        '/searchindex/status': { get: { operationId: 'indexStatus' } },
      },
    });
    const ctx = mockCheckContext([page('')], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
  });

  it('matches a hyphenated search path segment', async () => {
    const spec = JSON.stringify({
      paths: { '/api/product-search': { get: { operationId: 'productSearch' } } },
    });
    const ctx = mockCheckContext([page('')], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('ignores a non-GET search operation', async () => {
    const spec = JSON.stringify({ paths: { '/search': { post: { operationId: 'search' } } } });
    const ctx = mockCheckContext([page('')], { '/openapi.json': mockFetchResult(spec, 200) });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
  });

  // ── nothing at all ──────────────────────────────────────────

  it('fails when no search endpoint is found', async () => {
    const ctx = mockCheckContext([page('')]);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No search endpoint');
  });

  it('fails when JSON-LD has a non-matching type and no OpenAPI search endpoint', async () => {
    const ctx = mockCheckContext([page(ld({ '@type': 'Organization', name: 'Test Corp' }))]);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
  });

  it('fails when openapi.json has invalid JSON and no JSON-LD search action', async () => {
    const ctx = mockCheckContext([page('')], {
      '/openapi.json': mockFetchResult('invalid json {{{', 200),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
  });

  it('fails when the spec has no paths key', async () => {
    const ctx = mockCheckContext([page('')], {
      '/openapi.json': mockFetchResult(JSON.stringify({ openapi: '3.0.3', info: {} }), 200),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
  });

  it('fails when a paths entry is not an object', async () => {
    const ctx = mockCheckContext([page('')], {
      '/openapi.json': mockFetchResult(JSON.stringify({ paths: { '/null-path': null } }), 200),
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
  });

  it('handles a null JSON-LD block gracefully', async () => {
    const ctx = mockCheckContext([page('<script type="application/ld+json">null</script>')]);
    const result = await audit.audit(ctx);
    expect(result.status).toBe('fail');
  });
});
