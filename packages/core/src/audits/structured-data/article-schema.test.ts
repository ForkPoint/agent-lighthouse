import { describe, it, expect } from 'vitest';
import { ArticleSchemaAudit } from './article-schema';
import { mockPageContext, mockCheckContext } from '../../__tests__/test-utils';

const ld = (obj: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
// A /blog/* URL (not the first page) is classified as a content page.
const contentPage = (head: string) =>
  mockPageContext('https://example.com/blog/my-post', `<html><head>${head}</head><body></body></html>`, 1);

const completeArticle = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'A Title',
  datePublished: '2025-01-01',
  dateModified: '2025-01-02',
  author: { '@type': 'Person', name: 'Jane' },
};

describe('ArticleSchemaAudit', () => {
  const audit = new ArticleSchemaAudit();

  it('is not applicable when there are no content/article pages', () => {
    const ctx = mockCheckContext([]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('na');
    expect(result.message).toContain('No blog/content pages');
  });

  it('passes when a content page has a complete Article schema', () => {
    const ctx = mockCheckContext([contentPage(ld(completeArticle))]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('detects a complete Article wrapped in a top-level array', () => {
    const ctx = mockCheckContext([contentPage(ld([completeArticle]))]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('detects a complete Article nested inside @graph', () => {
    const ctx = mockCheckContext([
      contentPage(ld({ '@context': 'https://schema.org', '@graph': [completeArticle] })),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('warns when the Article is partial (missing dateModified)', () => {
    const ctx = mockCheckContext([
      contentPage(
        ld({
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: 'A Title',
          datePublished: '2025-01-01',
          author: { '@type': 'Person', name: 'Jane' },
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('warn');
    // 0 complete + 1 partial: the page has an Article, but not all required props.
    expect(result.message).toContain('0 complete');
  });

  it('fails when a content page has no Article schema', () => {
    const ctx = mockCheckContext([
      contentPage(ld({ '@context': 'https://schema.org', '@type': 'Organization', name: 'Acme' })),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No Article schema found');
  });

  it('detects a complete Article schema with array @type', () => {
    // Covers the Array.isArray(@type) branch in matchesAnyType
    const ctx = mockCheckContext([
      contentPage(
        ld({
          '@context': 'https://schema.org',
          '@type': ['Article', 'NewsArticle'],
          headline: 'A Title',
          datePublished: '2025-01-01',
          dateModified: '2025-01-02',
          author: { '@type': 'Person', name: 'Jane' },
        }),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });

  it('detects an article page via Article schema on a non-content-typed page', () => {
    // Covers the isArticlePage schema-detection path (schemas.some callback)
    // A homepage (index 0) has pageType 'homepage', not 'content', but if it
    // carries Article JSON-LD isArticlePage should still return true.
    const ctx = mockCheckContext([
      mockPageContext(
        'https://example.com/',
        `<html><head>${ld(completeArticle)}</head><body></body></html>`,
        0,
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
  });
});
