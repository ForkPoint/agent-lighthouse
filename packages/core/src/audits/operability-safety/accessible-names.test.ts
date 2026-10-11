import { describe, it, expect } from "vitest";
import { AccessibleNamesAudit } from "./accessible-names";
import { mockCheckContext } from "#core/__tests__/test-utils";
import { pageWithA11y, runA11yAudit } from "./_test-utils";
import { AuditTier, CheckStatus, EvidenceGrade } from "#core/types";
import { RuleStatus } from "./engine/rules";

describe("AccessibleNamesAudit", () => {
  it("registers under the accessible-names id with its dossier and grade", () => {
    expect(AccessibleNamesAudit.meta.id).toBe(
      "operability-safety/accessible-names",
    );
    expect(AccessibleNamesAudit.meta.dossier).toBe(
      "docs/evidence/audits/operability-safety/accessible-names.md",
    );
    expect(AccessibleNamesAudit.meta.evidenceGrade).toBe(EvidenceGrade.A);
    expect(AccessibleNamesAudit.meta.tier).toBe(AuditTier.Scored);
  });

  it("wires exactly its a11y rule(s)", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "button-name": { status: CheckStatus.Pass, nodes: [] },
        "link-name": { status: CheckStatus.Pass, nodes: [] },
      }),
    ]);
    const result = runA11yAudit(AccessibleNamesAudit, ctx);
    expect(result.expected).toBe(
      "accessibility rules pass: button-name, link-name",
    );
  });

  it("fails when the `button-name` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "button-name": {
          status: CheckStatus.Fail,
          nodes: [{ target: "#offender", summary: "violation" }],
        },
        "link-name": { status: CheckStatus.Pass, nodes: [] },
      }),
    ]);
    const result = runA11yAudit(AccessibleNamesAudit, ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toContain("#offender");
  });

  it("fails when the `link-name` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "button-name": { status: CheckStatus.Pass, nodes: [] },
        "link-name": {
          status: CheckStatus.Fail,
          nodes: [{ target: "#offender", summary: "violation" }],
        },
      }),
    ]);
    const result = runA11yAudit(AccessibleNamesAudit, ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toContain("#offender");
  });

  it("passes when every constituent rule passes", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "button-name": { status: CheckStatus.Pass, nodes: [] },
        "link-name": { status: CheckStatus.Pass, nodes: [] },
      }),
    ]);
    expect(runA11yAudit(AccessibleNamesAudit, ctx).status).toBe(
      CheckStatus.Pass,
    );
  });

  it("is na when no constituent rule applies", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "button-name": { status: RuleStatus.Inapplicable, nodes: [] },
        "link-name": { status: RuleStatus.Inapplicable, nodes: [] },
      }),
    ]);
    expect(runA11yAudit(AccessibleNamesAudit, ctx).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
});
