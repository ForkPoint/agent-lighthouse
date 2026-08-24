import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defaultConfig } from '../audit-config';
import { AuditMetaSchema } from '../schemas';
import { weightForGrade } from '../scorer';
import { NEW_IN_V2, MIGRATED_COUNT } from '../tests/new-in-v2';

// The 26 v1 audits removed in this major release: the first 18 in the v1.0.0
// sunset wave, plus the 8 added by the 2026-08-21 grading pass. Rationale and
// per-audit evidence: docs/evidence/sunset/NOT-A-FACTOR.md. Consumers migrate
// via packages/core/migration-map.json.
const REMOVED_IDS = [
  '7.1', '5.11', '5.17', '5.4', '5.25', '1.21', '10.12', '4.14', '4.12',
  '4.17', '6.12', '6.16', '3.16', '3.10', '8.21', '8.6', '8.17', '8.5',
  '1.18', '1.23', '7.22', '8.14', '8.15', '8.16', '8.19', '8.20',
];

describe('sunset audits (NOT-A-FACTOR) are gone', () => {
  const allMetas = Object.values(defaultConfig.audits)
    .flat()
    .map((reg) => reg.meta);

  // Tombstone: these ids must never come back. Re-registering one would
  // silently resurrect a check the evidence review proved has no consumer.
  it('registers none of the 26 removed audit ids', () => {
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

describe('registry-wide meta invariants', () => {
  const allMetas = Object.values(defaultConfig.audits)
    .flat()
    .map((reg) => reg.meta);

  // Pinned, not a floor: Plan 4 shrank the registry fold by fold (181 v1 rows →
  // 148 v2 audits) and Task 14 closed it. Plan 5 grows it again, but only
  // through NEW_IN_V2, so the expected total is derived rather than retyped. An
  // audit added or dropped without a deliberate edit to that list is drift, not
  // a passing build. The same 148 is asserted against the migration map in
  // migration-map.test.ts, so the registry and the consumer-facing migration
  // path can never move independently.
  it('registers exactly the migrated 148 plus every new-in-v2 audit', () => {
    expect(allMetas).toHaveLength(MIGRATED_COUNT + NEW_IN_V2.length);
  });

  // The v2 meta contract is enforced, not aspirational: an audit without a
  // grade, tier, dossier or a `category/slug` id cannot be registered.
  it('every registered meta satisfies AuditMetaSchema', () => {
    const invalid = allMetas
      .map((m) => [m.id, AuditMetaSchema.safeParse(m)] as const)
      .filter(([, res]) => !res.success)
      .map(([id, res]) => `${id}: ${JSON.stringify(res.error?.issues)}`);
    expect(invalid).toEqual([]);
  });

  // Spec §4 weight law: weight is a pure function of grade and tier, never
  // hand-set. A drifted weight would silently re-price the evidence.
  it('every weight equals weightForGrade(evidenceGrade, tier)', () => {
    const drifted = allMetas
      .filter((m) => m.weight !== weightForGrade(m.evidenceGrade!, m.tier!))
      .map((m) => `${m.id} (weight=${m.weight}, grade=${m.evidenceGrade}, tier=${m.tier})`);
    expect(drifted).toEqual([]);
  });

  // Two independent scoring paths key off two different fields: the audit
  // runner weights by `meta.weight`, while the public scorer excludes by
  // `meta.scoreDisplayMode === 'informative'`. Tier is now the single notion
  // of "does this count", so the biconditional is stated against it.
  it('keeps tier !== scored and weight === 0 in lockstep', () => {
    const divergent = allMetas
      .filter((m) => (m.tier !== 'scored') !== (m.weight === 0))
      .map((m) => `${m.id} (weight=${m.weight}, tier=${m.tier})`);
    expect(divergent).toEqual([]);
  });

  // Ledger: `tier` and `scoreDisplayMode` are two spellings of the same
  // advisory notion. A non-scored audit that still renders as pass/fail would
  // read to the user as if it counted.
  it('non-scored tiers always render as informative', () => {
    const divergent = allMetas
      .filter((m) => m.tier !== 'scored' && m.scoreDisplayMode !== 'informative')
      .map((m) => `${m.id} (tier=${m.tier}, scoreDisplayMode=${m.scoreDisplayMode})`);
    expect(divergent).toEqual([]);
  });

  /**
   * The bug class the 2026-08-24 contradiction sweep found by hand: an audit
   * shipping at a tier its own research never recommended, with nothing in the
   * repository saying who decided otherwise.
   *
   * The two are allowed to differ — the sweep overrode eight recommendations
   * deliberately — so the invariant is not equality. It is that a difference is
   * written down. `tier_rationale` is that record.
   */
  it('records a rationale wherever the shipped tier overrides the researched one', () => {
    const root = resolve(__dirname, '../../../..');
    const undocumented = allMetas
      .filter((m) => m.dossier)
      .flatMap((m) => {
        const front = readFileSync(resolve(root, m.dossier!), 'utf8').split('\n---')[0]!;
        const recommended = /^recommended_tier:\s*"?([a-z]+)"?/m.exec(front)?.[1];
        const tier = m.tier ?? 'scored';
        if (!recommended || recommended === tier) return [];
        if (/^tier_rationale:/m.test(front)) return [];
        return [`${m.id} (ships ${tier}, dossier recommends ${recommended})`];
      });
    expect(undocumented).toEqual([]);
  });
});
