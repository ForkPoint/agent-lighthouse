import { describe, it, expect } from "vitest";
import { TabindexAudit } from "./tabindex";
import { mockCheckContext } from "#core/__tests__/test-utils";
import { pageWithA11y, runA11yAudit } from "./_test-utils";
import { AuditTier, CheckStatus, EvidenceGrade } from "#core/types";
import { RuleStatus } from "./engine/rules";

describe("TabindexAudit", () => {
  it("registers under the tabindex id with its dossier and grade", () => {
    expect(TabindexAudit.meta.id).toBe("operability-safety/tabindex");
    expect(TabindexAudit.meta.dossier).toBe(
      "docs/evidence/audits/operability-safety/tabindex.md",
    );
    expect(TabindexAudit.meta.evidenceGrade).toBe(EvidenceGrade.C);
    expect(TabindexAudit.meta.tier).toBe(AuditTier.Informative);
  });

  it("wires exactly its a11y rule(s)", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        tabindex: { status: CheckStatus.Pass, nodes: [] },
      }),
    ]);
    const result = runA11yAudit(TabindexAudit, ctx);
    expect(result.expected).toBe("accessibility rules pass: tabindex");
  });

  it("fails when the `tabindex` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        tabindex: {
          status: CheckStatus.Fail,
          nodes: [{ target: "#offender", summary: "violation" }],
        },
      }),
    ]);
    const result = runA11yAudit(TabindexAudit, ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toContain("#offender");
  });

  it("passes when every constituent rule passes", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        tabindex: { status: CheckStatus.Pass, nodes: [] },
      }),
    ]);
    expect(runA11yAudit(TabindexAudit, ctx).status).toBe(CheckStatus.Pass);
  });

  it("is na when no constituent rule applies", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        tabindex: { status: RuleStatus.Inapplicable, nodes: [] },
      }),
    ]);
    expect(runA11yAudit(TabindexAudit, ctx).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
});
