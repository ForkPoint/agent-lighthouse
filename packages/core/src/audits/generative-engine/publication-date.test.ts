import { describe, it, expect } from 'vitest';
import { PublicationDateAudit } from './publication-date';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('PublicationDateAudit', () => {
  const audit = new PublicationDateAudit();

  it('passes with a structured <time datetime> element', () => {
    const page = mockPageContext(
      'https://example.com/blog/my-post',
      `<html><body><article><time datetime="2025-01-15">January 15, 2025</time><p>Body</p></article></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('structured date');
  });

  it('passes with a visible date in main content text', () => {
    const page = mockPageContext(
      'https://example.com/blog/my-post',
      `<html><body><main><p>Published January 15, 2025 by us.</p></main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('Visible date found');
  });

  it('fails when a content page has no date', () => {
    const page = mockPageContext(
      'https://example.com/blog/my-post',
      `<html><body><main><p>This article has no date at all.</p></main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No visible publication date found');
  });

  it('is not-applicable when there are no article content pages', () => {
    const page = mockPageContext(
      'https://example.com/',
      `<html><body><p>Homepage content.</p></body></html>`,
      0,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('na');
    expect(result.message).toContain('No article content pages');
  });

  it('passes when a <time> element without datetime attribute has readable text', () => {
    const page = mockPageContext(
      'https://example.com/blog/my-post',
      `<html><body><main><p>Published <time>January 15, 2025</time>.</p></main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('structured date');
  });

  it('passes when date is in JSON-LD datePublished (no time element)', () => {
    const page = mockPageContext(
      'https://example.com/blog/my-post',
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Article","datePublished":"2025-01-15T10:00:00Z"}
        </script>
        <main><p>Article content without a visible time element.</p></main>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('JSON-LD');
  });

  it('passes when date is in article:published_time meta tag', () => {
    const page = mockPageContext(
      'https://example.com/blog/my-post',
      `<html>
        <head><meta property="article:published_time" content="2025-01-15T10:00:00Z"></head>
        <body><main><p>Article content without a time element.</p></main></body>
      </html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('meta');
  });

  it('handles invalid page URL gracefully in isArticleContentPage', () => {
    const page = mockPageContext(
      'https://example.com/blog/my-post',
      `<html><body><main><p>No date at all here.</p></main></body></html>`,
    );
    page.url = '::not-a-valid-url::';
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No visible publication date');
  });

  it('treats content page with XML-like body as not applicable', () => {
    const page = mockPageContext(
      'https://example.com/blog/my-post',
      `<html><body><main><p>content</p></main></body></html>`,
    );
    page.fetchResult.body = '<?xml version="1.0" encoding="UTF-8"?><sitemapindex></sitemapindex>';
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('na');
  });

  it('treats content page with .xml URL as not applicable', () => {
    const page = mockPageContext(
      'https://example.com/blog/my-post',
      `<html><body><main><p>content</p></main></body></html>`,
    );
    page.url = 'https://example.com/blog/feed.xml';
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('na');
  });

  it('passes when date found via JSON-LD inside @graph (covers findJsonLdDate false-branch)', () => {
    const page = mockPageContext(
      'https://example.com/blog/my-post',
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@graph":[{"@type":"Article","datePublished":"2025-01-15T10:00:00Z"}]}
        </script>
        <main><p>Article content without a time element.</p></main>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('JSON-LD');
  });

  it('passes when date is in dateModified (no datePublished) covering ?? chain in findJsonLdDate', () => {
    const page = mockPageContext(
      'https://example.com/blog/my-post',
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Article","dateModified":"2025-02-20T10:00:00Z"}
        </script>
        <main><p>Article content.</p></main>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
  });

  it('passes when date found via uploadDate field in JSON-LD', () => {
    const page = mockPageContext(
      'https://example.com/blog/my-post',
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"VideoObject","uploadDate":"2025-03-10"}
        </script>
        <main><p>Video content.</p></main>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
  });

  it('falls through when <time> element has no text and no datetime (covers if(v) false branch)', () => {
    const page = mockPageContext(
      'https://example.com/blog/my-post',
      `<html><body><main><p>Content without date. <time></time></p></main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No visible publication date');
  });
});
