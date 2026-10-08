import { describe, it, expect } from "vitest";
import { DuplicateIdAudit } from "./duplicate-id";
import { mockCheckContext } from "../../__tests__/test-utils";
import { pageWithA11y, runA11yAudit } from "./_test-utils";
import { AuditTier, CheckStatus, EvidenceGrade } from "../../types";
import { RuleStatus } from "./engine/rules";

describe("DuplicateIdAudit", () => {
  it("registers under the duplicate-id id with its dossier and grade", () => {
    expect(DuplicateIdAudit.meta.id).toBe("operability-safety/duplicate-id");
    expect(DuplicateIdAudit.meta.dossier).toBe(
      "docs/evidence/audits/operability-safety/duplicate-id.md",
    );
    expect(DuplicateIdAudit.meta.evidenceGrade).toBe(EvidenceGrade.A);
    expect(DuplicateIdAudit.meta.tier).toBe(AuditTier.Scored);
  });

  it("wires exactly its a11y rule(s)", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "duplicate-id-aria": { status: CheckStatus.Pass, nodes: [] },
      }),
    ]);
    const result = runA11yAudit(DuplicateIdAudit, ctx);
    expect(result.expected).toBe("accessibility rules pass: duplicate-id-aria");
  });

  it("fails when the `duplicate-id-aria` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "duplicate-id-aria": {
          status: CheckStatus.Fail,
          nodes: [{ target: "#offender", summary: "violation" }],
        },
      }),
    ]);
    const result = runA11yAudit(DuplicateIdAudit, ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toContain("#offender");
  });

  it("passes when every constituent rule passes", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "duplicate-id-aria": { status: CheckStatus.Pass, nodes: [] },
      }),
    ]);
    expect(runA11yAudit(DuplicateIdAudit, ctx).status).toBe(CheckStatus.Pass);
  });

  it("is na when no constituent rule applies", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "duplicate-id-aria": { status: RuleStatus.Inapplicable, nodes: [] },
      }),
    ]);
    expect(runA11yAudit(DuplicateIdAudit, ctx).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
});
