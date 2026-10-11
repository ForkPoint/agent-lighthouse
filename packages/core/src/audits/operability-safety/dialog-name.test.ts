import { describe, it, expect } from "vitest";
import { DialogNameAudit } from "./dialog-name";
import { mockCheckContext } from "#core/__tests__/test-utils";
import { pageWithA11y, runA11yAudit } from "./_test-utils";
import { AuditTier, CheckStatus, EvidenceGrade } from "#core/types";
import { RuleStatus } from "./engine/rules";

describe("DialogNameAudit", () => {
  it("registers under the dialog-name id with its dossier and grade", () => {
    expect(DialogNameAudit.meta.id).toBe("operability-safety/dialog-name");
    expect(DialogNameAudit.meta.dossier).toBe(
      "docs/evidence/audits/operability-safety/dialog-name.md",
    );
    expect(DialogNameAudit.meta.evidenceGrade).toBe(EvidenceGrade.A);
    expect(DialogNameAudit.meta.tier).toBe(AuditTier.Scored);
  });

  it("wires exactly its a11y rule(s)", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "aria-dialog-name": { status: CheckStatus.Pass, nodes: [] },
      }),
    ]);
    const result = runA11yAudit(DialogNameAudit, ctx);
    expect(result.expected).toBe("accessibility rules pass: aria-dialog-name");
  });

  it("fails when the `aria-dialog-name` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "aria-dialog-name": {
          status: CheckStatus.Fail,
          nodes: [{ target: "#offender", summary: "violation" }],
        },
      }),
    ]);
    const result = runA11yAudit(DialogNameAudit, ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toContain("#offender");
  });

  it("passes when every constituent rule passes", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "aria-dialog-name": { status: CheckStatus.Pass, nodes: [] },
      }),
    ]);
    expect(runA11yAudit(DialogNameAudit, ctx).status).toBe(CheckStatus.Pass);
  });

  it("is na when no constituent rule applies", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "aria-dialog-name": { status: RuleStatus.Inapplicable, nodes: [] },
      }),
    ]);
    expect(runA11yAudit(DialogNameAudit, ctx).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
});
