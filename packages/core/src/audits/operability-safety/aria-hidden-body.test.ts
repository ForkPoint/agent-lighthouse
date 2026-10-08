import { describe, it, expect } from "vitest";
import { AriaHiddenBodyAudit } from "./aria-hidden-body";
import { mockCheckContext, mockPageContext } from "../../__tests__/test-utils";
import { pageWithA11y, runA11yAudit } from "./_test-utils";
import { AuditTier, CheckStatus, EvidenceGrade } from "../../types";
import { RuleStatus } from "./engine/rules";

describe("AriaHiddenBodyAudit", () => {
  it("registers under the aria-hidden-body id with its dossier and grade", () => {
    expect(AriaHiddenBodyAudit.meta.id).toBe(
      "operability-safety/aria-hidden-body",
    );
    expect(AriaHiddenBodyAudit.meta.dossier).toBe(
      "docs/evidence/audits/operability-safety/aria-hidden-body.md",
    );
    expect(AriaHiddenBodyAudit.meta.evidenceGrade).toBe(EvidenceGrade.A);
    expect(AriaHiddenBodyAudit.meta.tier).toBe(AuditTier.Scored);
  });

  it("wires exactly its a11y rule(s)", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "aria-hidden-body": { status: CheckStatus.Pass, nodes: [] },
      }),
    ]);
    const result = runA11yAudit(AriaHiddenBodyAudit, ctx);
    expect(result.expected).toBe("accessibility rules pass: aria-hidden-body");
  });

  it("fails when the `aria-hidden-body` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "aria-hidden-body": {
          status: CheckStatus.Fail,
          nodes: [{ target: "#offender", summary: "violation" }],
        },
      }),
    ]);
    const result = runA11yAudit(AriaHiddenBodyAudit, ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toContain("#offender");
  });

  it("passes when every constituent rule passes", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "aria-hidden-body": { status: CheckStatus.Pass, nodes: [] },
      }),
    ]);
    expect(runA11yAudit(AriaHiddenBodyAudit, ctx).status).toBe(
      CheckStatus.Pass,
    );
  });

  it("is na when no constituent rule applies", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "aria-hidden-body": { status: RuleStatus.Inapplicable, nodes: [] },
      }),
    ]);
    expect(runA11yAudit(AriaHiddenBodyAudit, ctx).status).toBe(
      CheckStatus.NotApplicable,
    );
  });

  // Ported from the former _a11y.test.ts (aggregation cases).
  it("returns na when pages have no a11yResults at all", () => {
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", "<html></html>"),
    ]);
    const result = runA11yAudit(AriaHiddenBodyAudit, ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  it("warns when a rule is incomplete and none pass or fail", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "aria-hidden-body": { status: RuleStatus.Incomplete, nodes: [] },
      }),
    ]);
    const result = runA11yAudit(AriaHiddenBodyAudit, ctx);
    expect(result.status).toBe(CheckStatus.Warn);
  });

  it("passes when a rule passes even when incomplete is also seen", () => {
    // sawIncomplete && !sawPass → false, so falls through to sawPass check
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "aria-hidden-body": { status: RuleStatus.Incomplete, nodes: [] },
      }),
      pageWithA11y("https://example.com/p", {
        "aria-hidden-body": { status: CheckStatus.Pass, nodes: [] },
      }),
    ]);
    const result = runA11yAudit(AriaHiddenBodyAudit, ctx);
    expect(result.status).toBe(CheckStatus.Pass);
  });
});
