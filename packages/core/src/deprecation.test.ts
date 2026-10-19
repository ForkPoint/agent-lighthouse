import { describe, it, expect } from "vitest";
import { Audit } from "./audit";
import type { AuditMeta, AuditResult } from "./types";
import { AuditMetaSchema } from "./schemas";
import {
  AuditTier,
  CheckPriority,
  CheckStatus,
  EvidenceGrade,
  NoticeKind,
  ScoreDisplayMode,
} from "./types";
import { omit } from "#core/tests/omit";

const NOTICE = {
  notice: "No consumer reads this signal.",
  link: "https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/sunset/not-a-factor.md#accessibilityskip-nav",
};

class DeprecatedAudit extends Audit {
  static override meta: AuditMeta = {
    id: "operability-safety/skip-nav",
    category: "operability-safety",
    title: "Deprecated thing",
    failureTitle: "Deprecated thing",
    description: "Test audit.",
    scoreDisplayMode: ScoreDisplayMode.Informative,
    weight: 0,
    defaultPriority: CheckPriority.Low,
    evidenceGrade: EvidenceGrade.D,
    tier: AuditTier.Informative,
    dossier: "docs/evidence/sunset/not-a-factor.md",
    deprecated: NOTICE,
  };
  audit(): AuditResult {
    return { status: CheckStatus.Pass, score: 1 };
  }
}

describe("deprecation notice flow", () => {
  it("AuditMetaSchema accepts a deprecated block and weight 0", () => {
    expect(() => AuditMetaSchema.parse(DeprecatedAudit.meta)).not.toThrow();
  });

  it("AuditMetaSchema rejects a deprecated block with an empty notice", () => {
    expect(() =>
      AuditMetaSchema.parse({
        ...DeprecatedAudit.meta,
        deprecated: { notice: "", link: NOTICE.link },
      }),
    ).toThrow();
  });

  it("AuditMetaSchema still rejects negative weight", () => {
    expect(() =>
      AuditMetaSchema.parse({ ...DeprecatedAudit.meta, weight: -0.1 }),
    ).toThrow();
  });

  it("toCheckResult carries meta.deprecated onto the CheckResult", () => {
    const audit = new DeprecatedAudit();
    const check = audit.toCheckResult({ status: CheckStatus.Pass, score: 1 });
    expect(check.deprecated).toEqual(NOTICE);
  });

  it("toCheckResult leaves deprecated undefined for normal audits", () => {
    class NormalAudit extends DeprecatedAudit {
      static override meta: AuditMeta = {
        ...omit(DeprecatedAudit.meta, "deprecated"),
        id: "operability-safety/normal-thing",
        scoreDisplayMode: ScoreDisplayMode.Binary,
        weight: 1.0,
      };
    }
    const check = new NormalAudit().toCheckResult({
      status: CheckStatus.Pass,
      score: 1,
    });
    expect(check.deprecated).toBeUndefined();
  });
});

const OBSOLETE_NOTICE = {
  kind: NoticeKind.Obsolete,
  notice: "The vendor retired this file.",
  link: "https://example.com/retirement-notice",
  replacement: "Publish the successor file instead.",
};

class ObsoleteAudit extends Audit {
  static override meta: AuditMeta = {
    ...DeprecatedAudit.meta,
    id: "agent-interfaces/retired-file",
    tier: AuditTier.Obsolete,
    deprecated: OBSOLETE_NOTICE,
  };
  audit(): AuditResult {
    return { status: CheckStatus.Fail, score: 0, message: "Retired file." };
  }
}

describe("obsolete tier", () => {
  it("AuditMetaSchema accepts an obsolete audit with an obsolete notice", () => {
    expect(() => AuditMetaSchema.parse(ObsoleteAudit.meta)).not.toThrow();
  });

  it("AuditMetaSchema rejects an obsolete audit without a notice", () => {
    expect(
      AuditMetaSchema.safeParse(omit(ObsoleteAudit.meta, "deprecated")).success,
    ).toBe(false);
  });

  it("AuditMetaSchema rejects an obsolete audit whose notice is not obsolete", () => {
    expect(
      AuditMetaSchema.safeParse({
        ...ObsoleteAudit.meta,
        deprecated: { ...OBSOLETE_NOTICE, kind: NoticeKind.Unconsumed },
      }).success,
    ).toBe(false);
  });

  it("an unconsumed notice is legal on an informative audit", () => {
    expect(
      AuditMetaSchema.safeParse({
        ...DeprecatedAudit.meta,
        deprecated: { ...OBSOLETE_NOTICE, kind: NoticeKind.Unconsumed },
      }).success,
    ).toBe(true);
  });

  it("toCheckResult carries kind and replacement", () => {
    const check = new ObsoleteAudit().toCheckResult({
      status: CheckStatus.Warn,
      score: 0.5,
    });
    expect(check.deprecated).toEqual(OBSOLETE_NOTICE);
    expect(check.tier).toBe(AuditTier.Obsolete);
  });

  it("an obsolete audit never reports fail: toCheckResult lowers it to warn", () => {
    const audit = new ObsoleteAudit();
    const check = audit.toCheckResult(audit.audit());
    expect(check.status).toBe(CheckStatus.Warn);
    expect(check.title).toBe(ObsoleteAudit.meta.failureTitle);
  });
});
