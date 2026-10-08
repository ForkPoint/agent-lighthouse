import { describe, it, expect } from "vitest";
import { AriaRolesAudit } from "./aria-roles";
import { mockCheckContext } from "../../__tests__/test-utils";
import { pageWithA11y, runA11yAudit } from "./_test-utils";
import { AuditTier, CheckStatus, EvidenceGrade } from "../../types";
import { RuleStatus } from "./engine/rules";

describe("AriaRolesAudit", () => {
  it("registers under the aria-roles id with its dossier and grade", () => {
    expect(AriaRolesAudit.meta.id).toBe("operability-safety/aria-roles");
    expect(AriaRolesAudit.meta.dossier).toBe(
      "docs/evidence/audits/operability-safety/aria-roles.md",
    );
    expect(AriaRolesAudit.meta.evidenceGrade).toBe(EvidenceGrade.A);
    expect(AriaRolesAudit.meta.tier).toBe(AuditTier.Scored);
  });

  it("wires exactly its a11y rule(s)", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "aria-roles": { status: CheckStatus.Pass, nodes: [] },
        "aria-deprecated-role": { status: CheckStatus.Pass, nodes: [] },
        "aria-allowed-role": { status: CheckStatus.Pass, nodes: [] },
      }),
    ]);
    const result = runA11yAudit(AriaRolesAudit, ctx);
    expect(result.expected).toBe(
      "accessibility rules pass: aria-roles, aria-deprecated-role, aria-allowed-role",
    );
  });

  it("fails when the `aria-roles` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "aria-roles": {
          status: CheckStatus.Fail,
          nodes: [{ target: "#offender", summary: "violation" }],
        },
        "aria-deprecated-role": { status: CheckStatus.Pass, nodes: [] },
        "aria-allowed-role": { status: CheckStatus.Pass, nodes: [] },
      }),
    ]);
    const result = runA11yAudit(AriaRolesAudit, ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toContain("#offender");
  });

  it("fails when the `aria-deprecated-role` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "aria-roles": { status: CheckStatus.Pass, nodes: [] },
        "aria-deprecated-role": {
          status: CheckStatus.Fail,
          nodes: [{ target: "#offender", summary: "violation" }],
        },
        "aria-allowed-role": { status: CheckStatus.Pass, nodes: [] },
      }),
    ]);
    const result = runA11yAudit(AriaRolesAudit, ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toContain("#offender");
  });

  it("fails when the `aria-allowed-role` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "aria-roles": { status: CheckStatus.Pass, nodes: [] },
        "aria-deprecated-role": { status: CheckStatus.Pass, nodes: [] },
        "aria-allowed-role": {
          status: CheckStatus.Fail,
          nodes: [{ target: "#offender", summary: "violation" }],
        },
      }),
    ]);
    const result = runA11yAudit(AriaRolesAudit, ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toContain("#offender");
  });

  it("passes when every constituent rule passes", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "aria-roles": { status: CheckStatus.Pass, nodes: [] },
        "aria-deprecated-role": { status: CheckStatus.Pass, nodes: [] },
        "aria-allowed-role": { status: CheckStatus.Pass, nodes: [] },
      }),
    ]);
    expect(runA11yAudit(AriaRolesAudit, ctx).status).toBe(CheckStatus.Pass);
  });

  it("is na when no constituent rule applies", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "aria-roles": { status: RuleStatus.Inapplicable, nodes: [] },
        "aria-deprecated-role": { status: RuleStatus.Inapplicable, nodes: [] },
        "aria-allowed-role": { status: RuleStatus.Inapplicable, nodes: [] },
      }),
    ]);
    expect(runA11yAudit(AriaRolesAudit, ctx).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
});
