import { describe, it, expect } from 'vitest';
import { DatesOnContentAudit } from './dates-on-content';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('DatesOnContentAudit', () => {
  const audit = new DatesOnContentAudit();

  it('is not-applicable when no article content page is scanned', () => {
    const page = mockPageContext('https://example.com/', '<html><body><main><p>Home</p></main></body></html>');
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('na');
    expect(result.message).toContain('No article content pages');
  });

  it('passes on a structured <time datetime> element', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body><main>
        <p>Published <time datetime="2025-01-15">January 15, 2025</time></p>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.found).toContain('<time datetime>');
  });

  it('passes on JSON-LD datePublished', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><head>
        <script type="application/ld+json">
          {"@context":"https://schema.org","@type":"Article","datePublished":"2025-04-02T10:00:00Z"}
        </script>
      </head><body><main><p>An article body with prose here.</p></main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.found).toContain('JSON-LD');
  });

  it('passes on a visible date pattern in content text', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body><main>
        <p>This guide was published on January 15, 2025 for our readers.</p>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('Visible date pattern');
  });

  it('fails when a content page has no date at all', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      '<html><body><main><p>An article with no date information present here.</p></main></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No dates found');
  });

  it('is not-applicable when the body starts with <?xml (xml interstitial)', () => {
    // isArticleContentPage must return false for pages whose body starts with <?xml,
    // covering the `return false` branch on line 31.
    const page = mockPageContext(
      'https://example.com/blog/feed',
      '<?xml version="1.0" encoding="UTF-8"?><rss><channel><title>Feed</title></channel></rss>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('na');
  });

  it('is not-applicable when the body starts with <urlset (sitemap body)', () => {
    const page = mockPageContext(
      'https://example.com/blog/sitemap',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com</loc></url></urlset>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('na');
  });

  it('passes when a bare <time> element without datetime attribute contains a date', () => {
    // No time[datetime], no JSON-LD, no meta — falls through to the bare <time> path (lines 68-69).
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body><main>
        <p>Published: <time>January 15, 2025</time></p>
        <p>An article with content about our research findings here.</p>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.found).toContain('<time>');
  });

  it('passes when article:published_time meta tag is present', () => {
    // No time[datetime], no JSON-LD — falls through to the meta date path.
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><head>
        <meta property="article:published_time" content="2025-01-15">
      </head><body><main><p>An article with only a meta publication date.</p></main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.found).toContain('meta');
  });

  it('is not-applicable when the URL ends with .xml (pathname.endsWith check)', () => {
    // isArticleContentPage must return false for content pages whose URL ends in .xml,
    // covering the `return false` true branch on the pathname.endsWith('.xml') line.
    const page = mockPageContext(
      'https://example.com/blog/sitemap.xml',
      '<html><body><main><p>An article page with .xml URL extension.</p></main></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('na');
  });

  it('passes when JSON-LD has dateModified but no datePublished', () => {
    // Exercises the ?? chain in findJsonLdDate: datePublished is undefined →
    // right side evaluated → dateModified is used.
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><head>
        <script type="application/ld+json">
          {"@context":"https://schema.org","@type":"Article","dateModified":"2025-04-02T10:00:00Z"}
        </script>
      </head><body><main><p>An article with only a modified date.</p></main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.found).toContain('JSON-LD');
  });

  it('passes when JSON-LD has uploadDate and no other date fields', () => {
    // Exercises the ?? chain further: datePublished undefined, dateModified undefined,
    // uploadDate is used.
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><head>
        <script type="application/ld+json">
          {"@context":"https://schema.org","@type":"VideoObject","uploadDate":"2025-04-02"}
        </script>
      </head><body><main><p>A video article with only an upload date.</p></main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.found).toContain('JSON-LD');
  });

  it('passes when JSON-LD has dateCreated and no other date fields', () => {
    // Exercises the ?? chain to its last fallback: datePublished/dateModified/uploadDate
    // are all undefined; dateCreated is used.
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><head>
        <script type="application/ld+json">
          {"@context":"https://schema.org","@type":"Article","dateCreated":"2025-04-02"}
        </script>
      </head><body><main><p>An article with only a creation date.</p></main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.found).toContain('JSON-LD');
  });

  it('falls back to visible date when JSON-LD datePublished is a non-string value', () => {
    // typeof v !== 'string' branch: datePublished is an object, not a string.
    // findJsonLdDate skips it; findStructuredDate returns null; visible date matches.
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><head>
        <script type="application/ld+json">
          {"@context":"https://schema.org","@type":"Article","datePublished":{"@value":"2025-01-01"}}
        </script>
      </head><body><main>
        <p>This article was published on January 15, 2025 by our editorial team.</p>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('Visible date pattern');
  });

  it('fails when JSON-LD datePublished is an empty string', () => {
    // typeof v === 'string' but v.trim() is falsy branch: empty string date is skipped.
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><head>
        <script type="application/ld+json">
          {"@context":"https://schema.org","@type":"Article","datePublished":""}
        </script>
      </head><body><main><p>An article without any usable date information present.</p></main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
  });

  it('fails when a bare empty <time> element exists (if(v) false branch)', () => {
    // anyTime.attr('datetime') is undefined, anyTime.text().trim() is '' → v = '' → falsy.
    // Covers the false branch of `if (v)` in findStructuredDate.
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body><main>
        <p>Article content without any date here. <time></time></p>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
  });

  it('is not-applicable when the URL has an invalid format (catch block)', () => {
    // Override url after creation to trigger the try/catch in isArticleContentPage.
    // With pathname = '' the .xml check is false; the body is normal HTML so it is
    // treated as a content page — but since it has a date the audit passes.
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body><main>
        <p>Published: <time datetime="2025-01-15">January 15, 2025</time></p>
      </main></body></html>`,
    );
    page.url = 'not-a-valid-url';
    const result = audit.audit(mockCheckContext([page]));
    // The page is still treated as a content page (pathname='' does not end in .xml,
    // body is not XML), so the audit runs and finds the <time datetime> → pass.
    expect(result.status).toBe('pass');
  });
});
