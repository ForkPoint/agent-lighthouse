import { describe, it, expect } from "vitest";
import { NestedInteractiveAudit } from "./nested-interactive";
import { mockCheckContext } from "../../__tests__/test-utils";
import { pageWithA11y, runA11yAudit } from "./_test-utils";
import { AuditTier, CheckStatus, EvidenceGrade } from "../../types";
import { RuleStatus } from "./engine/rules";

describe("NestedInteractiveAudit", () => {
  it("registers under the nested-interactive id with its dossier and grade", () => {
    expect(NestedInteractiveAudit.meta.id).toBe(
      "operability-safety/nested-interactive",
    );
    expect(NestedInteractiveAudit.meta.dossier).toBe(
      "docs/evidence/audits/operability-safety/nested-interactive.md",
    );
    expect(NestedInteractiveAudit.meta.evidenceGrade).toBe(EvidenceGrade.A);
    expect(NestedInteractiveAudit.meta.tier).toBe(AuditTier.Scored);
  });

  it("wires exactly its a11y rule(s)", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "nested-interactive": { status: CheckStatus.Pass, nodes: [] },
      }),
    ]);
    const result = runA11yAudit(NestedInteractiveAudit, ctx);
    expect(result.expected).toBe(
      "accessibility rules pass: nested-interactive",
    );
  });

  it("fails when the `nested-interactive` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "nested-interactive": {
          status: CheckStatus.Fail,
          nodes: [{ target: "#offender", summary: "violation" }],
        },
      }),
    ]);
    const result = runA11yAudit(NestedInteractiveAudit, ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toContain("#offender");
  });

  it("passes when every constituent rule passes", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "nested-interactive": { status: CheckStatus.Pass, nodes: [] },
      }),
    ]);
    expect(runA11yAudit(NestedInteractiveAudit, ctx).status).toBe(
      CheckStatus.Pass,
    );
  });

  it("is na when no constituent rule applies", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "nested-interactive": { status: RuleStatus.Inapplicable, nodes: [] },
      }),
    ]);
    expect(runA11yAudit(NestedInteractiveAudit, ctx).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
});
