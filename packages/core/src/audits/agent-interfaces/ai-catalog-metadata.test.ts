import { describe, it, expect } from 'vitest';
import { AiCatalogMetadataAudit } from './ai-catalog-metadata';
import { mockCheckContext, mockFetchResult } from '../../__tests__/test-utils';

/** An entry carrying everything hf-discover indexes. */
function richEntry(n: number): Record<string, unknown> {
  return {
    identifier: `urn:air:example.com:server:s${n}`,
    displayName: `Service ${n}`,
    type: 'application/mcp-server-card+json',
    url: `https://example.com/mcp/s${n}.json`,
    description: `Service ${n} does something useful.`,
    capabilities: ['search'],
    representativeQueries: [`use service ${n}`],
    tags: ['api'],
  };
}

/** An entry with only the three fields ARD requires — nothing indexable. */
function bareEntry(n: number): Record<string, unknown> {
  return {
    identifier: `urn:air:example.com:server:b${n}`,
    displayName: `Bare ${n}`,
    type: 'application/mcp-server-card+json',
    url: `https://example.com/mcp/b${n}.json`,
  };
}

function manifest(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    specVersion: '1.0',
    host: { displayName: 'Example', identifier: 'did:web:example.com' },
    entries: [richEntry(1)],
    ...over,
  });
}

const ctxWith = (body: string) =>
  mockCheckContext([], {
    '/.well-known/ai-catalog.json': mockFetchResult(body, 200, 'application/ai-catalog+json'),
  });

describe('AiCatalogMetadataAudit', () => {
  const audit = new AiCatalogMetadataAudit();

  it('passes when the host is named and every entry is indexable', () => {
    const result = audit.audit(ctxWith(manifest({ entries: [richEntry(1), richEntry(2)] })));
    expect(result.status).toBe('pass');
    expect(result.found).toContain('2/2');
  });

  it('passes without the optional updatedAt / trustManifest bonuses', () => {
    const result = audit.audit(ctxWith(manifest()));
    expect(result.status).toBe('pass');
  });

  // ARD §4.2 puts updatedAt on the entry, and §4.2/§4.3 put trustManifest on
  // the entry and the host. Neither is a root-level manifest field.

  it('reports an entry-level updatedAt and a host-level trustManifest as bonuses', () => {
    const result = audit.audit(
      ctxWith(
        manifest({
          host: {
            displayName: 'Example',
            identifier: 'did:web:example.com',
            trustManifest: { issuer: 'did:web:example.com' },
          },
          entries: [{ ...richEntry(1), updatedAt: '2026-08-01T00:00:00Z' }],
        }),
      ),
    );
    expect(result.status).toBe('pass');
    expect(result.found).toContain('updatedAt');
    expect(result.found).toContain('trustManifest');
  });

  it('reports an entry-level trustManifest as a bonus', () => {
    const result = audit.audit(
      ctxWith(
        manifest({
          entries: [{ ...richEntry(1), trustManifest: { issuer: 'did:web:example.com' } }],
        }),
      ),
    );
    expect(result.status).toBe('pass');
    expect(result.found).toContain('trustManifest');
  });

  it('ignores root-level updatedAt and trustManifest, which the spec does not define', () => {
    const result = audit.audit(
      ctxWith(manifest({ updatedAt: '2026-08-01', trustManifest: { issuer: 'did:web:example.com' } })),
    );
    expect(result.status).toBe('pass');
    expect(result.found).not.toContain('updatedAt');
    expect(result.found).not.toContain('trustManifest');
  });

  it('counts how many entries carry updatedAt, not merely that one does', () => {
    const result = audit.audit(
      ctxWith(
        manifest({
          entries: [{ ...richEntry(1), updatedAt: '2026-08-01T00:00:00Z' }, richEntry(2)],
        }),
      ),
    );
    expect(result.found).toContain('1/2 entries with updatedAt');
  });

  it('warns when only some entries carry indexable metadata', () => {
    const result = audit.audit(ctxWith(manifest({ entries: [richEntry(1), bareEntry(2)] })));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('Bare 2');
  });

  it('fails when no entry carries any indexable metadata', () => {
    const result = audit.audit(ctxWith(manifest({ entries: [bareEntry(1), bareEntry(2)] })));
    expect(result.status).toBe('fail');
  });

  it('warns when host.displayName is missing even though every entry is rich', () => {
    const result = audit.audit(ctxWith(manifest({ host: { identifier: 'did:web:example.com' } })));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('host.displayName');
  });

  it('mentions a missing host.identifier without failing on it', () => {
    const result = audit.audit(ctxWith(manifest({ host: { displayName: 'Example' } })));
    expect(result.status).toBe('pass');
    expect(result.found).toContain('host.identifier');
  });

  it('does not count whitespace-only descriptions or empty arrays as metadata', () => {
    const hollow = {
      ...bareEntry(1),
      description: '   ',
      capabilities: [],
      representativeQueries: [],
      tags: [],
    };
    expect(audit.audit(ctxWith(manifest({ entries: [hollow] }))).status).toBe('fail');
  });

  it('requires more than a description alone to call an entry indexable', () => {
    const descOnly = { ...bareEntry(1), description: 'Just a description.' };
    const result = audit.audit(ctxWith(manifest({ entries: [descOnly] })));
    expect(result.status).toBe('warn');
  });

  // ── no second zero for a file ai-catalog-exists already scores ──

  it('is not applicable when no manifest is served', () => {
    expect(audit.audit(mockCheckContext([], {})).status).toBe('na');
  });

  it('is not applicable when the served file is not an ARD manifest', () => {
    const legacy = JSON.stringify({ version: '1.0', name: 'Site', services: [] });
    expect(audit.audit(ctxWith(legacy)).status).toBe('na');
  });

  it('is not applicable when the manifest body is not valid JSON', () => {
    expect(audit.audit(ctxWith('nope {{{')).status).toBe('na');
  });

  // ── guidance must not teach the invented field list ──

  it('drops owner / contact / lastUpdated from its guidance', () => {
    const code = AiCatalogMetadataAudit.meta.guidance?.code ?? '';
    const fix = AiCatalogMetadataAudit.meta.guidance?.fix ?? '';
    for (const invented of ['owner', 'contact', 'lastUpdated', 'services']) {
      expect(code).not.toContain(invented);
      expect(fix).not.toContain(invented);
    }
    expect(code).toContain('representativeQueries');
  });
});
