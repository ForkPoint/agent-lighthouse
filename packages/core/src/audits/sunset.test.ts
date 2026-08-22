import { describe, it, expect } from 'vitest';
import { defaultConfig } from '../audit-config';
import { AuditMetaSchema } from '../schemas';
import { weightForGrade } from '../scorer';

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

  // Floor, not a pin: Plan 4 shrinks the registry fold by fold (181 → 177 with
  // the ai-bot-directives consolidation, 177 → 174 with security-header-hygiene,
  // 174 → 168 with the machine-discovery folds, and further with each later
  // task). Task 14 replaces this with the exact final count.
  it('covers the whole registry', () => {
    expect(allMetas.length).toBeGreaterThan(150);
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
});
