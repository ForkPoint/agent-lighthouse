import { describe, it, expect } from 'vitest';
import { defaultConfig } from '../audit-config';

const SUNSET_IDS = [
  '7.1', '5.11', '5.17', '5.4', '5.25', '1.21', '10.12', '4.14', '4.12',
  '4.17', '6.12', '6.16', '3.16', '3.10', '8.21', '8.6', '8.17', '8.5',
];

describe('sunset audits (NOT-A-FACTOR)', () => {
  const metas = Object.values(defaultConfig.audits)
    .flat()
    .map((reg) => reg.meta)
    .filter((m) => SUNSET_IDS.includes(m.id));

  it('all 18 sunset audits are registered', () => {
    expect(metas.map((m) => m.id).sort()).toEqual([...SUNSET_IDS].sort());
  });

  it.each(SUNSET_IDS)('audit %s is informative, weight 0, with a deprecation notice', (id) => {
    const meta = metas.find((m) => m.id === id);
    expect(meta).toBeDefined();
    expect(meta!.scoreDisplayMode).toBe('informative');
    expect(meta!.weight).toBe(0);
    expect(meta!.deprecated?.notice).toBeTruthy();
    expect(meta!.deprecated?.link).toMatch(
      /^https:\/\/github\.com\/ForkPoint\/agent-lighthouse\/blob\/main\/docs\/evidence\/NOT-A-FACTOR\.md#/,
    );
  });
});

describe('weight/scoreDisplayMode invariant', () => {
  const allMetas = Object.values(defaultConfig.audits)
    .flat()
    .map((reg) => reg.meta);

  it('covers the whole registry', () => {
    expect(allMetas.length).toBeGreaterThan(190);
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
