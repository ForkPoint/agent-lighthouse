import { describe, it, expect } from 'vitest';
import type { AuditMeta, AuditResult, CheckResult, PageType } from './types';
import { AuditMetaSchema, CheckResultSchema } from './schemas';
import { weightForGrade } from './scorer';
import { Audit } from './audit';
import { planAudits } from './audit-runner';
import type { CheckContext } from './check-context';
import type { ScanConfig } from './audit-config';

// ---------------------------------------------------------------------------
// Fixtures

const V2_ID = 'machine-discovery/llms-txt';

function makeMeta(overrides: Partial<AuditMeta> = {}): AuditMeta {
  return {
    id: V2_ID,
    category: 'machine-discovery',
    title: 'llms.txt is present',
    failureTitle: 'llms.txt is missing',
    description: 'Checks for a machine-readable llms.txt file.',
    scoreDisplayMode: 'binary',
    weight: 1.0,
    defaultPriority: 'high',
    evidenceGrade: 'A',
    tier: 'scored',
    dossier: 'docs/evidence/audits/machine-discovery/llms-txt.md',
    ...overrides,
  };
}

function makeCheck(overrides: Partial<CheckResult> = {}): CheckResult {
  return {
    id: V2_ID,
    category: 'machine-discovery',
    title: 'llms.txt is present',
    description: 'Checks for a machine-readable llms.txt file.',
    status: 'pass',
    score: 1,
    scoreDisplayMode: 'binary',
    priority: 'high',
    impact: 'Agents cannot discover a curated entry point.',
    fix: 'Publish /llms.txt.',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------

describe('weightForGrade (spec §4 weight law)', () => {
  it('grades A and B carry weight only in the scored tier', () => {
    expect(weightForGrade('A', 'scored')).toBe(1.0);
    expect(weightForGrade('B', 'scored')).toBe(0.6);
  });

  it('grades C and D never carry weight', () => {
    expect(weightForGrade('C', 'scored')).toBe(0);
    expect(weightForGrade('D', 'scored')).toBe(0);
  });

  it('non-scored tiers are weightless regardless of grade', () => {
    expect(weightForGrade('C', 'informative')).toBe(0);
    expect(weightForGrade('A', 'informative')).toBe(0);
    expect(weightForGrade('D', 'experimental')).toBe(0);
    expect(weightForGrade('A', 'experimental')).toBe(0);
  });
});

describe('AuditMetaSchema v2 fields', () => {
  it('accepts evidenceGrade, tier, dossier and a slug id', () => {
    const parsed = AuditMetaSchema.parse(makeMeta());
    expect(parsed.evidenceGrade).toBe('A');
    expect(parsed.tier).toBe('scored');
    expect(parsed.dossier).toBe('docs/evidence/audits/machine-discovery/llms-txt.md');
    expect(parsed.id).toBe(V2_ID);
  });

  it('still accepts a v1 meta without the new fields', () => {
    const { evidenceGrade: _g, tier: _t, dossier: _d, ...v1 } = makeMeta();
    expect(() => AuditMetaSchema.parse(v1)).not.toThrow();
  });

  it('rejects an unknown evidence grade or tier', () => {
    expect(() => AuditMetaSchema.parse(makeMeta({ evidenceGrade: 'E' as never }))).toThrow();
    expect(() => AuditMetaSchema.parse(makeMeta({ tier: 'scoring' as never }))).toThrow();
  });
});

describe('CheckResultSchema v2 fields', () => {
  it('accepts a slug id longer than the old 20-char cap', () => {
    expect(V2_ID.length).toBe(26);
    const parsed = CheckResultSchema.parse(makeCheck());
    expect(parsed.id).toBe(V2_ID);
  });

  it('accepts evidenceGrade and tier passed through from meta', () => {
    const parsed = CheckResultSchema.parse(
      makeCheck({ evidenceGrade: 'B', tier: 'informative' }),
    );
    expect(parsed.evidenceGrade).toBe('B');
    expect(parsed.tier).toBe('informative');
  });
});

describe('meta → CheckResult pass-through', () => {
  it('toCheckResult copies evidenceGrade and tier onto the check', () => {
    class FakeAudit extends Audit {
      static override meta = makeMeta({ evidenceGrade: 'B', tier: 'scored' });
      audit(): AuditResult {
        return { status: 'pass', score: 1, message: 'm', expected: 'e', found: 'f' };
      }
    }
    const check = new FakeAudit().toCheckResult(new FakeAudit().audit());
    expect(check.evidenceGrade).toBe('B');
    expect(check.tier).toBe('scored');
    expect(check.id).toBe(V2_ID);
  });

  it('the page-type-skipped stub copies evidenceGrade and tier too', () => {
    const m = makeMeta({
      applicablePageTypes: ['product'],
      evidenceGrade: 'A',
      tier: 'scored',
    });
    class FakeAudit extends Audit {
      static override meta = m;
      audit(): AuditResult {
        return { status: 'pass', score: 1 };
      }
    }
    const config: ScanConfig = {
      categories: [{ id: 'machine-discovery', name: 'Machine Discovery', weight: 1 }],
      audits: { 'machine-discovery': [{ create: () => new FakeAudit(), meta: m }] },
    };
    const ctx = {
      pages: (['homepage'] as PageType[]).map((pageType) => ({ pageType })),
    } as unknown as CheckContext;

    const { skipped } = planAudits(ctx, config);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].evidenceGrade).toBe('A');
    expect(skipped[0].tier).toBe('scored');
  });
});
