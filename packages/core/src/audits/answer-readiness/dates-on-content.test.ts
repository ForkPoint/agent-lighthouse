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

  it('warns on a publication-only <time datetime> element', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body><main>
        <p>Published <time datetime="2025-01-15">January 15, 2025</time></p>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('warn');
    expect(result.score).toBe(0.5);
    expect(result.found).toContain('<time datetime>');
  });

  it('warns on JSON-LD datePublished with no modification date', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><head>
        <script type="application/ld+json">
          {"@context":"https://schema.org","@type":"Article","datePublished":"2025-04-02T10:00:00Z"}
        </script>
      </head><body><main><p>An article body with prose here.</p></main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('warn');
    expect(result.found).toContain('JSON-LD');
  });

  it('warns on a visible date pattern in content text', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body><main>
        <p>This guide was published on January 15, 2025 for our readers.</p>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('publication date');
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

  it('warns when a bare <time> element without datetime attribute contains a date', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body><main>
        <p>Published: <time>January 15, 2025</time></p>
        <p>An article with content about our research findings here.</p>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('warn');
    expect(result.found).toContain('<time>');
  });

  it('warns when article:published_time meta tag is present', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><head>
        <meta property="article:published_time" content="2025-01-15">
      </head><body><main><p>An article with only a meta publication date.</p></main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('warn');
    expect(result.found).toContain('meta');
  });

  it('is not-applicable when the URL ends with .xml (pathname.endsWith check)', () => {
    const page = mockPageContext(
      'https://example.com/blog/sitemap.xml',
      '<html><body><main><p>An article page with .xml URL extension.</p></main></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('na');
  });

  it('warns when JSON-LD has uploadDate and no other date fields', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><head>
        <script type="application/ld+json">
          {"@context":"https://schema.org","@type":"VideoObject","uploadDate":"2025-04-02"}
        </script>
      </head><body><main><p>A video article with only an upload date.</p></main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('warn');
    expect(result.found).toContain('JSON-LD');
  });

  it('warns when JSON-LD has dateCreated and no other date fields', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><head>
        <script type="application/ld+json">
          {"@context":"https://schema.org","@type":"Article","dateCreated":"2025-04-02"}
        </script>
      </head><body><main><p>An article with only a creation date.</p></main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('warn');
    expect(result.found).toContain('JSON-LD');
  });

  it('falls back to visible date when JSON-LD datePublished is a non-string value', () => {
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
    expect(result.status).toBe('warn');
    expect(result.found).toContain('January 15, 2025');
  });

  it('fails when JSON-LD datePublished is an empty string', () => {
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
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body><main>
        <p>Article content without any date here. <time></time></p>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
  });

  it('handles an invalid page URL (catch block in isArticleContentPage)', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body><main>
        <p>Published: <time datetime="2025-01-15">January 15, 2025</time></p>
      </main></body></html>`,
    );
    page.url = 'not-a-valid-url';
    const result = audit.audit(mockCheckContext([page]));
    // Still treated as a content page (pathname='' does not end in .xml, body is
    // not XML), so the audit runs and finds the publication date → warn.
    expect(result.status).toBe('warn');
  });

  // --- absorbed from last-updated-indicator (v1 9.10) ----------------------

  it('passes when an update keyword sits next to a <time> element', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body><main>
        <p>Last updated: <time datetime="2025-01-15">January 15, 2025</time></p>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.score).toBe(1);
    expect(result.message).toContain('last updated');
  });

  it('passes when an update keyword has an adjacent text date', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      '<html><body><main><p>Last updated January 15, 2025 by our team.</p></main></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('last updated');
  });

  it('passes on JSON-LD dateModified without needing a visible label', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><head>
        <script type="application/ld+json">
          {"@context":"https://schema.org","@type":"Article","datePublished":"2025-01-01","dateModified":"2025-04-02T10:00:00Z"}
        </script>
      </head><body><main><p>An article with a modification date.</p></main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.found).toContain('dateModified');
  });

  it('passes on an article:modified_time meta tag', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><head>
        <meta property="article:modified_time" content="2025-04-02">
      </head><body><main><p>An article with a meta modification date.</p></main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.found).toContain('article:modified_time');
  });

  it('passes when a bare <time> (no datetime attr) sits next to update text', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body><main>
        <p>Last updated: <time>January 15, 2025</time></p>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
  });

  it('short-circuits on the first matching <time> when several are present', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body><main>
        <p>Last updated: <time datetime="2025-01-15">January 15, 2025</time></p>
        <p>Event date: <time datetime="2025-03-01">March 1, 2025</time></p>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
  });

  it('falls through to the text search when no <time> carries an update keyword', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body><main>
        <p>Published: <time datetime="2025-01-15">January 15, 2025</time></p>
        <p>Last updated January 15, 2025 by our editorial team.</p>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
  });

  it('does not fail a dated evergreen article that was never revised', () => {
    // The double-penalty case the merge removes: v1 passed 9.8 and failed 9.10
    // on the same page. One audit, one partial result.
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body><main>
        <p>Published <time datetime="2025-01-15">January 15, 2025</time></p>
        <p>An evergreen article that has never needed a revision.</p>
      </main></body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).not.toBe('fail');
    expect(result.status).toBe('warn');
    expect(result.priority).toBe('low');
  });

  it('fails rather than warns when update wording carries no date at all', () => {
    // v1 9.10 warned here on incidental prose. With no date anywhere on the
    // page there is nothing for an extractor to read, so this is the fail case.
    const page = mockPageContext(
      'https://example.com/blog/post',
      '<html><body><main><p>Our content team last updated this section for better clarity.</p></main></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No dates found');
  });

  it('prefers an updated page over an earlier publication-only page', () => {
    const publishedOnly = mockPageContext(
      'https://example.com/blog/a',
      '<html><body><main><p>Published <time datetime="2025-01-15">January 15, 2025</time></p></main></body></html>',
    );
    const updated = mockPageContext(
      'https://example.com/blog/b',
      '<html><body><main><p>Last updated: <time datetime="2025-04-02">April 2, 2025</time></p></main></body></html>',
      1,
    );
    const result = audit.audit(mockCheckContext([publishedOnly, updated]));
    expect(result.status).toBe('pass');
    expect(result.pageUrl).toBe('https://example.com/blog/b');
  });
});
