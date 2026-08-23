import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defaultConfig } from '../audit-config';
import { NEW_IN_V2, MIGRATED_COUNT } from './new-in-v2';

const registeredIds = Object.values(defaultConfig.audits)
  .flat()
  .map((r) => r.meta.id);

const map = JSON.parse(
  readFileSync(join(__dirname, '..', '..', 'migration-map.json'), 'utf8'),
) as Record<string, { to?: string }>;

describe('NEW_IN_V2 — audits with no v1 predecessor', () => {
  // The list is the single source of registry growth. An audit that lands
  // without being named here fails the count pin in sunset.test.ts; an id
  // named here that never lands fails this test.
  it('names only registered audits', () => {
    const missing = NEW_IN_V2.filter((id) => !registeredIds.includes(id));
    expect(missing).toEqual([]);
  });

  it('has no duplicates', () => {
    expect(new Set(NEW_IN_V2).size).toBe(NEW_IN_V2.length);
  });

  // A new audit is new precisely because no v1 id resolves to it. An entry in
  // both places would mean a migrated audit was mislabelled as new, which
  // would silently relax the migration map's reachability assertion.
  it('shares no id with a migration-map target', () => {
    const targets = new Set(
      Object.values(map)
        .map((e) => e.to)
        .filter(Boolean),
    );
    const overlapping = NEW_IN_V2.filter((id) => targets.has(id));
    expect(overlapping).toEqual([]);
  });

  it('accounts for the whole registry: 148 migrated plus the new ids', () => {
    expect(registeredIds).toHaveLength(MIGRATED_COUNT + NEW_IN_V2.length);
  });
});
