import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const map = JSON.parse(
  readFileSync(join(__dirname, '..', 'migration-map.json'), 'utf8'),
) as Record<string, { slug: string; status: string; reason: string; link: string }>;

// The 26 v1 audits removed in this major release (18 in the v1.0.0 sunset
// wave, 8 added by the 2026-08-21 grading pass).
const REMOVED_IDS = [
  '7.1', '5.11', '5.17', '5.4', '5.25', '1.21', '10.12', '4.14', '4.12',
  '4.17', '6.12', '6.16', '3.16', '3.10', '8.21', '8.6', '8.17', '8.5',
  '1.18', '1.23', '7.22', '8.14', '8.15', '8.16', '8.19', '8.20',
];

describe('migration-map.json', () => {
  it('contains every removed audit id', () => {
    expect(Object.keys(map).sort()).toEqual([...REMOVED_IDS].sort());
  });

  it.each(REMOVED_IDS)('entry %s is removed with a sunset rationale link', (id) => {
    const entry = map[id]!;
    expect(entry.status).toBe('removed');
    expect(entry.reason).toBe('not-a-factor');
    expect(entry.slug).toMatch(/^[a-z-]+\/[a-z-]+$/);
    expect(entry.link).toContain('docs/evidence/sunset/NOT-A-FACTOR.md#');
  });

  // The anchor is what a consumer follows to read why their check disappeared;
  // a slug/anchor mismatch would land them on the wrong section.
  it.each(REMOVED_IDS)('entry %s anchors at its own slug', (id) => {
    const entry = map[id]!;
    expect(entry.link.split('#')[1]).toBe(entry.slug.replace('/', ''));
  });
});
