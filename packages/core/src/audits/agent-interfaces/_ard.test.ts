import { describe, it, expect } from 'vitest';
import { entryLabel, nonEmptyString, readAiCatalog, stringList } from './_ard';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

const ctxWith = (body: string, status = 200, contentType = 'application/ai-catalog+json') =>
  mockCheckContext([], {
    '/.well-known/ai-catalog.json': mockFetchResult(body, status, contentType),
  });

describe('readAiCatalog', () => {
  it('parses an ARD manifest into typed entries', () => {
    const read = readAiCatalog(
      ctxWith(
        JSON.stringify({
          specVersion: '1.0',
          host: { displayName: 'Example' },
          entries: [
            {
              identifier: 'urn:air:example.com:server:a',
              displayName: 'A',
              type: 'application/mcp-server-card+json',
              url: 'https://example.com/a',
              capabilities: ['x', '  ', 42],
            },
            { identifier: 'urn:air:example.com:skill:b', data: '# inline' },
          ],
        }),
      ),
    );
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.manifest.entries[0]!.capabilities).toEqual(['x']);
    expect(read.manifest.entries[0]!.hasData).toBe(false);
    expect(read.manifest.entries[1]!.hasData).toBe(true);
    expect(read.manifest.entries[1]!.url).toBeUndefined();
  });

  it.each([
    ['absent', undefined],
    ['html', '<!doctype html><html></html>'],
    ['not-json', 'nope {{{'],
    ['shape', JSON.stringify({ services: [] })],
  ])('names the %s failure mode', (reason, body) => {
    const ctx =
      body === undefined
        ? mockCheckContext([], {})
        : ctxWith(body, 200, reason === 'html' ? 'text/html' : 'application/json');
    const read = readAiCatalog(ctx);
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.reason).toBe(reason);
  });

  it('detects an HTML soft-404 from the body even when the content type lies', () => {
    const read = readAiCatalog(ctxWith('<html><body>Not found</body></html>', 200, 'application/json'));
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.reason).toBe('html');
  });

  // ARD §4.2: updatedAt is an entry field. §4.2/§4.3: trustManifest sits on the
  // entry and the host. Neither is defined at the manifest root.
  it('reads updatedAt and trustManifest at their spec-defined levels', () => {
    const read = readAiCatalog(
      ctxWith(
        JSON.stringify({
          specVersion: '1.0',
          updatedAt: '2026-08-01',
          trustManifest: { issuer: 'did:web:example.com' },
          host: { displayName: 'Example', trustManifest: { issuer: 'did:web:example.com' } },
          entries: [
            { identifier: 'urn:air:example.com:a', updatedAt: '2026-08-02T00:00:00Z' },
            { identifier: 'urn:air:example.com:b', trustManifest: { issuer: 'did:web:example.com' } },
          ],
        }),
      ),
    );
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.manifest.entries[0]!.updatedAt).toBe('2026-08-02T00:00:00Z');
    expect(read.manifest.entries[0]!.hasTrustManifest).toBe(false);
    expect(read.manifest.entries[1]!.hasTrustManifest).toBe(true);
    expect(read.manifest.hostHasTrustManifest).toBe(true);
    // The root-level copies are not part of the schema and must not leak in.
    expect('updatedAt' in read.manifest).toBe(false);
    expect('hasTrustManifest' in read.manifest).toBe(false);
  });

  it('does not promote a root-level trustManifest onto the host', () => {
    const read = readAiCatalog(
      ctxWith(
        JSON.stringify({
          specVersion: '1.0',
          trustManifest: { issuer: 'did:web:example.com' },
          host: { displayName: 'Example' },
          entries: [{ identifier: 'urn:air:example.com:a' }],
        }),
      ),
    );
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.manifest.hostHasTrustManifest).toBe(false);
    expect(read.manifest.entries[0]!.hasTrustManifest).toBe(false);
  });

  it('treats a whitespace-only specVersion as missing', () => {
    const read = readAiCatalog(
      ctxWith(JSON.stringify({ specVersion: '  ', host: {}, entries: [] })),
    );
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.reason === 'shape' && read.missing).toEqual(['specVersion']);
  });
});

describe('_ard helpers', () => {
  it('nonEmptyString rejects blanks and non-strings', () => {
    expect(nonEmptyString('a')).toBe('a');
    expect(nonEmptyString('  ')).toBeUndefined();
    expect(nonEmptyString(7)).toBeUndefined();
  });

  it('stringList drops blank and non-string members', () => {
    expect(stringList(['a', '', ' ', 1, null])).toEqual(['a']);
    expect(stringList('a')).toEqual([]);
  });

  it('entryLabel falls back through displayName, identifier and position', () => {
    const base = {
      hasData: false,
      capabilities: [],
      representativeQueries: [],
      tags: [],
      hasTrustManifest: false,
      index: 2,
    };
    expect(entryLabel({ ...base, displayName: 'Name', identifier: 'urn:x' })).toBe('Name');
    expect(entryLabel({ ...base, identifier: 'urn:x' })).toBe('urn:x');
    expect(entryLabel(base)).toBe('entry #3');
  });
});
