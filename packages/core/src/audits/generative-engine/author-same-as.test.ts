import { describe, it, expect } from 'vitest';
import { AuthorSameAsAudit } from './author-same-as';
import { mockCheckContext, mockPageContext } from '../../__tests__/test-utils';

describe('AuthorSameAsAudit', () => {
  const audit = new AuthorSameAsAudit();

  it('passes when author has a sameAs array of external profile URLs', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Article","author":{"@type":"Person","name":"Jane","sameAs":["https://linkedin.com/in/jane","https://twitter.com/jane"]}}
        </script>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('2 external profile URL(s)');
  });

  it('passes when author has a single string sameAs URL', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Person","name":"Jane","sameAs":"https://github.com/jane"}
        </script>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
    expect(result.message).toContain('external profile URL');
  });

  it('fails when author has no sameAs', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Article","author":{"@type":"Person","name":"Jane"}}
        </script>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No author sameAs');
  });

  it('fails when no pages scanned', () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No pages scanned');
  });

  it('passes when JSON-LD uses a top-level array containing Person with sameAs', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body>
        <script type="application/ld+json">
        [{"@context":"https://schema.org","@type":"Person","name":"Jane","sameAs":["https://linkedin.com/in/jane"]}]
        </script>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
  });

  it('passes when author sameAs is inside a @graph block', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@graph":[{"@type":"Article","author":{"@type":"Person","name":"Jane","sameAs":["https://twitter.com/jane"]}}]}
        </script>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
  });

  it('fails when sameAs array contains no http/https URLs', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Article","author":{"@type":"Person","name":"Jane","sameAs":["not-a-url","ftp://example.com"]}}
        </script>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
  });

  it('fails when author is an array but none has sameAs', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Article","author":[{"@type":"Person","name":"Jane"},{"@type":"Person","name":"John"}]}
        </script>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
  });

  it('handles null item in @graph gracefully (covers line 14 walk null check)', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@graph":[null,{"@type":"Article","author":{"@type":"Person","name":"Jane","sameAs":"https://github.com/jane"}}]}
        </script>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
  });

  it('handles @type as array with non-string element (covers lines 25-27 Array.isArray + typeof false)', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":[null,"Article"],"author":{"@type":"Person","name":"Jane","sameAs":["https://twitter.com/jane"]}}
        </script>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
  });

  it('skips Article with no author property (covers line 99 continue)', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Article","name":"Article Without Author"}
        </script>
        <p>No author here.</p>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('No author sameAs');
  });

  it('handles null in author array (covers line 103 null check)', () => {
    const page = mockPageContext(
      'https://example.com/blog/post',
      `<html><body>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Article","author":[null,{"@type":"Person","name":"Jane","sameAs":["https://linkedin.com/in/jane"]}]}
        </script>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe('pass');
  });
});
