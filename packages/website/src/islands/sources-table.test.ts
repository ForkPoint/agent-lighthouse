import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { filterSources, sourceTypes, type SourceRecord } from './sources-table';

/**
 * The registry as it is on disk — `docs/evidence/sources.json` is read, never
 * written, and it is the shape these tests hold the island to: one `accessed`
 * date for the whole file and a `sources` array whose facet field is `type`
 * and whose `verified` is an ISO date.
 */
const REGISTRY = resolve(__dirname, '../../../../docs/evidence/sources.json');
const raw = JSON.parse(readFileSync(REGISTRY, 'utf8')) as {
  accessed: string;
  sources: SourceRecord[];
};

const record = (over: Partial<SourceRecord> & { id: string }): SourceRecord => ({
  title: 'A source',
  url: 'https://example.test/',
  type: 'spec',
  publisher: 'Example',
  verified: '2026-08-20',
  keyFindings: '',
  ...over,
});

describe('filterSources', () => {
  const sources = [
    record({
      id: 'mcp-spec',
      title: 'MCP Specification',
      publisher: 'Model Context Protocol',
      keyFindings: 'Defines the `tools/list` method.',
    }),
    record({
      id: 'vercel-crawler-study',
      title: 'The rise of the AI crawler',
      publisher: 'Vercel',
      type: 'study',
      verified: '2026-08-21',
      keyFindings: 'GPTBot made 569 million requests in one month.',
    }),
  ];

  it('matches title and publisher', () => {
    expect(filterSources(sources, 'vercel', 'all')).toHaveLength(1);
    expect(filterSources(sources, 'specification', 'all')).toHaveLength(1);
  });

  it('matches the id and the key findings, which is where the detail lives', () => {
    expect(filterSources(sources, 'mcp-spec', 'all')[0]?.id).toBe('mcp-spec');
    expect(filterSources(sources, 'gptbot', 'all')[0]?.id).toBe('vercel-crawler-study');
  });

  it('ignores the case and the surrounding whitespace of a query', () => {
    expect(filterSources(sources, '  VERCEL  ', 'all')).toHaveLength(1);
  });

  it('filters by type', () => {
    expect(filterSources(sources, '', 'spec')).toHaveLength(1);
    expect(filterSources(sources, '', 'study')[0]?.id).toBe('vercel-crawler-study');
  });

  it('combines the type facet with the search text', () => {
    expect(filterSources(sources, 'vercel', 'spec')).toHaveLength(0);
    expect(filterSources(sources, 'vercel', 'study')).toHaveLength(1);
  });

  it('returns everything for an empty query', () => {
    expect(filterSources(sources, '', 'all')).toHaveLength(2);
  });
});

describe('sourceTypes', () => {
  it('reports the distinct types present, sorted, with no blanks', () => {
    const types = sourceTypes([
      record({ id: 'a', type: 'spec' }),
      record({ id: 'b', type: 'study' }),
      record({ id: 'c', type: 'spec' }),
    ]);

    expect(types).toEqual(['spec', 'study']);
  });
});

/**
 * The facet list is derived from the file rather than guessed, so these assert
 * the file's real shape instead of a list copied out of it: a new `type` in the
 * registry must widen the filter on its own.
 */
describe('the registry on disk', () => {
  it('is one dated document wrapping an array of sources', () => {
    expect(raw.accessed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Array.isArray(raw.sources)).toBe(true);
    expect(raw.sources.length).toBeGreaterThan(500);
  });

  it('gives every entry the fields the table renders', () => {
    for (const source of raw.sources) {
      expect(typeof source.id, source.id).toBe('string');
      expect(source.id.length, 'a source with no id').toBeGreaterThan(0);
      expect(source.title.length, source.id).toBeGreaterThan(0);
      expect(source.url, source.id).toMatch(/^https?:\/\//);
      expect(source.type.length, source.id).toBeGreaterThan(0);
      expect(source.publisher.length, source.id).toBeGreaterThan(0);
      // The date the URL was last resolved. It was a boolean, and all 715
      // records were `true`; a date is the fact a reader can act on.
      expect(source.verified, `${source.id} verified is not an ISO date`).toMatch(
        /^\d{4}-\d{2}-\d{2}$/,
      );
      expect(source.keyFindings.length, source.id).toBeGreaterThan(0);
    }
  });

  it('carries no duplicate ids, because a dossier cites one', () => {
    expect(new Set(raw.sources.map((source) => source.id)).size).toBe(raw.sources.length);
  });

  it('yields the facet list the page builds its filter from', () => {
    const types = sourceTypes(raw.sources);

    expect(types.length).toBeGreaterThan(1);
    expect(types).toContain('spec');
    expect(types).toContain('vendor-doc');
    // Every source falls under one of them — a pill for each covers the file.
    expect(new Set(raw.sources.map((source) => source.type)).size).toBe(types.length);
  });

  it('filters the real registry down by a type it actually contains', () => {
    const [first] = sourceTypes(raw.sources);
    const matched = filterSources(raw.sources, '', first!);

    expect(matched.length).toBeGreaterThan(0);
    expect(matched.length).toBeLessThan(raw.sources.length);
    expect(matched.every((source) => source.type === first)).toBe(true);
  });
});
