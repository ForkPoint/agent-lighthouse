import { describe, it, expect } from 'vitest';
import { AiFileDeliveryAudit } from './ai-file-delivery';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';
import type { FetchResult } from '../../fetcher';

/** A 200 response with the given content type and extra headers. */
const file = (
  body: string,
  contentType: string,
  headers: Record<string, string> = {},
): FetchResult => {
  const result = mockFetchResult(body, 200, contentType);
  Object.assign(result.headers, headers);
  return result;
};

const cached = { 'cache-control': 'public, max-age=3600' };

describe('AiFileDeliveryAudit', () => {
  const audit = new AiFileDeliveryAudit();

  it('passes when every file has the right Content-Type and is cacheable', () => {
    const ctx = mockCheckContext([], {
      '/llms.txt': file('# Site', 'text/plain', cached),
      '/openapi.json': file('{}', 'application/json', cached),
      '/sitemap.xml': file('<urlset/>', 'application/xml', cached),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('Content-Type');
  });

  it('tolerates charset suffixes on Content-Type', () => {
    const ctx = mockCheckContext([], {
      '/openapi.json': file('{}', 'application/json; charset=utf-8', cached),
    });
    expect(audit.audit(ctx).status).toBe('pass');
  });

  it('fails when a file has an incorrect Content-Type', () => {
    const ctx = mockCheckContext([], {
      '/openapi.json': file('{"openapi":"3.1.0"}', 'text/html', cached),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('expected application/json');
    expect(result.message).toContain('got text/html');
  });

  // Review finding (8.10): SPA/Jamstack hosts answer unknown paths with 200 +
  // index.html, so an unpublished file was reported as mis-typed.
  it('skips a file whose body is the site HTML shell', () => {
    const ctx = mockCheckContext([], {
      '/openapi.json': file('<!doctype html><html><body>App</body></html>', 'text/html', cached),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe('na');
  });

  // Review findings (8.10 + 8.11): `checked === 0` scored a warn, so a site with
  // no AI files lost points three times over for having nothing to check.
  it('is not applicable when no AI files were served', () => {
    const result = audit.audit(mockCheckContext([], {}));
    expect(result.status).toBe('na');
    expect(result.found).toContain('No applicable files found');
  });

  it('ignores files with a non-200 status', () => {
    const ctx = mockCheckContext([], { '/llms.txt': mockFetchResult('', 404) });
    expect(audit.audit(ctx).status).toBe('na');
  });

  describe('delivery headers (absorbed from cache-headers, v1 8.11)', () => {
    it('warns when a correctly typed file carries no caching headers at all', () => {
      const ctx = mockCheckContext([], { '/llms.txt': file('# Site', 'text/plain') });
      const result = audit.audit(ctx);
      expect(result.status).toBe('warn');
      expect(result.message).toContain('no caching headers');
    });

    // Review finding (8.11): the value was never examined, so `no-store` — the
    // header that guarantees the re-fetching the audit warns about — passed.
    it('does not count no-store, no-cache or max-age=0 as caching', () => {
      for (const value of ['no-store', 'no-cache', 'public, max-age=0']) {
        const ctx = mockCheckContext([], {
          '/llms.txt': file('# Site', 'text/plain', { 'cache-control': value }),
        });
        const result = audit.audit(ctx);
        expect(result.status, value).toBe('warn');
        expect(result.message, value).toContain('no caching headers');
      }
    });

    // Review finding (8.11): ETag / Last-Modified are the mechanism that
    // actually saves the re-download, and were not considered at all.
    it('accepts an ETag or Last-Modified validator as caching', () => {
      const validators: Record<string, string>[] = [
        { etag: '"abc"' },
        { 'last-modified': 'Wed, 20 Aug 2026 10:00:00 GMT' },
      ];
      for (const headers of validators) {
        const ctx = mockCheckContext([], { '/llms.txt': file('# Site', 'text/plain', headers) });
        expect(audit.audit(ctx).status, JSON.stringify(headers)).toBe('pass');
      }
    });

    // A validator saves the transfer only when the client is allowed to keep
    // the copy. `no-store` forbids that, so an ETag beside it stores nothing.
    it('counts a no-store file as uncached even when it carries an ETag', () => {
      for (const value of ['no-store', 'no-cache']) {
        const ctx = mockCheckContext([], {
          '/llms.txt': file('# Site', 'text/plain', { 'cache-control': value, etag: '"abc"' }),
        });
        const result = audit.audit(ctx);
        expect(result.status, value).toBe('warn');
        expect(result.message, value).toContain('no caching headers');
        expect(result.message, value).toContain('llms.txt');
      }
    });

    it('reports the per-file caching state in the details', () => {
      const ctx = mockCheckContext([], {
        '/llms.txt': file('# Site', 'text/plain', cached),
        '/sitemap.xml': file('<urlset/>', 'application/xml'),
      });
      const result = audit.audit(ctx);
      expect(result.status).toBe('warn');
      expect(result.found).toContain('sitemap.xml');
      expect(result.found).not.toContain('llms.txt: no caching');
    });

    // A mis-typed file still fails on the type: the caching half never masks it.
    it('keeps the Content-Type failure when caching is fine', () => {
      const ctx = mockCheckContext([], {
        '/llms.txt': file('# Site', 'application/octet-stream', cached),
      });
      expect(audit.audit(ctx).status).toBe('fail');
    });

    // nosniff removes a client's ability to recover from a wrong Content-Type
    // (the sub-signal the v2 map moves here from 8.4).
    it('notes nosniff on a mis-typed file', () => {
      const ctx = mockCheckContext([], {
        '/llms.txt': file('# Site', 'application/octet-stream', {
          ...cached,
          'x-content-type-options': 'nosniff',
        }),
      });
      const result = audit.audit(ctx);
      expect(result.status).toBe('fail');
      expect(result.message).toContain('nosniff');
    });
  });
});
