import { describe, it, expect } from 'vitest';
import { Audit } from './audit';
import type { AuditMeta, AuditResult } from './types';
import { AuditMetaSchema } from './schemas';

const NOTICE = {
  notice: 'No consumer reads this signal.',
  link: 'https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/sunset/not-a-factor.md#accessibilityskip-nav',
};

class DeprecatedAudit extends Audit {
  static override meta: AuditMeta = {
    id: 'operability-safety/skip-nav',
    category: 'operability-safety',
    title: 'Deprecated thing',
    failureTitle: 'Deprecated thing',
    description: 'Test audit.',
    scoreDisplayMode: 'informative',
    weight: 0,
    defaultPriority: 'low',
    evidenceGrade: 'D',
    tier: 'informative',
    dossier: 'docs/evidence/sunset/not-a-factor.md',
    deprecated: NOTICE,
  };
  audit(): AuditResult {
    return { status: 'pass', score: 1 };
  }
}

describe('deprecation notice flow', () => {
  it('AuditMetaSchema accepts a deprecated block and weight 0', () => {
    expect(() => AuditMetaSchema.parse(DeprecatedAudit.meta)).not.toThrow();
  });

  it('AuditMetaSchema rejects a deprecated block with an empty notice', () => {
    expect(() =>
      AuditMetaSchema.parse({
        ...DeprecatedAudit.meta,
        deprecated: { notice: '', link: NOTICE.link },
      }),
    ).toThrow();
  });

  it('AuditMetaSchema still rejects negative weight', () => {
    expect(() => AuditMetaSchema.parse({ ...DeprecatedAudit.meta, weight: -0.1 })).toThrow();
  });

  it('toCheckResult carries meta.deprecated onto the CheckResult', () => {
    const audit = new DeprecatedAudit();
    const check = audit.toCheckResult({ status: 'pass', score: 1 });
    expect(check.deprecated).toEqual(NOTICE);
  });

  it('toCheckResult leaves deprecated undefined for normal audits', () => {
    class NormalAudit extends DeprecatedAudit {
      static override meta: AuditMeta = {
        ...DeprecatedAudit.meta,
        id: 'operability-safety/normal-thing',
        scoreDisplayMode: 'binary',
        weight: 1.0,
        deprecated: undefined,
      };
    }
    const check = new NormalAudit().toCheckResult({ status: 'pass', score: 1 });
    expect(check.deprecated).toBeUndefined();
  });
});
