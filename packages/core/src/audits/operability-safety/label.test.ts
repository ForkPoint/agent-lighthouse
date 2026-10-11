import { describe, it, expect } from "vitest";
import { LabelAudit } from "./label";
import { mockCheckContext } from "#core/__tests__/test-utils";
import { pageWithA11y, runA11yAudit } from "./_test-utils";
import { AuditTier, CheckStatus, EvidenceGrade } from "#core/types";
import { RuleStatus } from "./engine/rules";

describe("LabelAudit", () => {
  it("registers under the label id with its dossier and grade", () => {
    expect(LabelAudit.meta.id).toBe("operability-safety/label");
    expect(LabelAudit.meta.dossier).toBe(
      "docs/evidence/audits/operability-safety/label.md",
    );
    expect(LabelAudit.meta.evidenceGrade).toBe(EvidenceGrade.A);
    expect(LabelAudit.meta.tier).toBe(AuditTier.Scored);
  });

  it("wires exactly its a11y rule(s)", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        label: { status: CheckStatus.Pass, nodes: [] },
        "select-name": { status: CheckStatus.Pass, nodes: [] },
      }),
    ]);
    const result = runA11yAudit(LabelAudit, ctx);
    expect(result.expected).toBe(
      "accessibility rules pass: label, select-name",
    );
  });

  it("fails when the `label` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        label: {
          status: CheckStatus.Fail,
          nodes: [{ target: "#offender", summary: "violation" }],
        },
        "select-name": { status: CheckStatus.Pass, nodes: [] },
      }),
    ]);
    const result = runA11yAudit(LabelAudit, ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toContain("#offender");
  });

  it("fails when the `select-name` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        label: { status: CheckStatus.Pass, nodes: [] },
        "select-name": {
          status: CheckStatus.Fail,
          nodes: [{ target: "#offender", summary: "violation" }],
        },
      }),
    ]);
    const result = runA11yAudit(LabelAudit, ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toContain("#offender");
  });

  it("passes when every constituent rule passes", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        label: { status: CheckStatus.Pass, nodes: [] },
        "select-name": { status: CheckStatus.Pass, nodes: [] },
      }),
    ]);
    expect(runA11yAudit(LabelAudit, ctx).status).toBe(CheckStatus.Pass);
  });

  it("is na when no constituent rule applies", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        label: { status: RuleStatus.Inapplicable, nodes: [] },
        "select-name": { status: RuleStatus.Inapplicable, nodes: [] },
      }),
    ]);
    expect(runA11yAudit(LabelAudit, ctx).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
});
