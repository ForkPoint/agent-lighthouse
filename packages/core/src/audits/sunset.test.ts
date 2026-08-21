import { describe, it, expect } from 'vitest';
import { defaultConfig } from '../audit-config';

// The 18 v1 audits removed in this major release. Rationale and per-audit
// evidence: docs/evidence/sunset/NOT-A-FACTOR.md. Consumers migrate via
// packages/core/migration-map.json.
const REMOVED_IDS = [
  '7.1', '5.11', '5.17', '5.4', '5.25', '1.21', '10.12', '4.14', '4.12',
  '4.17', '6.12', '6.16', '3.16', '3.10', '8.21', '8.6', '8.17', '8.5',
];

describe('sunset audits (NOT-A-FACTOR) are gone', () => {
  const allMetas = Object.values(defaultConfig.audits)
    .flat()
    .map((reg) => reg.meta);

  // Tombstone: these ids must never come back. Re-registering one would
  // silently resurrect a check the evidence review proved has no consumer.
  it('registers none of the 18 removed audit ids', () => {
    const resurrected = allMetas
      .map((m) => m.id)
      .filter((id) => REMOVED_IDS.includes(id));
    expect(resurrected).toEqual([]);
  });

  it('leaves no gap in the registry', () => {
    const ids = allMetas.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('weight/scoreDisplayMode invariant', () => {
  const allMetas = Object.values(defaultConfig.audits)
    .flat()
    .map((reg) => reg.meta);

  it('covers the whole registry', () => {
    expect(allMetas.length).toBeGreaterThan(180);
  });

  // Two independent scoring paths key off two different fields: the audit
  // runner weights by `meta.weight`, while the public scorer excludes by
  // `meta.scoreDisplayMode === 'informative'`. If the two ever disagree an
  // audit would be silently half-excluded, so they must move together.
  it('keeps weight === 0 and scoreDisplayMode === informative in lockstep', () => {
    const divergent = allMetas
      .filter((m) => (m.weight === 0) !== (m.scoreDisplayMode === 'informative'))
      .map((m) => `${m.id} (weight=${m.weight}, scoreDisplayMode=${m.scoreDisplayMode})`);
    expect(divergent).toEqual([]);
  });
});
