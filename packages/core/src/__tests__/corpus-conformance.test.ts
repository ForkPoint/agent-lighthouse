import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseHtml, extractJsonLd, flattenJsonLd, extractMetaTags, extractHeadLinks } from '../parser';
import { runAudits } from '../audit-runner';
import { defaultConfig } from '../audit-config';
import type { CheckContext, PageContext } from '../check-context';
import type { FetchResult } from '../fetcher';

function loadFixture(filename: string): string {
  return readFileSync(resolve(__dirname, '../../test-data/corpus', filename), 'utf8');
}

function createMockFetch(status = 200, body = '', headers: Record<string, string> = {}): FetchResult {
  return {
    url: 'https://example.com',
    finalUrl: 'https://example.com',
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body,
    ttfbMs: 45,
    totalMs: 60,
    contentType: headers['content-type'] ?? 'text/html; charset=utf-8',
    contentLength: Buffer.byteLength(body),
  };
}

function buildPageContext(url: string, html: string, pageType: PageContext['pageType'] = 'product'): PageContext {
  const $ = parseHtml(html);
  const jsonLdBlocks = extractJsonLd($);
  const jsonLd = flattenJsonLd(jsonLdBlocks);
  const meta = extractMetaTags($);
  const headLinks = extractHeadLinks($);

  return {
    url,
    pageType,
    fetchResult: createMockFetch(200, html),
    $,
    jsonLd,
    meta,
    headLinks,
  };
}

/**
 * A faithful markdown mirror of a fixture's own block text.
 *
 * `content-extraction/markdown-alternate` scores a markdown document against
 * the page it claims to mirror, so an integration fixture needs a real one to
 * exercise the scored path. Deriving it from the fixture keeps the two in step:
 * headings become ATX headings, every other innermost block becomes a
 * paragraph, in document order.
 */
function markdownMirror(html: string): string {
  const $ = parseHtml(html);
  const blocks = 'h1, h2, h3, h4, h5, h6, p, li, td, th, caption, figcaption, blockquote, dt, dd';
  return $('body')
    .find(blocks)
    .toArray()
    .filter((el) => $(el).find(blocks).length === 0)
    .map((el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (!text) return '';
      const level = /^h([1-6])$/i.exec(el.tagName ?? '')?.[1];
      return level ? `${'#'.repeat(Number(level))} ${text}` : text;
    })
    .filter(Boolean)
    .join('\n\n');
}

function buildTestContext(baseUrl: string, pages: PageContext[], rootFiles: Record<string, FetchResult> = {}): CheckContext {
  return {
    baseUrl,
    domain: new URL(baseUrl).hostname,
    pages,
    rootFiles,
    fetch: async () => createMockFetch(200, ''),
  };
}

describe('Golden Corpus Conformance Tests (False-Positive Elimination)', () => {
  it('correctly evaluates complex Shopify nested @graph without false positives', async () => {
    const html = loadFixture('shopify-store.html');
    const page = buildPageContext('https://acme-outfitters.com/products/alpine-windbreaker', html, 'product');
    const ctx = buildTestContext('https://acme-outfitters.com', [page]);

    const { checks } = await runAudits(ctx, defaultConfig);
    const checkMap = new Map(checks.map((c) => [c.id, c]));

    // JSON-LD Present (3.1)
    expect(checkMap.get('structured-data/json-ld-present')?.status).toBe('pass');

    // Schema Validation (3.2)
    expect(checkMap.get('structured-data/schema-validation')?.status).toBe('pass');

    // Product Identifiers (SKU/GTIN) (3.21)
    expect(checkMap.get('agentic-commerce/product-identifiers')?.status).toBe('pass');

    // Product Details (3.22)
    expect(checkMap.get('structured-data/advanced-product-details')?.status).toBe('pass');

    // Open Graph Title, Image & Alt (4.6, 4.9)
    expect(checkMap.get('answer-readiness/core-open-graph')?.status).toBe('pass');
    expect(checkMap.get('answer-readiness/og-image-alt')?.status).toBe('pass');

    // Semantic Tables (6.9)
    expect(checkMap.get('content-extraction/data-tables')?.status).toBe('pass');

    // Form No-JS / Actionable Form (operability-safety)
    expect(checkMap.get('operability-safety/forms-no-js')?.status).toBe('pass');
  });

  it('correctly evaluates SaaS / Documentation fixtures with OpenAPI & Code blocks', async () => {
    const html = loadFixture('docs-platform.html');
    const page = buildPageContext('https://docs.cloudstack.dev/api/authentication', html, 'content');

    const ctx = buildTestContext('https://docs.cloudstack.dev', [page], {
      '/llms.txt': createMockFetch(200, '# CloudStack Docs\n\n> AI-first documentation.\n\n## Pages\n- [API](/api): Endpoints'),
      '/openapi.json': createMockFetch(200, JSON.stringify({ openapi: '3.1.0', info: { title: 'CloudStack API', version: '1.0' }, paths: {} }), { 'content-type': 'application/json' }),
    });
    // The fixture declares the alternate at line 9; serve it, so the markdown
    // audit exercises its scored path rather than reporting not-applicable.
    ctx.fetch = async ({ url }) =>
      url === 'https://docs.cloudstack.dev/api/authentication.md'
        ? createMockFetch(200, markdownMirror(html), { 'content-type': 'text/markdown' })
        : createMockFetch(404, '');

    const { checks } = await runAudits(ctx, defaultConfig);
    const checkMap = new Map(checks.map((c) => [c.id, c]));

    // llms.txt exists (1.1)
    expect(checkMap.get('machine-discovery/llms-txt-exists')?.status).toBe('pass');

    // OpenAPI exists (5.1)
    expect(checkMap.get('agent-interfaces/openapi-exists')?.status).toBe('pass');

    // Markdown Alternate Link (4.15) — warn, not pass: the fixture's own prose
    // carries the literal placeholder `<TOKEN>`, which the audit reports as an
    // unresolved component tag. The scored path is what matters here; before
    // the alternate was served this check reported `na`.
    expect(checkMap.get('content-extraction/markdown-alternate')?.status).toBe('warn');

    // Code Language Specified (6.10)
    expect(checkMap.get('content-extraction/code-language')?.status).toBe('pass');
  });

  it('accurately identifies Client-Side SPAs vs Server-Rendered pages', async () => {
    const html = loadFixture('spa-edge-case.html');
    const page = buildPageContext('https://spa-example.com', html, 'homepage');
    const ctx = buildTestContext('https://spa-example.com', [page]);

    const { checks } = await runAudits(ctx, defaultConfig);
    const checkMap = new Map(checks.map((c) => [c.id, c]));

    // Server-Rendered Audit (8.13) must fail for empty CSR div
    expect(checkMap.get('content-extraction/server-rendered')?.status).toBe('fail');
  });
});
