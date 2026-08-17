import { describe, it, expect } from 'vitest';
import { WebSiteSearchActionAudit } from './website-search-action';
import { mockPageContext, mockCheckContext } from '../../__tests__/test-utils';

const ld = (obj: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
const page = (head: string) =>
  mockPageContext('https://example.com/', `<html><head>${head}</head><body></body></html>`, 0);

describe('WebSiteSearchActionAudit', () => {
  const audit = new WebSiteSearchActionAudit();

  it('fails when no WebSite schema is present', () => {
    const ctx = mockCheckContext([
      page(ld({ '@context': 'https://schema.org', '@type': 'Organization', name: 'Acme' })),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No WebSite schema found');
  });

  it('passes when WebSite has a SearchAction with a URL template', () => {
    const ctx = mockCheckContext([
      page(
        ld({
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          url: 'https://example.com',
          potentialAction: {
            '@type': 'SearchAction',
            target: 'https://example.com/search?q={search_term_string}',
            'query-input': 'required name=search_term_string',
          },
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('detects WebSite SearchAction in a top-level `[{...}]` array (Shopify-style)', () => {
    const ctx = mockCheckContext([
      page(
        ld([
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            url: 'https://example.com',
            potentialAction: {
              '@type': 'SearchAction',
              target: 'https://example.com/search?q={search_term_string}',
              'query-input': 'required name=search_term_string',
            },
          },
        ]),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('warns when WebSite lacks a proper SearchAction', () => {
    const ctx = mockCheckContext([
      page(
        ld({ '@context': 'https://schema.org', '@type': 'WebSite', url: 'https://example.com' }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('missing proper SearchAction');
  });

  it('warns when SearchAction target has no {placeholder}', () => {
    const ctx = mockCheckContext([
      page(
        ld({
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          url: 'https://example.com',
          potentialAction: {
            '@type': 'SearchAction',
            target: 'https://example.com/search',
          },
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
  });

  it('detects WebSite with array @type (Array.isArray branch in matchesType)', () => {
    const ctx = mockCheckContext([
      page(
        ld({
          '@context': 'https://schema.org',
          '@type': ['WebSite', 'WebPage'],
          url: 'https://example.com',
          potentialAction: {
            '@type': 'SearchAction',
            target: 'https://example.com/search?q={search_term_string}',
            'query-input': 'required name=search_term_string',
          },
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('handles a schema without @type alongside WebSite (return false branch)', () => {
    // A typeless schema makes matchesType reach its final `return false`.
    // The valid WebSite schema still drives the result.
    const ctx = mockCheckContext([
      page(
        ld([
          { name: 'Untyped metadata' },
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            url: 'https://example.com',
            potentialAction: {
              '@type': 'SearchAction',
              target: 'https://example.com/search?q={search_term_string}',
              'query-input': 'required name=search_term_string',
            },
          },
        ]),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });
});
