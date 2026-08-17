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
    expect(checkMap.get('3.1')?.status).toBe('pass');

    // Schema Validation (3.2)
    expect(checkMap.get('3.2')?.status).toBe('pass');

    // Product Identifiers (SKU/GTIN) (3.21)
    expect(checkMap.get('3.21')?.status).toBe('pass');

    // Product Details (3.22)
    expect(checkMap.get('3.22')?.status).toBe('pass');

    // Open Graph Title, Image & Alt (4.6, 4.9)
    expect(checkMap.get('4.6')?.status).toBe('pass');
    expect(checkMap.get('4.9')?.status).toBe('pass');

    // Semantic Tables (6.9)
    expect(checkMap.get('6.9')?.status).toBe('pass');

    // Form No-JS / Actionable Form (5.19)
    expect(checkMap.get('5.19')?.status).toBe('pass');
  });

  it('correctly evaluates SaaS / Documentation fixtures with OpenAPI & Code blocks', async () => {
    const html = loadFixture('docs-platform.html');
    const page = buildPageContext('https://docs.cloudstack.dev/api/authentication', html, 'content');

    const ctx = buildTestContext('https://docs.cloudstack.dev', [page], {
      '/llms.txt': createMockFetch(200, '# CloudStack Docs\n\n> AI-first documentation.\n\n## Pages\n- [API](/api): Endpoints'),
      '/openapi.json': createMockFetch(200, JSON.stringify({ openapi: '3.1.0', info: { title: 'CloudStack API', version: '1.0' }, paths: {} }), { 'content-type': 'application/json' }),
    });

    const { checks } = await runAudits(ctx, defaultConfig);
    const checkMap = new Map(checks.map((c) => [c.id, c]));

    // llms.txt exists (1.1)
    expect(checkMap.get('1.1')?.status).toBe('pass');

    // OpenAPI exists (5.1)
    expect(checkMap.get('5.1')?.status).toBe('pass');

    // MCP Discovery Link (4.17)
    expect(checkMap.get('4.17')?.status).toBe('pass');

    // Markdown Alternate Link (4.15)
    expect(checkMap.get('4.15')?.status).toBe('pass');

    // Code Language Specified (6.10)
    expect(checkMap.get('6.10')?.status).toBe('pass');
  });

  it('accurately identifies Client-Side SPAs vs Server-Rendered pages', async () => {
    const html = loadFixture('spa-edge-case.html');
    const page = buildPageContext('https://spa-example.com', html, 'homepage');
    const ctx = buildTestContext('https://spa-example.com', [page]);

    const { checks } = await runAudits(ctx, defaultConfig);
    const checkMap = new Map(checks.map((c) => [c.id, c]));

    // Server-Rendered Audit (8.13) must fail for empty CSR div
    expect(checkMap.get('8.13')?.status).toBe('fail');
  });
});
