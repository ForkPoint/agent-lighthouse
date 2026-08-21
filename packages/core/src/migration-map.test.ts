import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const map = JSON.parse(
  readFileSync(join(__dirname, '..', 'migration-map.json'), 'utf8'),
) as Record<string, { slug: string; status: string; reason: string; link: string }>;

const SUNSET_IDS = [
  '7.1', '5.11', '5.17', '5.4', '5.25', '1.21', '10.12', '4.14', '4.12',
  '4.17', '6.12', '6.16', '3.16', '3.10', '8.21', '8.6', '8.17', '8.5',
];

describe('migration-map.json', () => {
  it('contains every sunset audit id', () => {
    expect(Object.keys(map).sort()).toEqual([...SUNSET_IDS].sort());
  });

  it.each(SUNSET_IDS)('entry %s is removed-in-v2 with a NOT-A-FACTOR link', (id) => {
    const entry = map[id]!;
    expect(entry.status).toBe('removed-in-v2');
    expect(entry.reason).toBe('not-a-factor');
    expect(entry.slug).toMatch(/^[a-z-]+\/[a-z-]+$/);
    expect(entry.link).toContain('docs/evidence/NOT-A-FACTOR.md#');
  });
});
